const { threadId } = require("node:worker_threads");
module.exports = (options) =>
	require("codeceptjs-ctrf-json-reporter")({
		...options,
		outputFile: `report-${threadId}.json`,
	});
