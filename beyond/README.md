# Beyond ESBuild capability workspace

This directory evaluates the [Beyond ESBuild fork](https://github.com/beyondjs/beyond-esbuild) against Beyond's public-module and internal-module contracts. The upstream MIT license is unchanged; the compiler carries one opt-in change, [assigned CommonJS exports](../docs/cjs-exports.md), which the authored path uses. Nothing here installs the fork into Beyond consumers or publishes a package.

Start with the [setup guide](../docs/setup.md) for all pinned dependencies and commands, and the [architecture guide](../docs/beyond-architecture.md) for native/compiler versus adapter responsibilities. [example/](example/README.md) compiles internal modules into separate creators and composes CommonJS, ESM and System.register public modules. [graph/](graph/README.md) traces source files and joins public-module and package/version graphs without merging them. [react/](react/README.md) packages an existing external React/ReactDOM installation for Node SSR and browser distribution; [express/](express/README.md) validates Node server packaging with real HTTP requests. The browser demo consumes the generated authored and React outputs with modular CSS. [packaging/](packaging/README.md) holds the esbuild packaging mode: authored public modules without creators, the closure of pinned Vue and UI control packages, their Node and Chromium consumers, the adapters they need, and the report of the packages it cannot express as public modules (Svelte, Shoelace components). `package.mjs` lays the prepared compiler out as the unpublished package the Packages trial selects. The creator example and the packaging cases implement different [execution modes](../docs/execution-modes.md); a pass in one is not evidence for the other.

The generic probes below characterize supporting esbuild behavior; conventional ESM bundling alone does not establish compatibility with Beyond's internal-module model. Durable guides belong in `docs/`; runnable sources/tests belong here, and generated evidence stays in `.cache/`.

Read [requirements](../docs/requirements.md) for confirmed contracts, source evidence, acceptance cases, proposals and unknowns. The [compiler audit](../docs/compiler-audit.md) maps the upstream phases and records reading coverage and pending areas. Read [validation](../docs/validation.md) for executed results and their limits.

## Build the compiler under test

Use Node.js 22 or newer and an installed Go toolchain compatible with upstream. From the repository root:

```sh
node beyond/prepare.mjs
node --test beyond/capabilities.test.mjs
```

[toolchain.mjs](toolchain.mjs) loads that compiler, its API and the pinned dependencies for every test; [workspace.mjs](workspace.mjs) owns disposable fixture directories.

`GO=/absolute/path/to/go node beyond/prepare.mjs` selects a toolchain explicitly. Go may download the dependency pinned in the upstream `go.mod`; normal Go cache configuration applies. Preparation always compiles this checkout, then uses that binary to generate its matching JavaScript API from `lib/npm/node.ts`. It writes only ignored `beyond/.cache/` artifacts, including `provenance.json`; it does not use an installed npm esbuild binary. Rerun preparation after compiler changes. The revision in provenance identifies the base commit, not uncommitted source edits: retain the diff with any future test report.

## Supporting probes

| ID | Executed assertion | Boundary |
| --- | --- | --- |
| G1 | Relative files enter the source graph; static, dynamic and same-package bare public references remain external; only entry exports appear in ESM | The fixture sets external-package policy; esbuild does not identify Beyond public modules or resolve package versions |
| E1 | A conventional composed ESM output executes with live entry exports | Supporting control, not the Beyond creator example |
| G2 | An unused TypeScript import is never traversed and is absent from output imports, yet stays on its importer's input record flagged `external` with the written specifier, for relative and bare specifiers alike | The `external` flag alone is neither a public module nor a runtime dependency; `graph/` cross-checks it |
| R1 | Explicit rebuild notices a new internal dependency, rejects a missing input, recovers and removes a stale graph edge | No filesystem watch, transport or client HMR claim |
| C1 | External CommonJS require remains in metadata; directly executing its ESM conversion rejects without an adapter | Expected limitation is asserted as a passing characterization test |
| H1 | Upstream esbuild CommonJS export descriptors are getters and reject deletion/reassignment | The reason the fork adds assigned exports; this probe keeps the default behavior pinned |
| S1 | Maps distinguish nested files with equal basenames and retain source text | Positions after creator wrapping are executed separately by case M1 in `example/creators.test.mjs` |
| X1 | `cjs-module-lexer` reads nothing from upstream getter output, reads names and star re-exports from upstream's `platform: 'node'` annotation, and reads assigned exports directly; the option rejects non-CommonJS formats | Name discovery only; the runtime contract is executed in `example/creators.test.mjs` |

## Add a case or propose a change

1. Cite the current Beyond contract or consumer source in `docs/requirements.md`; label proposed behavior separately.
2. Add a small independent fixture and an executable assertion. Temporary test inputs belong to `Workspace`; inspectable example artifacts belong under `.cache/`.
3. Test an adapter using the current public esbuild API first. Capture the input, actual output and expected Beyond behavior when it cannot meet a confirmed requirement.
4. Record the exact compiler revision, local diff, toolchain, command, pass/fail result and unresolved boundaries in `docs/validation.md`. Passing a test for an expected limitation does not mean the product requirement is satisfied.
5. Necessary targeted compiler changes are authorized when an evidenced requirement in the authored-module, external-package or graph path requires them. Keep public compatibility and regression coverage explicit; this does not justify a broad unrelated rewrite. Commits, pushes, general consumer migration and publication remain outside the authorized work. Preserve upstream licensing and attribution.
