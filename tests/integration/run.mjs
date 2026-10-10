import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateStrict } from "ctrf";

const root = process.cwd();
const dir = mkdtempSync(path.join(tmpdir(), "codecept-integration-"));
try {
	for (const extension of ["js", "cjs"]) {
		const output = path.join(dir, extension);
		const config = {
			tests: path.join(root, "tests/integration/scenarios_test.js"),
			output,
			helpers: {},
			plugins: {
				ctrf: {
					enabled: true,
					require: path.join(root, `dist/index.${extension}`),
					outputDir: output,
					appName: "integration",
					buildNumber: "42",
				},
			},
			name: "ctrf-integration",
		};
		const configFile = path.join(dir, `config-${extension}.cjs`);
		writeFileSync(configFile, `exports.config = ${JSON.stringify(config)};\n`);
		const result = spawnSync(
			process.execPath,
			[
				"node_modules/codeceptjs/bin/codecept.js",
				"run",
				"--config",
				configFile,
			],
			{
				cwd: root,
				encoding: "utf8",
				env: { ...process.env, FORCE_COLOR: "0" },
			},
		);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.ok(
			existsSync(path.join(output, "ctrf-report.json")),
			result.stdout + result.stderr,
		);
		const report = JSON.parse(
			readFileSync(path.join(output, "ctrf-report.json"), "utf8"),
		);
		validateStrict(report, { specVersion: "0.2.0" });
		assert.equal(report.results.summary.tests, 4);
		assert.equal(report.results.summary.passed, 2);
		assert.equal(report.results.summary.failed, 1);
		assert.equal(report.results.summary.skipped, 1);
		const flaky = report.results.tests.find(
			(test) => test.name === "flaky scenario",
		);
		assert.equal(flaky.retries, 1);
		assert.equal(flaky.flaky, true);
		assert.equal(flaky.retryAttempts.length, 1);
		assert.equal(flaky.retryAttempts[0].status, "failed");
		assert.equal(report.runId, undefined);
		assert.ok(flaky.testId);
		assert.ok(flaky.executionId);
		assert.ok(flaky.attemptId);
		assert.ok(flaky.retryAttempts[0].attemptId);
		assert.notEqual(flaky.attemptId, flaky.retryAttempts[0].attemptId);
		assert.notEqual(flaky.executionId, flaky.retryAttempts[0].attemptId);
		assert.equal(flaky.extra.tries, 2);
		const passed = report.results.tests.find((test) =>
			test.name.startsWith("passing scenario"),
		);
		assert.equal(passed.extra.owner, "integration");
		assert.deepEqual(passed.suite, ["CTRF framework integration"]);
		const failed = report.results.tests.find(
			(test) => test.name === "failing scenario",
		);
		assert.equal(failed.message, "expected integration failure");
		assert.equal(report.results.environment.buildNumber, 42);
		console.log(`CodeceptJS 4.2.0 ${extension} plugin integration passed`);
	}
} finally {
	rmSync(dir, { recursive: true, force: true });
}
