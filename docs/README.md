# Beyond ESBuild developer guide

Use this repository to reproduce Beyond's compilation requirements, inspect generated artifacts and graphs, and establish whether a bounded adapter or a compiler change is necessary. Start with [setup](setup.md), then read [the Beyond architecture bridge](beyond-architecture.md) for the responsibilities that must remain separate.

The current delivery is preparation and executed fixture evidence using APIs/adapters. The compiler core is unchanged. Neither the working demo nor these passes establish complete Beyond implementation or production integration; the new implementation task must address the remaining contracts and validate its changes.

## Scenarios

| Scenario | What it exercises | Entry point and evidence |
| --- | --- | --- |
| Beyond-authored module | Four real internal creators, independent shared public dependency, entry API, actual Kernel, CommonJS/ESM consumer updates and native transitive file traversal | [Creator example](../beyond/example/README.md); generated `beyond/.cache/example/report.json` |
| React distribution | Existing React/ReactDOM packages compiled by the fork; public external boundaries, transitive package graph, CommonJS Node SSR and ESM/SystemJS distribution artifacts | [React case](../beyond/react/README.md); generated `beyond/.cache/react/report.json` |
| Express distribution | Existing server package, Node CommonJS/ESM, actual POST/JSON HTTP handling, transitive dependencies and external builtins | [Express case](../beyond/express/README.md); generated `beyond/.cache/express/report.json` |
| Dependency traversal | Independent file-by-file graph path, direct/transitive internal relationships and separate public-module/package-version identities | [Graph contracts](requirements.md), authored `report.json`, external `*.graph.json` |
| Browser composition and styles | Compiled React consumes the authored module; native ESM or actual SystemJS loader; retained-consumer patches; Kernel style registration and separate shadow-root CSS artifacts | [Demo commands](setup.md#browser-demo); generated `beyond/.cache/demo/browser.json` and `browser.png` |
| Compiler capabilities | Import kinds, metadata limits, rebuild graph changes/recovery, CJS interop/descriptors and source maps | [Probe matrix](../beyond/README.md#supporting-probes), [executed validation](validation.md) |
| Upstream regressions | Selected compiler bundler/parser/printer/API/CLI suites | [Regression record](validation.md#upstream-regression-checks) |

Authored CommonJS/ESM execution and patches have passed. React's two Node tests and Express's three Node tests have passed, including real SSR and HTTP requests. Actual Chromium 151.0.7922.34 with Playwright 1.62.1 passed both native ESM and SystemJS browser modes: React interaction, retained-consumer patch `42 -> 43`, internal state `1 -> 2`, distinct computed shadow-root styles, unchanged outer document and no page/network failures. These bounded results do not establish production integration; read [validation](validation.md) for the recorded environment and limits.

## Contracts and implementation references

- [Requirements](requirements.md) traces current Beyond consumers, confirmed contracts, concrete acceptance cases, proposals and unknowns.
- [Compiler audit](compiler-audit.md) maps subsystem responsibilities, actual reading coverage and potential extension points. It is not an exhaustive audit of every source line.
- [Beyond architecture](beyond-architecture.md) explains creator composition, external packages, graph boundaries, adapters, styles and the refactoring gate.
- [Coding standards](coding-standards.md) apply to new Beyond code; upstream, generated and third-party code retain their conventions.
- [Upstream introduction](upstream.md), [architecture](architecture.md) and [development](development.md) explain the underlying compiler and preserve upstream documentation.

Upstream development/publication instructions are retained as reference. Their presence does not authorize publishing this fork; the contributor scope remains in [AGENTS.md](../AGENTS.md).

The `origin` remote is the Beyond fork and `upstream` is `evanw/esbuild`. This work uses `feature/next`; preserve the existing branch and changes when contributing. Fixtures/adapters/tests live in `beyond/`; compiler source retains the upstream layout. Outputs, local dependencies, provenance and browser evidence live under ignored `beyond/.cache/`. The checkout does not override any consumer's installed dependency.

Durable maintained guides and evidence belong in `docs/`; short-lived handoffs and execution plans belong in `docs-temp/`. Preserve lasting decisions in the maintained guides before retiring a temporary document. Canonical onboarding must remain usable when temporary handoffs are removed.
