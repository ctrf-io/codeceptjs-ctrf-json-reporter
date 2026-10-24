const { extra } = require("codeceptjs-ctrf-json-reporter/runtime");
Feature("Native one");
Scenario("passing ✓ @smoke", ({ I }) => {
	extra({ owner: "first", nested: { one: true }, list: ["one"] });
	extra({ owner: "last", nested: { two: true }, list: ["two"] });
	if (process.env.CTRF_ACTOR_STEP === "true") I.check(true);
});
Scenario.skip("skipped", () => {});
let recovery = 0;
Scenario("retry recovery", () => {
	recovery++;
	extra({ attempt: recovery });
	if (recovery < 3 && process.env.CTRF_FIXTURE_PASSED !== "true")
		throw new Error(`recovery attempt ${recovery}`);
}).retry(2);
let exhausted = 0;
Scenario("retry exhausted", () => {
	exhausted++;
	extra({ attempt: exhausted });
	if (process.env.CTRF_FIXTURE_PASSED !== "true")
		throw new Error(`exhausted attempt ${exhausted}`);
}).retry(1);
Scenario("same", () => {});
