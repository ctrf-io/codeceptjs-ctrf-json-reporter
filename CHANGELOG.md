# Changelog

## 0.1.0 (unreleased)

- Require Node 22.12+ and CodeceptJS 4.2.0. Dependencies are pinned exactly.
- Publish ESM/CommonJS entry points and complete TypeScript declarations;
  preserve the callable CommonJS plugin factory.
- Use ctrf 0.5.0 and emit strictly validated specification 0.2.0 reports.
- Add stable logical test IDs and optional run/shard IDs; preserve execution identity across retries and assign distinct final and historical attempt IDs, including minimal reports.
- Include suite/file/tag/timing/step/error information and final retry outcomes
  with prior-attempt history and flaky classification.
- Add scoped runtime metadata through `extra()` and `ctrf.extra()`.
- Store legacy `appName` under environment extra; normalize build numbers to
  integers and reject invalid values.
- Adopt TypeScript 7, Biome, Vitest/coverage and staged Node 22/24/26 CI, with
  real framework and packed-consumer verification.
