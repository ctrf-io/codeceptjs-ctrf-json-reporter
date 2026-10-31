export const metadata = {
	runId: "controlled-run",
	shardId: "one",
	appName: "fixture",
	appVersion: "1.2.3",
	osPlatform: "linux",
	osRelease: "controlled",
	osVersion: "6",
	buildName: "build",
	buildNumber: "42",
	buildUrl: "https://example.com/build/42",
	repositoryName: "fixture",
	repositoryUrl: "https://example.com/repository",
	branchName: "main",
	commit: "abc123",
	testEnvironment: "test",
};
export const passExtra = {
	owner: "last",
	nested: { one: true, two: true },
	list: ["one", "two"],
};
export function nativeExtra(title, attempt) {
	if (title.startsWith("passing")) return structuredClone(passExtra);
	if (title.includes("retry")) return { attempt: attempt + 1 };
	return undefined;
}
const elapsed = (n) =>
	typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
export function expectedReport(native, options) {
	const groups = new Map();
	for (const item of native.attempts) {
		const key = JSON.stringify([item.file, item.suite, item.title]);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(item);
	}
	const tests = [...groups.values()].map((attempts) => {
		const t = attempts.at(-1);
		const result = {
			name: t.title,
			status: t.status,
			duration: elapsed(
				t.duration ?? t.steps?.reduce((sum, s) => sum + elapsed(s.duration), 0),
			),
			sourceAttempts: attempts.map((a) => ({
				status: a.status,
				duration: elapsed(
					a.duration ??
						a.steps?.reduce((sum, s) => sum + elapsed(s.duration), 0),
				),
			})),
		};
		if (!options.minimal) {
			if (
				t.startedAt !== undefined &&
				Number.isFinite(t.startedAt) &&
				t.startedAt >= 0
			) {
				result.start = t.startedAt;
				result.stop = t.startedAt + result.duration;
			}
			if (t.suite?.length) result.suite = t.suite;
			if (t.file) result.filePath = t.file;
			if (t.tags?.length) result.tags = t.tags;
			result.rawStatus = t.status;
			result.type = options.testType ?? "e2e";
			if (t.status === "failed" && t.error) {
				result.message = t.error.message;
				result.trace = t.error.stack;
			}
			if (t.steps?.length)
				result.steps = t.steps.map((s) => ({
					name: s.name,
					status:
						s.status === "success"
							? "passed"
							: ["passed", "failed", "skipped", "pending", "other"].includes(
										s.status,
									)
								? s.status
								: "other",
				}));
			const extra = nativeExtra(t.title, t.attempt);
			if (extra) result.extra = extra;
		}
		if (options.customIdentity) result.testId = `custom:${t.title}`;
		if (attempts.length > 1) {
			result.retries = attempts.length - 1;
			result.flaky =
				t.status === "passed" &&
				attempts.slice(0, -1).some((a) => a.status === "failed");
			result.retryAttempts = attempts.slice(0, -1).map((a, i) => {
				const h = {
					attempt: i + 1,
					status: a.status,
					duration: result.sourceAttempts[i].duration,
				};
				if (!options.minimal) {
					if (a.startedAt !== undefined) {
						h.start = a.startedAt;
						h.stop = a.startedAt + h.duration;
					}
					if (a.status === "failed" && a.error) {
						h.message = a.error.message;
						h.trace = a.error.stack;
					}
					const extra = nativeExtra(a.title, a.attempt);
					if (extra) h.extra = extra;
				}
				return h;
			});
		}
		return result;
	});
	const environment = Object.fromEntries(
		Object.entries(options).filter(
			([key]) => key in metadata && !["runId", "appName"].includes(key),
		),
	);
	if (environment.buildNumber !== undefined)
		environment.buildNumber = Number(environment.buildNumber);
	if (options.appName !== undefined)
		environment.extra = { appName: options.appName };
	const summary = { tests: tests.length };
	for (const status of ["passed", "failed", "pending", "skipped", "other"])
		summary[status] = tests.filter((t) => t.status === status).length;
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "codeceptjs-ctrf-json-reporter",
		...(options.runId ? { runId: options.runId } : {}),
		results: {
			tool: { name: "codeceptjs" },
			summary,
			tests,
			...(Object.keys(environment).length ? { environment } : {}),
		},
	};
}
