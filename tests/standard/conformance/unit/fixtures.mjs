import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { metadata, expectedReport, nativeExtra } from "../expected.mjs";
const require = createRequire(import.meta.url);
const createReporter = require("../../../../dist/index.cjs");
const imported = require("codeceptjs/lib/event");
const event = imported.default ?? imported;
export function nativeFixture() {
	const now = Date.now();
	const base = {
		file: "fixtures/one_test.js",
		suite: ["outer", "inner"],
		tags: ["@smoke"],
		startedAt: now,
		steps: [{ name: "check", status: "passed", duration: 3 }],
	};
	return {
		attempts: [
			{
				...base,
				title: "passing ✓ @smoke",
				status: "passed",
				attempt: 0,
				duration: 3,
			},
			{
				...base,
				title: "retry recovery",
				status: "failed",
				attempt: 0,
				duration: 4,
				error: { message: "first", stack: "Error: first" },
			},
			{
				...base,
				title: "retry recovery",
				status: "failed",
				attempt: 1,
				duration: 5,
				error: { message: "second", stack: "Error: second" },
			},
			{
				...base,
				title: "retry recovery",
				status: "passed",
				attempt: 2,
				duration: 6,
			},
			{
				...base,
				title: "retry exhausted",
				status: "failed",
				attempt: 0,
				duration: 4,
				error: { message: "first", stack: "Error: first" },
			},
			{
				...base,
				title: "retry exhausted",
				status: "failed",
				attempt: 1,
				duration: 5,
				error: { message: "last", stack: "Error: last" },
			},
			{ ...base, title: "skipped", status: "skipped", attempt: 0, duration: 0 },
			{ ...base, title: "same", status: "passed", attempt: 0, duration: 0 },
			{
				...base,
				title: "same",
				file: "fixtures/two_test.js",
				suite: ["other"],
				status: "passed",
				attempt: 0,
			},
		],
	};
}
export function emitSample(name, native, options = {}, captureFailure = false) {
	const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-codecept-unit-"));
	const key = Symbol.for("ctrf.codeceptjs.runtime");
	const previous = globalThis[key];
	let reporter;
	try {
		const runWindow = [Date.now()];
		reporter = createReporter({
			...options,
			outputDir: scratch,
			outputFile: "report.json",
			...(options.customIdentity
				? { testIdResolver: ({ name }) => `custom:${name}` }
				: {}),
		});
		event.dispatcher.emit(event.all.before);
		for (const a of native.attempts) {
			let parent = { root: true };
			for (const title of a.suite ?? []) parent = { title, parent };
			const test = {
				title: a.title,
				uid: JSON.stringify([a.file, a.suite, a.title]),
				file: a.file,
				parent,
				tags: a.tags,
				startedAt: a.startedAt,
				duration: a.duration,
				steps: a.steps,
				currentRetry: () => a.attempt,
			};
			event.dispatcher.emit(event.test.started, test);
			const extra = nativeExtra(a.title, a.attempt);
			if (a.title.startsWith("passing")) {
				createReporter.extra({
					owner: "first",
					nested: { one: true },
					list: ["one"],
				});
				createReporter.extra({
					owner: "last",
					nested: { two: true },
					list: ["two"],
				});
			} else if (extra) createReporter.extra(extra);
			const error = a.error
				? Object.assign(new Error(a.error.message), { stack: a.error.stack })
				: undefined;
			event.dispatcher.emit(event.test[a.status], test, error);
			event.dispatcher.emit(event.test.finished, test);
			createReporter.extra({ outside: "must not leak" });
		}
		event.dispatcher.emit(event.all.result);
		runWindow.push(Date.now());
		const bytes = readFileSync(path.join(scratch, "report.json"));
		return {
			name,
			bytes,
			report: JSON.parse(bytes),
			native,
			expected: expectedReport(native, options),
			options,
			runWindow,
		};
	} catch (error) {
		if (!captureFailure) throw error;
		return {
			name,
			emissionFailure: {
				message: error.message,
				errorType: error.name,
				absentOutput: !existsSync(path.join(scratch, "report.json")),
				nativeSteps: native.attempts.flatMap((a) =>
					(a.steps ?? []).map((step) => ({
						title: step.title,
						helperMethod: step.helperMethod,
						name: step.name,
						status: step.status,
					})),
				),
			},
		};
	} finally {
		reporter?.dispose();
		if (previous === undefined) delete globalThis[key];
		else globalThis[key] = previous;
		rmSync(scratch, { recursive: true, force: true });
	}
}
export function unitContext() {
	const native = nativeFixture();
	const samples = [
		emitSample("full", native, metadata),
		emitSample("repeated", native, metadata),
		emitSample("defaults", native),
		emitSample("minimal", native, { ...metadata, minimal: true }),
		emitSample("empty", { attempts: [] }),
		emitSample("empty-run-id", native, { runId: "" }),
		emitSample("zero-build-number", native, { buildNumber: 0 }),
		emitSample(
			"custom-identity",
			{ attempts: native.attempts.slice(0, 1) },
			{ customIdentity: true },
		),
	];
	for (const [index, shardId] of ["one", "two"].entries())
		samples.push(
			emitSample(
				`shard-${shardId}`,
				{ attempts: native.attempts.slice(index, index + 1) },
				{ ...metadata, shardId },
			),
		);
	const ImportedStep = require("codeceptjs/lib/step/helper");
	const Step = ImportedStep.default ?? ImportedStep;
	const step = new Step({}, "check");
	step.setStatus("success");
	const probe = emitSample(
		"actor-step",
		{
			attempts: [
				{
					title: "actor-step",
					file: "fixtures/actor_test.cjs",
					suite: ["actor"],
					status: "passed",
					attempt: 0,
					duration: 1,
					steps: [step],
				},
			],
		},
		{},
		true,
	);
	const failedEmissions = probe.emissionFailure ? [probe] : [];
	if (!probe.emissionFailure) samples.push(probe);
	return {
		samples,
		failedEmissions,
		repeated: samples.slice(0, 2),
		shards: samples.filter((s) => s.name.startsWith("shard-")),
		warnings: [],
	};
}
