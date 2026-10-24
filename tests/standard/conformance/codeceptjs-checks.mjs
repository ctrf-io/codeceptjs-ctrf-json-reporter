import assert from "node:assert/strict";
import { checkEntry } from "./shared/checks.mjs";
export function checkCodeceptEntry(entry, context) {
	for (const sample of context.samples)
		if (sample.emissionFailure) {
			const failure = sample.emissionFailure;
			assert.fail(
				`${sample.name}: producer rejected native step output: ${failure.errorType}: ${failure.message}`,
			);
		}
	checkEntry(entry, context);
	if (entry.rule === "zero-retries-omit-history") {
		// Codecept omits the optional retries field for an unretried scenario.
		// Use independently observed attempts to exercise this branch rather
		// than relying on a literal retries: 0 that this producer never emits.
		let witnessed = 0;
		for (const sample of context.samples)
			for (const [index, source] of sample.expected.results.tests.entries()) {
				if (source.sourceAttempts.length !== 1) continue;
				witnessed++;
				assert.equal(
					sample.report.results.tests[index].retryAttempts,
					undefined,
					`${sample.name}: native unretried execution must omit history`,
				);
			}
		assert.ok(witnessed > 0, "Missing native unretried execution evidence");
	}

	if (
		[
			"results.tests[].extra",
			"results.environment.extra",
			"results.tests[].steps",
			"results.tests[].retryAttempts[].extra",
		].includes(entry.path)
	)
		for (const sample of context.samples) {
			let actual, expected;
			if (entry.path === "results.environment.extra") {
				actual = sample.report.results.environment?.extra;
				expected = sample.expected.results.environment?.extra;
			} else if (entry.path.includes("retryAttempts")) {
				actual = sample.report.results.tests.flatMap((t) =>
					(t.retryAttempts ?? []).map((a) => a.extra),
				);
				expected = sample.expected.results.tests.flatMap((t) =>
					(t.retryAttempts ?? []).map((a) => a.extra),
				);
			} else {
				const key = entry.path.split(".").at(-1);
				actual = sample.report.results.tests.map((t) => t[key]);
				expected = sample.expected.results.tests.map((t) => t[key]);
			}
			assert.deepEqual(
				actual,
				expected,
				`${sample.name}: native structured source mapping ${entry.path}`,
			);
		}
}
