const path = require("node:path");
const fixture = JSON.parse(process.env.CTRF_FIXTURE_CONFIG);
const options = { ...fixture.options, outputDir: fixture.output };
if (options.customIdentity)
	options.testIdResolver = ({ name }) => `custom:${name}`;
exports.config = {
	tests: path.join(
		__dirname,
		fixture.shard === 0
			? "one_test.cjs"
			: fixture.shard === 1
				? "two_test.cjs"
				: "*_test.cjs",
	),
	output: fixture.output,
	helpers: { Fixture: { require: path.join(__dirname, "helper.cjs") } },
	plugins: {
		nativeObserver: {
			enabled: true,
			require: path.join(__dirname, "observer.cjs"),
			outputDir: fixture.output,
		},
		ctrf: {
			enabled: true,
			require: fixture.workers
				? path.join(__dirname, "worker-plugin.cjs")
				: fixture.esm
					? require
							.resolve("codeceptjs-ctrf-json-reporter")
							.replace("index.cjs", "index.js")
					: "codeceptjs-ctrf-json-reporter",
			...options,
			outputFile: "report.json",
		},
	},
	name: "ctrf-fixture",
};
