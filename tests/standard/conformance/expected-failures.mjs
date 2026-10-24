import { AssertionError } from "node:assert/strict";
import { checkCodeceptEntry } from "./codeceptjs-checks.mjs";
import { runExpectedFailure } from "./shared/expected-failures.mjs";
const issue = {
	issue: "native-step-output-rejected",
	reason:
		"Native CodeceptJS actor steps have no name field; producer validation prevents report emission",
	followUp:
		"https://github.com/ctrf-io/codeceptjs-ctrf-json-reporter/issues/26",
	samples: { unit: ["actor-step"], integration: ["actor-step"] },
};
export const expectedFailures = Object.fromEntries(
	[
		"conformance/report/single-json-object",
		"conformance/property/results.tests[].steps",
		"conformance/property/results.tests[].steps[].name",
		"conformance/property/results.tests[].steps[].status",
	].map((id) => [id, issue]),
);
export function expectedFailure(entry, level) {
	return expectedFailures[entry.id]?.samples[level]
		? expectedFailures[entry.id]
		: undefined;
}
export function matchesKnownFailure(_entry, sample, record, error) {
	const failure = sample.emissionFailure;
	const message =
		"CTRF validation failed:\n/results/tests/0/steps/0: must have required property 'name'";
	return (
		record.issue === "native-step-output-rejected" &&
		sample.name === "actor-step" &&
		error instanceof AssertionError &&
		failure?.absentOutput === true &&
		failure.errorType === "ValidationError" &&
		failure.message === message &&
		failure.nativeSteps.length === 1 &&
		failure.nativeSteps[0].name === undefined &&
		failure.nativeSteps[0].title === "check" &&
		failure.nativeSteps[0].helperMethod === "check" &&
		failure.nativeSteps[0].status === "success" &&
		error.message ===
			`${sample.name}: producer rejected native step output: ValidationError: ${message}`
	);
}
export function runConformance(entry, context, level) {
	const record = expectedFailure(entry, level);
	// Only the affected families receive failed-emission evidence. Every other
	// family checks real captured reports. Shared code and IDs stay unchanged.
	const evidence = record
		? {
				...context,
				samples: [...context.samples, ...(context.failedEmissions ?? [])],
			}
		: context;
	return runExpectedFailure(
		entry,
		evidence,
		level,
		record,
		checkCodeceptEntry,
		matchesKnownFailure,
	);
}
