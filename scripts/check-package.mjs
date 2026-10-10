import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), "codecept-package-"));
const run = (args, cwd = temp) =>
	execFileSync(process.execPath, args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			npm_config_cache:
				process.env.npm_config_cache ?? path.join(temp, "cache"),
		},
	});
const npm = process.env.npm_execpath;
assert.ok(npm, "Run this check through npm run test:package");
try {
	const [pack] = JSON.parse(
		run([npm, "pack", "--json", "--pack-destination", temp], root),
	);
	const files = new Set(pack.files.map((file) => file.path));
	for (const file of [
		"dist/index.cjs",
		"dist/index.js",
		"dist/index.d.ts",
		"dist/runtime.cjs",
		"dist/runtime.js",
		"dist/runtime.d.ts",
	])
		assert.ok(files.has(file), file);
	assert.ok(
		![...files].some(
			(file) => file.startsWith("node_modules/") || file.startsWith("src/"),
		),
	);
	writeFileSync(
		path.join(temp, "package.json"),
		JSON.stringify({
			name: "packed-consumer",
			private: true,
			version: "1.0.0",
		}),
	);
	run([
		npm,
		"install",
		"--ignore-scripts",
		"--no-audit",
		"--no-fund",
		path.join(temp, pack.filename),
		"@types/node@26.6.5",
	]);
	const installed = JSON.parse(
		readFileSync(
			path.join(
				temp,
				"node_modules/codeceptjs-ctrf-json-reporter/package.json",
			),
			"utf8",
		),
	);
	assert.equal(installed.dependencies.ctrf, "0.5.0");
	assert.ok(
		!installed.dependencies.typescript &&
			!installed.dependencies["@typescript/native"],
	);
	for (const extension of ["mjs", "cjs"]) {
		const imports =
			extension === "mjs"
				? 'import createReporter, { extra } from "codeceptjs-ctrf-json-reporter"; import event from "codeceptjs/lib/event"; import { validateStrict } from "ctrf";'
				: 'const createReporter = require("codeceptjs-ctrf-json-reporter"); const { extra } = require("codeceptjs-ctrf-json-reporter/runtime"); const event = require("codeceptjs/lib/event").default; const { validateStrict } = require("ctrf");';
		const script = `${imports}\nconst reporter = createReporter({outputDir:${JSON.stringify(path.join(temp, extension))}}); const test = {title:"packed",uid:"packed"}; event.dispatcher.emit(event.all.before); event.dispatcher.emit(event.test.started,test); extra({packed:true}); event.dispatcher.emit(event.test.passed,test); event.dispatcher.emit(event.all.result); validateStrict(reporter.ctrfReport); if(!reporter.ctrfReport.results.tests[0].extra.packed) throw new Error("metadata missing"); reporter.dispose();`;
		writeFileSync(path.join(temp, `consumer.${extension}`), script);
		run([`consumer.${extension}`]);
	}
	for (const extension of ["mts", "cts"])
		writeFileSync(
			path.join(temp, `consumer.${extension}`),
			'import createReporter, { extra, type ReporterConfigOptions } from "codeceptjs-ctrf-json-reporter"; const options: ReporterConfigOptions = {buildNumber:42}; const reporter = createReporter(options); extra({consumer:true}); reporter.dispose();\n',
		);
	writeFileSync(
		path.join(temp, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				module: "NodeNext",
				target: "ES2023",
				strict: true,
				noEmit: true,
				types: ["node"],
			},
			include: ["consumer.mts", "consumer.cts"],
		}),
	);
	run([
		path.join(root, "node_modules/@typescript/native/bin/tsc"),
		"-p",
		path.join(temp, "tsconfig.json"),
	]);
	const audit = spawnSync(
		process.execPath,
		[npm, "audit", "--omit=dev", "--json"],
		{
			cwd: temp,
			encoding: "utf8",
			env: { ...process.env, npm_config_cache: path.join(temp, "cache") },
		},
	);
	const auditResult = JSON.parse(audit.stdout);
	assert.ok(
		auditResult.metadata && !auditResult.error,
		"Packed consumer audit could not be read",
	);
	mkdirSync(path.join(root, "reports"), { recursive: true });
	writeFileSync(
		path.join(root, "reports/packed-consumer-audit.json"),
		JSON.stringify(auditResult, null, 2),
	);
	console.log(
		`Packed ESM/CommonJS runtime and declaration consumers passed; fresh consumer audit: ${auditResult.metadata.vulnerabilities.total} findings`,
	);
} finally {
	rmSync(temp, { recursive: true, force: true });
}
