import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import {
	catalogue,
	disposition,
} from "./standard/conformance/shared/checks.mjs";
import { checkCodeceptEntry } from "./standard/conformance/codeceptjs-checks.mjs";
import {
	runConformance,
	expectedFailures,
} from "./standard/conformance/expected-failures.mjs";
import { unitContext } from "./standard/conformance/unit/fixtures.mjs";
import { recordsFromRun } from "./reporters/vitest.mjs";
const context = unitContext();
const clone = () => {
	const copy = structuredClone(context);
	for (const sample of copy.samples) sample.bytes = Buffer.from(sample.bytes);
	return copy;
};
test("Codecept tooling / reviewed shared snapshot remains exact", () => {
	const base = new URL("./standard/", import.meta.url);
	const m = JSON.parse(
		readFileSync(new URL("shared-files.json", base), "utf8"),
	);
	for (const [file, hash] of Object.entries(m.files))
		assert.equal(
			createHash("sha256")
				.update(readFileSync(new URL(file, base)))
				.digest("hex"),
			hash,
			file,
		);
});
test("Codecept tooling / capabilities cover exactly the shared inventory", () => {
	const m = JSON.parse(
		readFileSync(
			new URL("./standard/conformance/codeceptjs.json", import.meta.url),
			"utf8",
		),
	);
	for (const e of catalogue.entries) disposition(e, m);
	assert.deepEqual(
		Object.keys(m.properties).sort(),
		catalogue.entries
			.filter((e) => e.kind === "property")
			.map((e) => e.path)
			.sort(),
	);
	assert.deepEqual(
		Object.keys(m.rules).sort(),
		catalogue.entries
			.filter((e) => e.kind === "report")
			.map((e) => e.rule)
			.sort(),
	);
});
for (const id of Object.keys(expectedFailures)) {
	const entry = catalogue.entries.find((e) => e.id === id);
	test(`Codecept emission matcher / ${id} matches exact native rejection at both levels`, () => {
		for (const level of ["unit", "integration"])
			assert.equal(
				runConformance(entry, context, level).issue,
				"native-step-output-rejected",
			);
	});
	test(`Codecept emission matcher / ${id} rejects a successful emission`, () => {
		const c = clone();
		c.failedEmissions = [];
		c.samples.push({ ...c.samples[0], name: "actor-step" });
		assert.throws(() => runConformance(entry, c, "unit"), /Unexpected pass/);
	});
	test(`Codecept emission matcher / ${id} rejects changed validation errors`, () => {
		const c = clone();
		c.failedEmissions[0].emissionFailure.message += "; another failure";
		assert.throws(() => runConformance(entry, c, "unit"));
	});
	test(`Codecept emission matcher / ${id} requires native failure evidence`, () => {
		const c = clone();
		c.failedEmissions = [];
		assert.throws(() => runConformance(entry, c, "unit"), /fixture missing/);
	});
	test(`Codecept emission matcher / ${id} rejects a missing file caused by infrastructure`, () => {
		const c = clone();
		c.failedEmissions[0].emissionFailure.errorType = "ENOENT";
		assert.throws(() => runConformance(entry, c, "unit"));
	});
}
test("Codecept oracle / catches corrupted structured runtime metadata", () => {
	const c = clone();
	c.samples[0].report.results.tests[0].extra.nested.one = false;
	assert.throws(() =>
		checkCodeceptEntry(
			catalogue.entries.find((e) => e.path === "results.tests[].extra"),
			c,
		),
	);
});
test("Codecept oracle / catches inclusion of the final attempt in history", () => {
	const c = clone();
	const retry = c.samples[0].report.results.tests.find((t) => t.flaky);
	retry.retryAttempts[0].duration = retry.duration;
	assert.throws(() =>
		checkCodeceptEntry(
			catalogue.entries.find(
				(e) => e.rule === "history-excludes-final-attempt",
			),
			c,
		),
	);
});
test("Codecept oracle / catches a schema-valid native status mapping change", () => {
	const c = clone();
	c.samples[0].report.results.tests[0].status = "failed";
	assert.throws(() =>
		checkCodeceptEntry(
			catalogue.entries.find((e) => e.path === "results.tests[].status"),
			c,
		),
	);
});
test("Codecept emission evidence / never fabricates a report or bytes", () => {
	assert.equal(context.failedEmissions.length, 1);
	const evidence = context.failedEmissions[0];
	assert.equal(Object.hasOwn(evidence, "report"), false);
	assert.equal(Object.hasOwn(evidence, "bytes"), false);
	assert.equal(evidence.emissionFailure.absentOutput, true);
});
test("Reporter results / completed records preserve pass, failure, pending and skip", () => {
	const modes = [
		{ mode: "run", state: "passed" },
		{ mode: "run", state: "failed" },
		{ mode: "todo", state: "pending" },
		{ mode: "skip", state: "skipped" },
	];
	const modules = [
		{
			moduleId: "fixture.test.ts",
			children: {
				allTests: () =>
					modes.map((m, i) => ({
						name: `case-${i}`,
						options: { mode: m.mode },
						result: () => ({ state: m.state }),
						diagnostic: () => ({ duration: 4 }),
					})),
			},
			errors: () => [],
		},
	];
	assert.deepEqual(
		recordsFromRun(modules, []).map((r) => r.status),
		["passed", "failed", "pending", "skipped"],
	);
});
test("Reporter results / module and unhandled failures stay visible", () => {
	const modules = [
		{
			moduleId: "broken.test.ts",
			children: { allTests: () => [] },
			errors: () => [{ message: "load failed" }],
		},
	];
	assert.deepEqual(
		recordsFromRun(modules, [{ message: "unhandled" }]).map((r) => r.status),
		["failed", "failed"],
	);
});

test("Codecept oracle / omitted zero retry count still checks absence of history", () => {
	const c = clone();
	const test = c.samples[0].report.results.tests[0];
	test.retries = 1;
	test.retryAttempts = [{ attempt: 1, status: "failed", duration: 1 }];
	assert.throws(
		() =>
			checkCodeceptEntry(
				catalogue.entries.find((e) => e.rule === "zero-retries-omit-history"),
				c,
			),
		/native unretried/,
	);
});
