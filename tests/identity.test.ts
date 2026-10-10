import { describe, it, expect } from "vitest";
import { identityValue, runIdentity, testIdentity } from "../src/identity";

describe("identity semantics", () => {
	it("normalizes paths but preserves suite component boundaries", () => {
		const a = {
			name: "same",
			suite: ["a/b", "c"],
			filePath: "tests\\example.ts",
		};
		expect(testIdentity("runner", a)).toBe(
			testIdentity("runner", { ...a, filePath: "tests/example.ts" }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, suite: ["a", "b/c"] }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, filePath: "tests/other.ts" }),
		);
	});
	it("shares configured run identity and creates independent standalone runs", () => {
		expect(runIdentity("coordinated-run")).toBe("coordinated-run");
		expect(runIdentity()).not.toBe(runIdentity());
		expect(() => identityValue(" ", "shardId")).toThrow();
	});
	it("supports an explicit case resolver without allowing empty identity", () => {
		expect(
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "stable-case" },
			),
		).toBe("stable-case");
		expect(() =>
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "" },
			),
		).toThrow();
	});
});

import Reporter from "../src/generate-report";
it("retains execution identity through retries and separates attempt identity", () => {
	const reporter = new Reporter({
		minimal: true,
		runId: "run",
		shardId: "one",
	});
	const test = { title: "case", file: "a.ts", uid: "local", retryNum: 0 };
	(reporter as any).addTestResult(test, "failed");
	const firstId = reporter.ctrfReport.results.tests[0].executionId;
	const firstAttemptId = reporter.ctrfReport.results.tests[0].attemptId;
	(reporter as any).addTestResult({ ...test, retryNum: 1 }, "passed");
	const result = reporter.ctrfReport.results.tests[0];
	expect(result.executionId).toBe(firstId);
	expect(firstAttemptId).toBeTruthy();
	expect(result.retryAttempts?.[0].attemptId).toBe(firstAttemptId);
	expect(result.attemptId).toBeTruthy();
	expect(result.attemptId).not.toBe(firstAttemptId);
	expect(result.retryAttempts?.[0].attemptId).toBeTruthy();
	expect(result.retryAttempts?.[0].attemptId).not.toBe(firstId);
	expect(result.testId).toBeTruthy();
	reporter.dispose();
});
