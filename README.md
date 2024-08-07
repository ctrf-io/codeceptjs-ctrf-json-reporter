# Codeceptjs JSON test results report

> Save Codeceptjs test results as a JSON file

A codeceptjs JSON test reporter to create test reports that follow the CTRF standard.

[Common Test Report Format](https://ctrf.io) ensures the generation of uniform JSON test reports, independent of programming languages or test framework in use.

## Help us grow CTRF

⭐ **If you find this project useful, please consider following the [CTRF organisation](https://github.com/ctrf-io) and giving this repository a star** ⭐

**It means a lot to us and helps us grow this open source library.**

## Features

- Generate JSON test reports that follow [CTRF](https://ctrf.io)
- Straightforward integration with codeceptjs

```json
{
  "results": {
    "tool": {
      "name": "codeceptjs"
    },
    "summary": {
      "tests": 1,
      "passed": 1,
      "failed": 0,
      "pending": 0,
      "skipped": 0,
      "other": 0,
      "start": 1706828654274,
      "stop": 1706828655782
    },
    "tests": [
      {
        "name": "ctrf should generate the same report with any tool",
        "status": "passed",
        "duration": 100
      }
    ],
    "environment": {
      "appName": "MyApp",
      "buildName": "MyBuild",
      "buildNumber": "1"
    }
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
npm run codeceptjs
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
    buildNumber: '100',             // Optional: Specify the build number.
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
