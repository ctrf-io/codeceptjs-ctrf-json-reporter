import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import event from "codeceptjs/lib/event";
import { validateStrict } from "ctrf";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import createReporter, { type GenerateCtrfReport } from "../src/index.js";
import { ctrf, extra } from "../src/runtime.js";

let reporter: GenerateCtrfReport;
let outputDir: string;
const test = (title = "scenario") => ({
	title,
	uid: title,
	file: "suite_test.js",
	parent: {
		title: "inner",
		parent: { title: "outer", parent: { root: true } },
	},
	startedAt: 1000,
	steps: [{ name: "check", status: "passed", duration: 5 }],
});
const finish = () => {
	event.dispatcher.emit(event.all.result);
	return JSON.parse(
		readFileSync(path.join(outputDir, "ctrf-report.json"), "utf8"),
	);
};
beforeEach(() => {
	outputDir = mkdtempSync(path.join(tmpdir(), "codecept-unit-"));
	reporter = createReporter({ outputDir });
	event.dispatcher.emit(event.all.before);
});
afterEach(() => {
	reporter.dispose();
	rmSync(outputDir, { recursive: true, force: true });
});

describe("CTRF reports", () => {
	it("writes strict 0.2.0 reports with canonical root fields and scenario details", () => {
		const t = test();
		event.dispatcher.emit(event.test.started, t);
		event.dispatcher.emit(event.test.passed, t);
		const r = finish();
		validateStrict(r, { specVersion: "0.2.0" });
		expect(r).toMatchObject({
			reportFormat: "CTRF",
			specVersion: "0.2.0",
			generatedBy: "codeceptjs-ctrf-json-reporter",
		});
		expect(r.reportId).toMatch(/^[a-f0-9-]{36}$/);
		expect(Date.parse(r.timestamp)).not.toBeNaN();
		expect(r.results.tests[0]).toMatchObject({
			name: "scenario",
			status: "passed",
			duration: 5,
			start: 1000,
			stop: 1005,
			suite: ["outer", "inner"],
			filePath: "suite_test.js",
			type: "e2e",
			steps: [{ name: "check", status: "passed" }],
		});
	});
	it.each([
		["success", "passed"],
		["failed", "failed"],
		["pending", "pending"],
		["queued", "other"],
		["passed", "passed"],
		["skipped", "skipped"],
		["other", "other"],
		["unknown", "other"],
	])("maps native actor step %s to %s", (nativeStatus, expectedStatus) => {
		const imported = createRequire(import.meta.url)(
			"codeceptjs/lib/step/helper",
		);
		const HelperStep = imported.default ?? imported;
		const step = new HelperStep({}, "check");
		step.setStatus(nativeStatus);
		const t = { ...test(), steps: [step] };
		event.dispatcher.emit(event.test.passed, t);
		const report = finish();
		validateStrict(report);
		expect(report.results.tests[0].steps).toEqual([
			{ name: "check", status: expectedStatus },
		]);
	});

	it("counts final outcomes once and captures failure errors", () => {
		const failed = test("failed");
		event.dispatcher.emit(event.test.failed, failed, new Error("broken"));
		event.dispatcher.emit(event.test.failed, failed);
		event.dispatcher.emit(event.test.skipped, test("skipped"));
		event.dispatcher.emit(event.test.passed, test("passed"));
		const r = finish();
		validateStrict(r);
		expect(r.results.summary).toMatchObject({
			tests: 3,
			passed: 1,
			failed: 1,
			skipped: 1,
		});
		expect(r.results.tests[0]).toMatchObject({
			message: "broken",
			trace: expect.stringContaining("broken"),
		});
	});
	it("replaces retries with the final result and retains only prior attempts", () => {
		const t = test();
		event.dispatcher.emit(event.test.failed, t, new Error("first"));
		const retry = { ...t, currentRetry: () => 1, duration: 9 };
		event.dispatcher.emit(event.test.failed, retry, new Error("second"));
		event.dispatcher.emit(event.test.passed, {
			...retry,
			currentRetry: () => 2,
		});
		const r = finish();
		validateStrict(r);
		expect(r.results.summary).toMatchObject({ tests: 1, passed: 1, failed: 0 });
		expect(r.results.tests[0]).toMatchObject({
			retries: 2,
			flaky: true,
			status: "passed",
			retryAttempts: [
				{ attempt: 1, status: "failed", message: "first" },
				{ attempt: 2, status: "failed", message: "second" },
			],
		});
	});
	it("marks exhausted retries as failures rather than flaky passes", () => {
		const t = test();
		event.dispatcher.emit(event.test.failed, t, new Error("first"));
		event.dispatcher.emit(
			event.test.failed,
			{ ...t, retryNum: 1 },
			new Error("last"),
		);
		const r = finish();
		expect(r.results.tests[0]).toMatchObject({
			retries: 1,
			flaky: false,
			message: "last",
		});
		validateStrict(r);
	});
	it("deep merges metadata, concatenates arrays and isolates scenarios and retries", () => {
		extra({ outside: true });
		const t = test();
		event.dispatcher.emit(event.test.started, t);
		extra({ owner: { team: "one" }, tags: ["a"] });
		ctrf.extra({ owner: { priority: 2 }, tags: ["b"] });
		event.dispatcher.emit(event.test.failed, t, new Error("retry"));
		event.dispatcher.emit(event.test.finished);
		const retry = { ...t, retryNum: 1 };
		event.dispatcher.emit(event.test.started, retry);
		extra({ attempt: 2 });
		event.dispatcher.emit(event.test.passed, retry);
		event.dispatcher.emit(event.test.finished);
		event.dispatcher.emit(event.test.passed, test("other"));
		const r = finish();
		validateStrict(r);
		expect(r.results.tests[0].extra).toEqual({ attempt: 2 });
		expect(r.results.tests[0].retryAttempts[0].extra).toEqual({
			owner: { team: "one", priority: 2 },
			tags: ["a", "b"],
		});
		expect(r.results.tests[1].extra).toBeUndefined();
	});
	it("rejects unsafe metadata keys", () => {
		const t = test();
		event.dispatcher.emit(event.test.started, t);
		extra(
			JSON.parse(
				'{"__proto__":{"polluted":true},"nested":{"constructor":{"prototype":{"polluted":true}},"ok":1}}',
			),
		);
		event.dispatcher.emit(event.test.passed, t);
		const r = finish();
		expect(r.results.tests[0].extra).toEqual({ nested: { ok: 1 } });
		expect(Object.getPrototypeOf({}).polluted).toBeUndefined();
	});
	it("supports minimal output and custom filenames", () => {
		reporter.dispose();
		reporter = createReporter({
			outputDir,
			outputFile: "minimal",
			minimal: true,
		});
		event.dispatcher.emit(event.test.failed, test(), new Error("hidden"));
		event.dispatcher.emit(event.all.result);
		const r = JSON.parse(
			readFileSync(path.join(outputDir, "minimal.json"), "utf8"),
		);
		expect(r.results.tests[0]).toEqual({
			testId: expect.any(String),
			executionId: expect.any(String),
			attemptId: expect.any(String),
			name: "scenario",
			status: "failed",
			duration: 5,
		});
		validateStrict(r);
	});
	it("normalizes environment values and retains appName in extra", () => {
		reporter.dispose();
		reporter = createReporter({
			outputDir,
			buildNumber: "42",
			appName: "app",
			appVersion: "1",
			buildName: "nightly",
			osPlatform: "linux",
		});
		const r = finish();
		validateStrict(r);
		expect(r.results.environment).toMatchObject({
			buildNumber: 42,
			extra: { appName: "app" },
			appVersion: "1",
			buildName: "nightly",
		});
	});
	it.each(["", "no", "1.5", "-1", Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects invalid buildNumber %s",
		(buildNumber) => {
			expect(() => createReporter({ buildNumber })).toThrow("buildNumber");
		},
	);
	it("resets reports between runs and detaches listeners", () => {
		event.dispatcher.emit(event.test.passed, test());
		finish();
		const firstId = reporter.ctrfReport.reportId;
		event.dispatcher.emit(event.all.before);
		expect(reporter.ctrfReport.results.tests).toHaveLength(0);
		expect(reporter.ctrfReport.reportId).not.toBe(firstId);
		const count = event.dispatcher.listenerCount(event.test.passed);
		reporter.dispose();
		expect(event.dispatcher.listenerCount(event.test.passed)).toBe(count - 1);
	});
	it("handles missing optional data and unknown step statuses", () => {
		event.dispatcher.emit(event.test.passed, {
			title: "plain",
			tags: ["@tag"],
			steps: [{ name: "unknown" }],
		});
		const r = finish();
		validateStrict(r);
		expect(r.results.tests[0]).toMatchObject({
			duration: 0,
			tags: ["@tag"],
			steps: [{ status: "other" }],
		});
	});
});
