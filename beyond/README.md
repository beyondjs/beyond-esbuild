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

## Tests, fixtures and generated output

Every area keeps its own tests, harness modules and fixtures together; the suite-wide rule on test organization and source fixtures applies, with the layout differences stated here.

| Location | Holds | Runs |
| --- | --- | --- |
| `*.test.mjs` in this directory and in each area | Probe and contract tests, identified by case IDs (G1–X1 below, L1–L6 and M1, F1–F4, Y1, K1–K5, E1–E8, B1–B3, and the named React and Express cases) | `node --test <file>`, with the commands in [setup](../docs/setup.md) |
| `demo/verify.mjs`, `packaging/verify.mjs` | Real-browser journeys in Chromium with their assertions | Their own entry, documented in the area guide |
| `fixtures/` inside the consuming area | Permanent source examples, each directory with a README: [example](example/fixtures/README.md), [demo](demo/fixtures/README.md), [graph](graph/fixtures/README.md), [packaging](packaging/fixtures/README.md), [React](react/fixtures/README.md), [Express](express/fixtures/README.md) | Nothing: a harness copies or reads them |
| Harness modules beside the tests (`workspace.mjs`, `toolchain.mjs`, `packaging/process.mjs` and the others each area guide lists) | Temporary workspaces, compiler loading, consumer processes and builds | Nothing on their own |
| `.cache/` and system temporary directories | Generated output of a run | Never checked in |

Harness modules stay beside the tests rather than in a `support/` directory: each area guide lists their roles, and the areas are small. [`Workspace`](workspace.mjs) owns a unique temporary directory; `copy()` places a checked-in fixture there, so a test edits only its copy and the checked-in sources stay unchanged even when a run fails. The React and Express consumers are read from their fixture and evaluated with `node -e` in the build output; the Express CommonJS probe substitutes one expression.

These inputs stay inline, by the narrow exceptions of that rule:

- Probe modules of one to three short files that isolate one compiler or runtime behavior, with their edits: the G1–X1 probes, the creator cases L1–L6 and M1, the F4 cycle, and the K3 and K4 edits to the copied `counter` packages.
- The `@fixture/stateful` installation of B1–B3: three one- or two-line files whose manifest `exports` each case varies.
- Y1's stylesheets, whose edits and assertions depend on their exact content; the checked-in demo stylesheets differ from them (see the [demo fixtures](demo/fixtures/README.md)).
- F1–F3's package manifests, which are data given to `Packages` rather than package directories.
- Generated sources whose content is derived from a build: the host pages of `demo/server.mjs` and `packaging/verify.mjs` (import maps and stylesheet links of the built artifacts), and the React and Express entry facades that `build.mjs` generates from the exports enumerated from the pinned package. Their output can be inspected under `.cache/`.
- The Go regression cases in `internal/bundler_tests/bundler_beyond_test.go` keep upstream esbuild's in-memory `files` map, the convention of every upstream bundler test and its snapshots.

Fixtures are built only by these harnesses: no upstream `Makefile` target, Go package pattern (`./cmd/...`, `./internal/...`, `./pkg/...`) or TypeScript project reads `beyond/`, and Node's test runner selects only `*.test.mjs` files. The manual upstream parser check `scripts/parse-ts-files.js` parses every `.ts` file below the directory it is started from; started at the repository root it parses these fixtures too, which only checks that they parse.

## Test organization and source fixtures

These rules are shared by every Beyond repository.

- Contract/unit and integration tests live in `test/` or `tests/`; complete journeys against an installed, composed or exported product live in `acceptance/`, with a README of their own. Harness infrastructure (servers, registries, process lifecycle, copying and substitution) lives in a `support/` directory of the consuming area.
- Applications, packages, modules, documents and assets a test exercises are checked-in files with their real extensions and directory structure under the consuming area's `fixtures/`. Each fixture group has a README naming its purpose, entry modules, the tests that use it, their command, the expected behavior and any intentionally invalid part. A reader inspects the example without running or decoding a generator.
- A harness copies the fixtures it runs or edits to a unique temporary directory, substitutes only explicit values such as versions, ports or origins, and never writes the checked-in files, even when a run fails. Credentials, machine paths and build output are never fixture source.
- Small input values, expected values, protocol payloads and short edits stay inline. Source is generated only when generation is the behavior under test (size or memory stress, combinations, deliberately malformed input); the guide states why, the parameters that reproduce it and how to inspect what was generated.
- Fixtures stay out of the repository's production compilation, discovery and packaging.
- Migrating a test preserves its scenario identities, its positive, negative and recovery cases and its real execution path; an existing failure stays reported as a failure.

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
2. Add an executable assertion and its source example. An application, package or module of more than a few lines is a checked-in file with its real extension and structure under the consuming area's `fixtures/`, described in that directory's README (purpose, entry modules, which cases use it, expected behavior and any substitution); the test copies it with `Workspace.copy()` and edits only the copy. A probe input of one to three short lines, a short edit or expected data may stay inline. Inspectable generated artifacts belong under `.cache/`.
3. Test an adapter using the current public esbuild API first. Capture the input, actual output and expected Beyond behavior when it cannot meet a confirmed requirement.
4. Record the exact compiler revision, local diff, toolchain, command, pass/fail result and unresolved boundaries in `docs/validation.md`. Passing a test for an expected limitation does not mean the product requirement is satisfied.
5. Necessary targeted compiler changes are authorized when an evidenced requirement in the authored-module, external-package or graph path requires them. Keep public compatibility and regression coverage explicit; this does not justify a broad unrelated rewrite. Commits, pushes, general consumer migration and publication remain outside the authorized work. Preserve upstream licensing and attribution.
