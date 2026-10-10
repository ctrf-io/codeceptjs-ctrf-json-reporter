import { extra } from "../../dist/runtime.js";

Feature("CTRF framework integration");
Scenario("passing scenario @smoke", () => {
	extra({ owner: "integration" });
});
Scenario.skip("skipped scenario", () => {});
let tries = 0;
Scenario("flaky scenario", () => {
	tries++;
	extra({ tries });
	if (tries === 1) throw new Error("first attempt fails");
}).retry(1);
Scenario("failing scenario", () => {
	throw new Error("expected integration failure");
});
