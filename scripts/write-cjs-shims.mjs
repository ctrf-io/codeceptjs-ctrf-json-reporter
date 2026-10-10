import { writeFileSync } from "node:fs";

writeFileSync(
	"dist/index.cjs",
	`"use strict";

const mod = require("./index.generated.cjs");

module.exports = Object.assign(mod.default || mod, {
  GenerateCtrfReport: mod.GenerateCtrfReport,
  ctrf: mod.ctrf,
  extra: mod.extra,
});
`,
);
