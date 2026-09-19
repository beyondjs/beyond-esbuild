# Beyond ESBuild developer guide

Use this repository to reproduce Beyond's compilation requirements, inspect generated artifacts and graphs, and establish whether a bounded adapter or a compiler change is necessary. Start with [setup](setup.md), then read [the Beyond architecture bridge](beyond-architecture.md) for the responsibilities that must remain separate.

The current delivery is executed fixture evidence using existing APIs and adapters plus one opt-in compiler change, [assigned CommonJS exports](cjs-exports.md); upstream behavior is unchanged when the option is off. Neither the working demo nor these passes establish complete Beyond implementation or production integration; further work must address the [remaining limits](validation.md#remaining-limits) and validate its changes.

Read [execution modes](execution-modes.md) first: the esbuild packaging mode and the unified Kernel/Local runtime mode have different output/update contracts and must be selectable per module in development. Existing creator tests do not establish packaged-mode HMR or mode selection.

## Scenarios

| Scenario | What it exercises | Entry point and evidence |
| --- | --- | --- |
| Beyond-authored module | Four real internal creators compiled with the fork's [assigned CommonJS exports](cjs-exports.md), independent shared public dependency, entry API, actual Kernel, CommonJS/ESM consumer updates and composed source maps | [Creator example](../beyond/example/README.md); generated `beyond/.cache/example/report.json` |
| Creator contract cases | Live bindings, default and re-exports, runtime cycle rejection, update lifecycle and executed source-map positions against the actual Kernel | `beyond/example/creators.test.mjs`; [validation](validation.md#creator-contract-cases) |
| React distribution | Existing React/ReactDOM packages compiled by the fork, including `react/jsx-runtime`; public external boundaries, manifest-joined package/version edges, CommonJS Node SSR and ESM/SystemJS distribution artifacts | [React case](../beyond/react/README.md); generated `beyond/.cache/react/report.json` |
| Express distribution | Existing server package, Node CommonJS/ESM, actual POST/JSON HTTP handling, transitive dependencies and external builtins | [Express case](../beyond/express/README.md); generated `beyond/.cache/express/report.json` |
| Dependency traversal | Three separate graphs: source files with direct, transitive, erased edges and cycles; public-module edges with importer and kind; package/version edges and diagnostics joined from manifests | [Graph contracts](beyond-architecture.md#three-graph-identities), `beyond/graph/`, authored `report.json`, external `*.graph.json` |
| Browser composition and styles | Compiled React consumes the authored module; native ESM or actual SystemJS loader; retained-consumer patches; Kernel style registration, separate shadow-root CSS artifacts and stylesheet replacement through the Kernel change contract; dependency invalidation and failure recovery in `beyond/demo/styles.test.mjs` | [Demo commands](setup.md#browser-demo); generated `beyond/.cache/demo/browser.json` and `browser.png` |
| esbuild packaging mode | Authored public modules bundled with bare public references and no Beyond runtime: production execution, re-exports through an independent public module in ESM and CommonJS, development re-addressing through the public graph, shared-state rules, minified source maps | [Packaging guide](packaging.md); `beyond/packaging/packaging.test.mjs` (K1–K5) |
| Published package coverage | Pinned Vue, Radix, Headless UI and Lit with React, each public module compiled on its own; Svelte and Shoelace components are reported as unsupported because their public modules share private files: published JavaScript, framework source adapters, conditional exports, subpaths, CommonJS input, peer dependencies, styles, minification; Node SSR and real Chromium for native ESM and the System.register adapter | [Coverage](packaging.md#package-coverage); `beyond/packaging/ecosystem.test.mjs` (E1–E8), `beyond/packaging/boundaries.test.mjs` (B1–B3), `beyond/packaging/verify.mjs`; generated `beyond/.cache/packaging/` |
| Packages trial | The fork selected explicitly by a new `esbuild` bundler in Packages: resolved compiler identity, per-module mode selection in both directions, production distribution, watched development rebuild and its reload boundary | [Trial record](packaging.md#packages-trial); `tests/esbuild-packaging/` in the Packages repository |
| Compiler capabilities | Import kinds, erased-import metadata, rebuild graph changes/recovery, CJS interop/descriptors, lexer visibility and source maps | [Probe matrix](../beyond/README.md#supporting-probes), [executed validation](validation.md) |
| Compiler regressions | Every upstream Go test package with unchanged snapshots, plus the fork's own bundler suite | [Regression record](validation.md#compiler-regression-checks) |

The authored runner, 25 Node tests and all 16 Go test packages have passed against the modified compiler, including real SSR and HTTP requests. Actual Chromium 151.0.7922.34 with Playwright 1.62.1 passed both native ESM and SystemJS browser modes: React interaction through the packaged JSX runtime, retained-consumer patch `42 -> 43`, internal state `1 -> 2`, distinct computed shadow-root styles, stylesheet replacement, unchanged outer document and no page/network failures. These bounded results do not establish production integration; read [validation](validation.md) for the recorded environment and limits.

## Contracts and implementation references

- [Requirements](requirements.md) traces current Beyond consumers, confirmed contracts, concrete acceptance cases, proposals and unknowns.
- [esbuild packaging mode](packaging.md) records the packaged output contract, its adapters, the state hazards found by execution, re-export and update behavior, package coverage, the format assessment, the Packages trial and the remaining work.
- [Assigned CommonJS exports](cjs-exports.md) documents the fork's compiler change: contract, measured alternatives, emitted code, implementation map and limits.
- [Compiler audit](compiler-audit.md) maps subsystem responsibilities, actual reading coverage and potential extension points. It is not an exhaustive audit of every source line.
- [Beyond architecture](beyond-architecture.md) explains creator composition, external packages, graph boundaries, adapters, styles and the refactoring gate.
- [Coding standards](coding-standards.md) apply to new Beyond code; upstream, generated and third-party code retain their conventions.
- [Upstream introduction](upstream.md), [architecture](architecture.md) and [development](development.md) explain the underlying compiler and preserve upstream documentation.

Upstream development/publication instructions are retained as reference. Their presence does not authorize publishing this fork; the contributor scope remains in [AGENTS.md](../AGENTS.md).

The `origin` remote is the Beyond fork and `upstream` is `evanw/esbuild`. This work uses `feature/next`; preserve the existing branch and changes when contributing. Fixtures/adapters/tests live in `beyond/`; compiler source retains the upstream layout, and fork-specific compiler code is marked `Beyond ESBuild` in place. Outputs, local dependencies, provenance and browser evidence live under ignored `beyond/.cache/`. The checkout does not override any consumer's installed dependency.

Durable maintained guides and evidence belong in `docs/`; short-lived handoffs and execution plans belong in `docs-temp/`. Preserve lasting decisions in the maintained guides before retiring a temporary document. Canonical onboarding must remain usable when temporary handoffs are removed.
