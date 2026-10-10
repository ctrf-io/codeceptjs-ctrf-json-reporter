# Contributing

First off, thank you for considering contributing to this project.

## Reporting Issues

Before submitting an issue, please check the issue tracker to ensure that the issue hasn't already been reported. If you find your issue already reported, you can subscribe to that issue to receive updates. If you have any additional information to add, please comment on the issue. If the issue is unnasigned and you'd like to contribute, assign the issue to yourself.

## How to Contribute

If you'd like to contribute, start by searching through the issues and pull requests to see whether someone else has raised a similar idea or question.

If you don't see your idea listed, and you think it fits into the goals of this project, do one of the following:

- If your contribution is minor, such as a typo fix, open a pull request.
- If your contribution is major, or you have not yet decided how to implement your idea, open an issue to discuss it. This allows other contributors to point out any potential flaws or to help you flesh out your idea.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. Write some code
3. Make sure your code lints.
4. Issue that pull request!

### Commit Messages

Write meaningful commit messages that provide insight into the changes made.

## Finding Bugs

If you find a bug, please report it in the issue tracker with a detailed description.

## Feature Requests

Feature requests are welcome. But take a moment to find out whether your idea fits with the scope and aims of the project. Please provide as much detail and context as possible.

## License

By contributing to this project, you agree that your contributions will be licensed under MIT.

## Acknowledgments

Your contributions are sincerely appreciated. We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

Thank you for your interest in contributing

## TypeScript compiler tooling

The native TypeScript 7.0.2 compiler is installed through the exact
`@typescript/native` alias and provides `tsc` for compilation and type checks.
The `typescript` alias points to `@typescript/typescript6@6.0.2` so tools that
import the compiler API remain compatible. Keep both development dependencies.

Run `npm run build:check` to check source types with TypeScript 7, and
`npm run all` for the repository checks and build.

## Local verification

Use Node 22.12.0 or newer. CI tests Node 22, 24 and 26; quality and security
stages run on Node 26. Keep direct dependencies, peer dependencies and explicit
security overrides pinned to exact versions. Update the lockfile with changes.

```sh
npm ci
npm run all
npm audit
npm audit --omit=dev
```

`all` runs native TypeScript checks, Biome lint/format, Vitest with V8 coverage,
real CodeceptJS integration scenarios, and isolated packed-consumer checks.
Integration includes an intentional failing scenario: the harness expects the
framework exit code and validates all final outcomes, including a flaky retry.
Packed checks use an isolated temporary project/cache and install the CodeceptJS
peer; they require npm registry access. They verify ESM/CommonJS runtime imports
and both declaration consumers with native TypeScript 7.

The tsup declaration build uses the TypeScript 6 compiler API. Keep its
`ignoreDeprecations` setting scoped to `tsup.config.ts`.

This version removes the old repository-local CTRF type declarations. Use
canonical `ctrf` types and strict 0.2.0 validation in new report tests.
