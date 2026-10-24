# Codeceptjs JSON test results report

> Save Codeceptjs test results as a JSON file

A codeceptjs JSON test reporter to create test reports that follow the CTRF standard.

[Common Test Report Format](https://ctrf.io) ensures the generation of uniform JSON test reports, independent of programming languages or test framework in use.

<div align="center">
<div style="padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border: 1px solid #30363d;">
<span style="font-size: 23px;">💚</span>
<h3 style="margin: 1rem 0;">CTRF tooling is open source and free to use</h3>
<p style="font-size: 16px;">Support the project by giving it a follow and a star ⭐</p>

<div style="margin-top: 1.5rem;">
<a href="https://github.com/ctrf-io/codeceptjs-ctrf-json-reporter">
<img src="https://img.shields.io/github/stars/ctrf-io/codeceptjs-ctrf-json-reporter?style=for-the-badge&color=2ea043" alt="GitHub stars">
</a>
<a href="https://github.com/ctrf-io">
<img src="https://img.shields.io/github/followers/ctrf-io?style=for-the-badge&color=2ea043" alt="GitHub followers">
</a>
</div>
</div>

<p style="font-size: 14px; margin: 1rem 0;">

Contributions are very welcome! <br/>
Explore more <a href="https://www.ctrf.io/integrations">integrations</a> <br/>
<a href="https://app.formbricks.com/s/cmefs524mhlh1tl01gkpvefrb">Let us know your thoughts</a>.

</p>
</div>

## Features

- Generate JSON test reports that follow [CTRF](https://ctrf.io)
- Straightforward integration with codeceptjs

```json
{
  "reportFormat": "CTRF",
  "specVersion": "0.2.0",
  "generatedBy": "codeceptjs-ctrf-json-reporter",
  "results": {
    "tool": { "name": "codeceptjs" },
    "summary": {
      "tests": 1, "passed": 1, "failed": 0, "pending": 0,
      "skipped": 0, "other": 0, "start": 1706828654274, "stop": 1706828655782
    },
    "tests": [{ "name": "example", "status": "passed", "duration": 100 }]
  }
}
```

## What is CTRF?

CTRF is a universal JSON test report schema that addresses the lack of a standardized format for JSON test reports.

**Consistency Across Tools:** Different testing tools and frameworks often produce reports in varied formats. CTRF ensures a uniform structure, making it easier to understand and compare reports, regardless of the testing tool used.

**Language and Framework Agnostic:** It provides a universal reporting schema that works seamlessly with any programming language and testing framework.

**Facilitates Better Analysis:** With a standardized format, programatically analyzing test outcomes across multiple platforms becomes more straightforward.

## Installation

```bash
npm install --save-dev codeceptjs-ctrf-json-reporter
```

Add the reporter to your codeceptjs.config.js file:

```javascript
plugins: {
  ctrfJsonReporter: {
    require: 'codeceptjs-ctrf-json-reporter',
    enabled: true,
  },
    // ... other plugins ...
},
```

Run your tests:

```bash
npx codeceptjs run
```

You'll find a JSON file named `ctrf-report.json` in the `ctrf` directory.

## Reporter Options

The reporter supports several configuration options:

```javascript
plugins: {
  ctrfJsonReporter: {
    require: 'codeceptjs-ctrf-json-reporter',
    enabled: true,
    outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
    outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to 'ctrf'.
    appName: 'MyApp',               // Optional: Specify the name of the application under test.
    appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
    osPlatform: 'linux',            // Optional: Specify the OS platform.
    osRelease: '18.04',             // Optional: Specify the OS release version.
    osVersion: '5.4.0',             // Optional: Specify the OS version.
    buildName: 'MyApp Build',       // Optional: Specify the build name.
    buildNumber: 100,             // Optional: Specify the build number.
  }
}
```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name       | Type   | Required | Details                                                                             |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `name`     | String | Required | The name of the test.                                                               |
| `status`   | String | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration` | Number | Required | The time taken for the test execution, in milliseconds.                             |

## Support Us

If you find this project useful, consider giving it a GitHub star ⭐ It means a lot to us.

## Node and framework support

Version 0.1.0 requires Node.js **22.12.0 or newer** and CodeceptJS **4.2.2**.
The package uses ESM internally and publishes ESM and CommonJS entry points,
with declarations included for TypeScript consumers. The callable plugin factory
is preserved for CommonJS configuration. Earlier CodeceptJS 3 and Node 18/20
are outside this version's supported range.

All direct dependencies and the CodeceptJS peer dependency use exact versions.
`ctrf@0.5.0` supplies canonical types and strict specification 0.2.0 validation.
Every written report includes `reportFormat`, `specVersion`, `reportId`,
`timestamp` and `generatedBy`. A validation or filesystem error prevents a
successful report write and is surfaced through CodeceptJS's event handling.

## Configure the plugin

```js
// codecept.conf.cjs
exports.config = {
  tests: "./tests/*_test.js",
  helpers: {},
  plugins: {
    ctrf: {
      enabled: true,
      require: "codeceptjs-ctrf-json-reporter",
      outputDir: "ctrf",
      outputFile: "ctrf-report.json",
      buildNumber: 42
    }
  }
};
```

The same `plugins.ctrf` configuration works in an ESM CodeceptJS configuration.
`outputFile` gains a `.json` extension when the supplied filename lacks it. `minimal: true` writes
required test fields, plus retry history when available. `testType` defaults
to `e2e`. Existing application, OS and build options remain accepted;
`appName` is recorded in `environment.extra.appName` for strict 0.2.0 output.
`buildNumber` accepts a non-negative safe integer or an integer string; invalid
values are rejected. Build/repository URLs, branch, commit and test environment
can also be supplied through the corresponding options.

## Runtime metadata

```js
import { extra, ctrf } from "codeceptjs-ctrf-json-reporter/runtime";

Scenario("example", () => {
  extra({ owner: "qa", labels: ["smoke"] });
  ctrf.extra({ labels: ["critical"] });
});
```

CommonJS consumers can use `require("codeceptjs-ctrf-json-reporter/runtime")`.
Objects merge recursively and arrays concatenate. Calls outside a currently
running test are ignored. Each test attempt gets its own metadata, and earlier
attempt metadata is retained with retry history.

Reports capture available suite hierarchy, tags, file paths, timing, steps and
failure message/stack. Retries replace the earlier outcome in the summary;
`retryAttempts` contains completed attempts before the final attempt. A passing
final attempt after a failure is marked flaky. No browser/device, attachment,
screenshot, stdout or stderr collection is claimed by this version. Framework
integration checks exercise single-process runs; parallel-worker aggregation
is not verified. Use distinct output files for independent concurrent runs.

## Development

Use the commands in [CONTRIBUTING.md](CONTRIBUTING.md). The checks include real
CodeceptJS ESM/CJS plugin loading and packed runtime/declaration consumers.
The local development overrides patch transitive framework/tooling dependencies;
npm does not propagate those overrides into a consumer's installation.

### Consumer dependency audit

Audit the application root after installing the reporter and its CodeceptJS peer.
The reporter checkout uses the tested development overrides below; npm does not
propagate a dependency package's overrides into consumer installations. A clean
checkout audit therefore does not establish a clean application audit. Consumers
that need these transitive patches must add them to their own root `package.json`:

```json
{
  "overrides": {
    "codeceptjs": {
      "@xmldom/xmldom": "0.9.12",
      "axios": "1.20.0",
      "uuid": "14.0.3",
      "mocha": {
        "diff": "9.0.0",
        "serialize-javascript": "7.1.4"
      }
    }
  }
}
```

Refresh the consumer lockfile and rerun its tests/audit after applying overrides.
The framework integration tests exercise these patches in this repository;
application-specific helpers still need verification in the consumer project.
