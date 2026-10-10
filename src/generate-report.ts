import {
	identityValue,
	testIdentity,
	type IdentityOptions,
} from "./identity.js";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import {
	type AttemptHistoryEntry,
	type CTRFReport,
	CURRENT_SPEC_VERSION,
	type Environment,
	type Test,
	type TestStatus,
	validateStrict,
} from "ctrf";
import eventImport from "codeceptjs/lib/event";

// Node require(ESM) returns a namespace; esbuild wraps its default import again.
const event =
	"dispatcher" in eventImport
		? eventImport
		: (eventImport as unknown as { default: typeof eventImport }).default;
import { mergeExtra, setRuntime } from "./runtime.js";

export interface ReporterConfigOptions extends IdentityOptions {
	outputFile?: string;
	outputDir?: string;
	minimal?: boolean;
	testType?: string;
	appName?: string;
	appVersion?: string;
	osPlatform?: string;
	osRelease?: string;
	osVersion?: string;
	buildName?: string;
	buildNumber?: string | number;
	buildUrl?: string;
	repositoryName?: string;
	repositoryUrl?: string;
	branchName?: string;
	commit?: string;
	testEnvironment?: string;
}

interface Suite {
	title?: string;
	root?: boolean;
	parent?: Suite;
}
interface CodeceptTest {
	title: string;
	uid?: string;
	file?: string;
	parent?: Suite;
	tags?: string[];
	startedAt?: number;
	duration?: number;
	retryNum?: number;
	currentRetry?: () => number;
	err?: Error;
	steps?: { name: string; status?: string; duration?: number }[];
}

const duration = (value: number | undefined): number =>
	Number.isFinite(value) && (value ?? -1) >= 0 ? (value as number) : 0;

export default class GenerateCtrfReport {
	readonly ctrfReport: CTRFReport;
	readonly ctrfEnvironment: Environment = {};
	readonly reporterConfigOptions: ReporterConfigOptions;
	readonly reporterName = "codeceptjs-ctrf-json-reporter";
	readonly defaultOutputFile = "ctrf-report.json";
	readonly defaultOutputDir = "ctrf";
	filename: string;
	private current?: CodeceptTest;
	private metadata: Record<string, unknown> = {};
	private readonly records = new Map<
		string,
		{ index: number; attempt: number }
	>();
	private readonly cleanups: (() => void)[] = [];

	constructor(options: ReporterConfigOptions = {}) {
		this.reporterConfigOptions = options;
		this.filename = options.outputFile ?? this.defaultOutputFile;
		if (!this.filename.endsWith(".json")) this.filename += ".json";
		this.setEnvironmentDetails(options);
		this.ctrfReport = this.newReport();
		this.on(event.all.before, () => {
			this.disposeRuntime();
			Object.assign(this.ctrfReport, this.newReport());
			this.records.clear();
		});
		this.on(event.test.started, (test: CodeceptTest) => {
			this.current = test;
			this.metadata = {};
			setRuntime((data) => {
				if (this.current) mergeExtra(this.metadata, data);
			});
		});
		this.on(event.test.passed, (test: CodeceptTest) =>
			this.addTestResult(test, "passed"),
		);
		this.on(event.test.failed, (test: CodeceptTest, error?: Error) =>
			this.addTestResult(test, "failed", error),
		);
		this.on(event.test.skipped, (test: CodeceptTest) =>
			this.addTestResult(test, "skipped"),
		);
		this.on(event.test.finished, () => this.disposeRuntime());
		this.on(event.all.result, () => {
			this.disposeRuntime();
			this.ctrfReport.results.summary.stop = Date.now();
			this.ctrfReport.timestamp = new Date().toISOString();
			validateStrict(this.ctrfReport, { specVersion: CURRENT_SPEC_VERSION });
			const outputDir = options.outputDir ?? this.defaultOutputDir;
			fs.mkdirSync(outputDir, { recursive: true });
			fs.writeFileSync(
				path.join(outputDir, this.filename),
				`${JSON.stringify(this.ctrfReport, null, 2)}\n`,
			);
		});
	}

	private newReport(): CTRFReport {
		return {
			reportFormat: "CTRF",
			runId: this.reporterConfigOptions.runId || undefined,
			specVersion: CURRENT_SPEC_VERSION,
			reportId: randomUUID(),
			timestamp: new Date().toISOString(),
			generatedBy: this.reporterName,
			results: {
				tool: { name: "codeceptjs" },
				summary: {
					tests: 0,
					passed: 0,
					failed: 0,
					pending: 0,
					skipped: 0,
					other: 0,
					start: Date.now(),
					stop: 0,
				},
				tests: [],
				...(this.hasEnvironmentDetails(this.ctrfEnvironment)
					? { environment: this.ctrfEnvironment }
					: {}),
			},
		};
	}

	private on<T extends unknown[]>(
		name: string,
		callback: (...args: T) => void,
	): void {
		event.dispatcher.on(name, callback);
		this.cleanups.push(() => event.dispatcher.off(name, callback));
	}

