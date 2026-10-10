import GenerateCtrfReport, {
	type ReporterConfigOptions,
} from "./generate-report.js";
export { ctrf, extra } from "./runtime.js";
export type { ReporterConfigOptions } from "./generate-report.js";
export { GenerateCtrfReport };

/** CodeceptJS plugin factory; also remains callable through require(). */
export default function createReporter(
	config: ReporterConfigOptions = {},
): GenerateCtrfReport {
	return new GenerateCtrfReport(config);
}
