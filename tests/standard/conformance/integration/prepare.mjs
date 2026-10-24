import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	rmSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { metadata, expectedReport } from "../expected.mjs";
import { catalogue, checkEntry } from "../shared/checks.mjs";
export function integrationContext(root, diagnostics) {
	const consumer = mkdtempSync(path.join(tmpdir(), "ctrf-codecept-consumer-"));
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";
	const env = { ...process.env, FORCE_COLOR: "0" };
	delete env.NODE_PATH;
	delete env.NODE_OPTIONS;
	function execute(cmd, args, name, expected = 0) {
		const result = spawnSync(cmd, args, {
			cwd: consumer,
			env,
			encoding: "utf8",
			timeout: 240000,
			maxBuffer: 16 * 1024 * 1024,
		});
		if (diagnostics) {
			mkdirSync(diagnostics, { recursive: true });
			writeFileSync(
				path.join(diagnostics, `${name}.log`),
				`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
			);
		}
		assert.ifError(result.error);
		assert.equal(result.signal, null, name);
		if (expected !== undefined)
			assert.equal(
				result.status,
				expected,
				`${name}: ${result.stdout} ${result.stderr}`,
			);
		return result;
	}
	try {
		const pkg = JSON.parse(
			readFileSync(path.join(root, "package.json"), "utf8"),
		);
		const packed = JSON.parse(
			execute(npm, ["pack", root, "--json", "--ignore-scripts"], "pack").stdout,
		)[0];
		assert.ok(
			packed.files.every(
				(f) => !f.path.startsWith("tests/") && !f.path.startsWith("src/"),
			),
		);
		writeFileSync(
			path.join(consumer, "package.json"),
			JSON.stringify({ private: true, overrides: pkg.overrides }),
		);
		execute(
			npm,
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--save-exact",
				`./${packed.filename}`,
				`codeceptjs@${pkg.devDependencies.codeceptjs}`,
			],
			"install",
		);
		cpSync(
			new URL("./fixtures/", import.meta.url),
			path.join(consumer, "fixtures"),
			{ recursive: true },
		);
		const samples = [];
		const failedEmissions = [];
		const scenarios = [
			{ name: "actor-step", actor: true, passed: true, exit: undefined },
			{
				name: "actor-minimal",
				actor: true,
				options: { minimal: true },
				passed: true,
				exit: 0,
			},
			{ name: "full", exit: 1 },
			{ name: "repeated", exit: 1 },
			{ name: "esm", esm: true, exit: 1 },
			{ name: "minimal", options: { minimal: true }, exit: 1 },
			{ name: "defaults", defaults: true, passed: true, exit: 0 },
			{
				name: "zero-build-number",
				options: { buildNumber: 0 },
				passed: true,
				exit: 0,
			},
			{ name: "empty-run-id", options: { runId: "" }, passed: true, exit: 0 },
			{
				name: "custom-identity",
				shard: 1,
				options: { customIdentity: true },
				passed: true,
				exit: 0,
			},
			{
				name: "shard-one",
				shard: 0,
				options: { shardId: "one" },
				passed: true,
				exit: 0,
			},
			{
				name: "shard-two",
				shard: 1,
				options: { shardId: "two" },
				passed: true,
				exit: 0,
			},
			{ name: "workers", workers: true, passed: true, exit: 0 },
		];
		for (const scenario of scenarios) {
			const output = path.join(consumer, scenario.name);
			mkdirSync(output);
			const options = {
				...(scenario.defaults ? {} : metadata),
				...scenario.options,
			};
			env.CTRF_ACTOR_STEP = String(scenario.actor ?? false);
			env.CTRF_FIXTURE_PASSED = String(scenario.passed ?? false);
			env.CTRF_FIXTURE_CONFIG = JSON.stringify({
				...scenario,
				output,
				options,
			});
			const args = [
				"node_modules/codeceptjs/bin/codecept.js",
				...(scenario.workers ? ["run-workers", "2", "--by", "suite"] : ["run"]),
				"--config",
				"fixtures/config.cjs",
			];
			const runWindow = [Date.now()];
			const outcome = execute(
				process.execPath,
				args,
				scenario.name,
				scenario.exit,
			);
			runWindow.push(Date.now());
			const nativeFiles = readdirSync(output).filter((f) =>
				/^native-\d+\.json$/u.test(f),
			);
			assert.ok(nativeFiles.length, "Native observer did not finish");
			const workerThreads = [];
			const nativeCases = [];
			for (const nativeFile of nativeFiles) {
				const native = JSON.parse(
					readFileSync(path.join(output, nativeFile), "utf8"),
				);
				const reportFile = scenario.workers
					? `report-${native.threadId}.json`
					: "report.json";
				const fileExists = existsSync(path.join(output, reportFile));
				const bytes = fileExists
					? readFileSync(path.join(output, reportFile))
					: undefined;
				if (native.threadId > 0 && native.started > 0)
					workerThreads.push(native.threadId);
				const grouped = new Map();
				for (const a of native.attempts) {
					const key = JSON.stringify([a.suite, a.title]);
					if (!grouped.has(key)) grouped.set(key, []);
					grouped.get(key).push(a);
				}
				nativeCases.push(
					...[...grouped.values()].map((attempts) => attempts.at(-1)),
				);
				for (const attempts of grouped.values()) {
					const last = attempts.at(-1);
					assert.equal(
						last.status,
						last.title === "skipped"
							? "skipped"
							: last.title === "retry exhausted" && !scenario.passed
								? "failed"
								: "passed",
						`${scenario.name}: independent final outcome ${last.title}`,
					);
					if (!scenario.passed && last.title.includes("retry")) {
						assert.equal(
							attempts.length,
							last.title === "retry recovery" ? 3 : 2,
						);
						assert.deepEqual(
							attempts.map((a) => a.attempt),
							Array.from({ length: attempts.length }, (_, i) => i),
						);
					}
				}
				const name = scenario.workers
					? `workers-thread-${native.threadId}`
					: scenario.name;
				if (diagnostics) {
					cpSync(
						path.join(output, nativeFile),
						path.join(diagnostics, `${name}-native.json`),
					);
					if (fileExists)
						cpSync(
							path.join(output, reportFile),
							path.join(diagnostics, `${name}-report.json`),
						);
				}
				if (!fileExists) {
					assert.equal(
						scenario.name,
						"actor-step",
						"Unexpected missing report",
					);
					assert.ok([0, 1].includes(outcome.status));
					const text = outcome.stdout + outcome.stderr;
					const match = text.match(
						/ValidationError: (CTRF validation failed:\n\/results\/tests\/0\/steps\/0: must have required property 'name')/u,
					);
					failedEmissions.push({
						name: "actor-step",
						emissionFailure: {
							message: match?.[1] ?? text,
							errorType: match
								? "ValidationError"
								: "UnexpectedEmissionFailure",
							absentOutput: true,
							nativeSteps: native.attempts.flatMap((a) =>
								(a.steps ?? []).map((step) => ({
									title: step.title,
									helperMethod: step.helperMethod,
									name: step.rawName,
									status: step.status,
								})),
							),
						},
					});
					continue;
				}
				samples.push({
					name,
					base64: bytes.toString("base64"),
					report: JSON.parse(bytes),
					expected: expectedReport(native, options),
					native,
					options,
					runWindow,
				});
			}
			const wanted =
				scenario.shard === 1
					? ["same"]
					: scenario.shard === 0
						? [
								"passing ✓ @smoke",
								"skipped",
								"retry recovery",
								"retry exhausted",
								"same",
							]
						: [
								"passing ✓ @smoke",
								"skipped",
								"retry recovery",
								"retry exhausted",
								"same",
								"same",
							];
			assert.deepEqual(
				nativeCases.map((t) => t.title).sort(),
				wanted.sort(),
				`${scenario.name}: complete native inventory`,
			);
			if (scenario.workers)
				assert.equal(
					new Set(workerThreads).size,
					2,
					"Two real worker threads must run",
				);
			if (scenario.actor)
				assert.ok(
					nativeCases.some((t) =>
						t.steps?.some((step) => step.helperMethod === "check"),
					),
					"A real actor step must run",
				);
		}
		const full = samples.find((s) => s.name === "full");
		checkEntry(
			catalogue.entries.find((e) => e.rule === "single-json-object"),
			{
				samples: [{ ...full, bytes: Buffer.from(full.base64, "base64") }],
				warnings: [],
			},
		);
		for (const [rule, mutate] of [
			[
				"single-json-object",
				(r) => {
					r.results.tests[0].duration = "invalid";
				},
			],
			[
				"summary-matches-final-results",
				(r) => {
					r.results.summary.passed++;
				},
			],
			[
				"retry-count-matches-history-length",
				(r) => {
					r.results.tests.find((t) => t.retries > 0).retries++;
				},
			],
			[
				"declares-supported-contract",
				(r) => {
					r.specVersion = "9.9.9";
				},
			],
		]) {
			const report = structuredClone(full.report);
			mutate(report);
			assert.throws(() =>
				checkEntry(
					catalogue.entries.find((e) => e.rule === rule),
					{
						samples: [
							{
								name: "corrupted installed output",
								report,
								bytes: Buffer.from(JSON.stringify(report)),
							},
						],
						warnings: [],
					},
				),
			);
		}
		return {
			samples,
			failedEmissions,
			repeated: ["full", "repeated"],
			shards: ["shard-one", "shard-two"],
			warnings: [],
		};
	} finally {
		rmSync(consumer, { recursive: true, force: true });
	}
}