	private disposeRuntime(): void {
		this.current = undefined;
		this.metadata = {};
		setRuntime();
	}

	/** Detach only this reporter's listeners, useful for repeated runs in one process. */
	dispose(): void {
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups.length = 0;
		this.disposeRuntime();
	}

	private addTestResult(
		test: CodeceptTest,
		status: TestStatus,
		error = test.err,
	): void {
		const suite: string[] = [];
		for (
			let parent = test.parent;
			parent && !parent.root;
			parent = parent.parent
		) {
			if (parent.title) suite.unshift(parent.title);
		}
		const key = test.uid ?? JSON.stringify([test.file, suite, test.title]);
		const attempt = Math.max(
			0,
			Math.trunc(
				Math.max(duration(test.currentRetry?.()), duration(test.retryNum)),
			),
		);
		const existing = this.records.get(key);
		if (existing && attempt <= existing.attempt) return;
		const previous = existing
			? this.ctrfReport.results.tests[existing.index]
			: undefined;
		const elapsed =
			test.duration ??
			test.steps?.reduce((total, step) => total + duration(step.duration), 0) ??
			0;
		const result: Test = {
			testId: testIdentity(
				"codeceptjs",
				{ name: test.title, suite, filePath: test.file },
				this.reporterConfigOptions,
			),
			executionId: previous?.executionId ?? randomUUID(),
			attemptId: randomUUID(),
			name: test.title,
			status,
			duration: duration(elapsed),
		};
		if (!this.reporterConfigOptions.minimal) {
			if (Number.isFinite(test.startedAt) && (test.startedAt ?? -1) >= 0) {
				result.start = test.startedAt;
				result.stop = (test.startedAt ?? 0) + result.duration;
			}
			if (suite.length) result.suite = suite;
			if (test.file) result.filePath = test.file;
			if (test.tags?.length) result.tags = test.tags;
			result.rawStatus = status;
			result.type = this.reporterConfigOptions.testType ?? "e2e";
			if (error && status === "failed") {
				result.message = error.message;
				result.trace = error.stack;
			}
			if (test.steps?.length)
				result.steps = test.steps.map((step) => ({
					name: step.name,
					status: ["passed", "failed", "skipped", "pending", "other"].includes(
						step.status ?? "",
					)
						? (step.status as TestStatus)
						: "other",
				}));
			if (this.current === test && Object.keys(this.metadata).length)
				result.extra = mergeExtra({}, this.metadata);
		}
		if (previous) {
			const history: AttemptHistoryEntry = {
				attempt: existing ? existing.attempt + 1 : 1,
				status: previous.status,
				duration: previous.duration,
				attemptId: previous.attemptId ?? randomUUID(),
				...(previous.start !== undefined
					? { start: previous.start, stop: previous.stop }
					: {}),
				...(previous.message ? { message: previous.message } : {}),
				...(previous.trace ? { trace: previous.trace } : {}),
				...(previous.extra ? { extra: previous.extra } : {}),
			};
			result.retries = attempt;
			result.retryAttempts = [...(previous.retryAttempts ?? []), history];
			result.flaky =
				status === "passed" &&
				result.retryAttempts.some((item) => item.status === "failed");
		}
		if (existing) this.ctrfReport.results.tests[existing.index] = result;
		else {
			this.records.set(key, {
				index: this.ctrfReport.results.tests.length,
				attempt,
			});
			this.ctrfReport.results.tests.push(result);
		}
		if (existing) existing.attempt = attempt;
		const summary = this.ctrfReport.results.summary;
		if (previous) summary[previous.status]--;
		else summary.tests++;
		summary[status]++;
	}

	setEnvironmentDetails(options: ReporterConfigOptions): void {
		if (options.shardId !== undefined)
			this.ctrfEnvironment.shardId = identityValue(options.shardId, "shardId");
		const {
			appName,
			appVersion,
			osPlatform,
			osRelease,
			osVersion,
			buildName,
			buildUrl,
			repositoryName,
			repositoryUrl,
			branchName,
			commit,
			testEnvironment,
		} = options;
		for (const [name, value] of Object.entries({
			appVersion,
			osPlatform,
			osRelease,
			osVersion,
			buildName,
			buildUrl,
			repositoryName,
			repositoryUrl,
			branchName,
			commit,
			testEnvironment,
		})) {
			if (value !== undefined)
				Object.assign(this.ctrfEnvironment, { [name]: value });
		}
		if (appName !== undefined)
			this.ctrfEnvironment.extra = { ...this.ctrfEnvironment.extra, appName };
		if (options.buildNumber !== undefined) {
			const raw = options.buildNumber;
			const number =
				typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
			if (
				typeof number !== "number" ||
				!Number.isSafeInteger(number) ||
				number < 0
			)
				throw new TypeError("buildNumber must be a non-negative safe integer");
			this.ctrfEnvironment.buildNumber = number;
		}
	}

	hasEnvironmentDetails(environment: Environment): boolean {
		return Object.keys(environment).length > 0;
	}
}
