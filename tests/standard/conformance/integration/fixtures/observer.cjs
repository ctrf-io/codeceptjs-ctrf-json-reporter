const fs = require("node:fs");
const path = require("node:path");
const { threadId } = require("node:worker_threads");
const imported = require("codeceptjs/lib/event");
const event = imported.default ?? imported;
module.exports = (options) => {
	const native = { attempts: [], threadId, started: 0 };
	event.dispatcher.on(event.test.started, () => {
		native.started++;
	});
	for (const status of ["passed", "failed", "skipped"])
		event.dispatcher.on(event.test[status], (test, error) => {
			const suite = [];
			for (let p = test.parent; p && !p.root; p = p.parent)
				if (p.title) suite.unshift(p.title);
			const e = error ?? test.err;
			native.attempts.push({
				title: test.title,
				uid: test.uid,
				file: test.file,
				suite,
				tags: test.tags,
				startedAt: test.startedAt,
				duration: test.duration,
				steps: test.steps?.map((s) => ({
					name: s.name ?? s.title,
					rawName: s.name,
					title: s.title,
					helperMethod: s.helperMethod,
					status: s.status,
					duration: s.duration,
				})),
				attempt: Math.max(test.currentRetry?.() ?? 0, test.retryNum ?? 0),
				status,
				error: e ? { message: e.message, stack: e.stack } : undefined,
			});
		});
	event.dispatcher.on(event.all.result, () => {
		fs.mkdirSync(options.outputDir, { recursive: true });
		fs.writeFileSync(
			path.join(options.outputDir, `native-${threadId}.json`),
			JSON.stringify(native),
		);
	});
};
