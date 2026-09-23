# Executed capability evidence

**Scope clarification:** recorded creator/Kernel update passes establish that fixture's runtime-composition behavior. They do not validate esbuild-packaged development HMR, per-module mode selection, the unified `local-2026` integration or production adoption. See [execution modes](execution-modes.md); historical results below remain unchanged.

Three deliveries are recorded. The [second delivery](#second-delivery-compiler-change-and-remaining-contracts) modified the compiler, and every first-delivery result was reproduced before that change and rerun after it. The [third delivery](#third-delivery-packaging-mode-package-coverage-and-packages-trial) changed no compiler source: it adds the esbuild packaging mode, the published-package coverage and the Packages trial. The first-delivery sections are kept as the record of the unmodified upstream compiler; where they say that no compiler modification was made, they describe that delivery only. Passing fixtures and the browser demo do not establish complete Beyond implementation or production integration.

## Compiler and environment

- Fork: <https://github.com/beyondjs/beyond-esbuild>, verified GitHub fork parent/source `evanw/esbuild`.
- Base: `f6058f8364fe7ab91ca57a83e02577ed74c9cae4`, identical to upstream `main` when checked on 2026-09-18.
- Compiler version: `0.28.2`; built from this checkout's unchanged upstream source.
- Node.js: `v22.21.1`; Go: `go1.27.1 darwin/arm64`.
- Executable assessment code was added under `beyond/`, with maintained guides/instructions and a Beyond-specific root README. No compiler implementation or license was modified; the upstream introduction is retained in `docs/upstream.md`.

The toolchain was downloaded from the official Go distribution to a temporary directory, verified using its published SHA-256, and used without global installation. Subsequent users may use their own compatible Go installation.

## Supporting probe run

Portable equivalents of the executed commands are shown below. The recorded run selected Go and writable caches explicitly; physical executable/cache locations are intentionally omitted. Use Go on `PATH` or the documented `GO` override for preparation.

```sh
node beyond/prepare.mjs
node --test beyond/capabilities.test.mjs
```

Result: **7 tests passed, 0 failed, 0 skipped**. See [the probe matrix](../beyond/README.md#supporting-probes) for the exact assertions.

Three constraints are demonstrated by expected-limitation assertions: unused TypeScript imports may not appear in the metafile, external CommonJS require needs runtime adaptation even with ESM output, and CommonJS export getters are not mutable legacy creator exports. These findings justify focused adapter evaluation; they do not yet establish that esbuild compiler-core changes are required.

No Packages application acceptance, CDN integration, browser HMR, watcher lifecycle, source-map position accuracy after wrapping, performance target or consumer migration is claimed by this run. The creator example records its own runtime evidence separately.

## Upstream regression checks (first delivery)

Executed against the same unchanged compiler and temporary Go caches. Portable equivalent with the selected Go toolchain on `PATH`:

```sh
go test \
  ./internal/bundler_tests ./internal/js_parser ./internal/js_printer ./pkg/api ./cmd/esbuild
```

Result: **all five Go test packages passed**. These exercise upstream bundling, JavaScript parsing/printing, public Go API behavior and the executable entrypoint. This is a bounded regression run, not the full upstream test matrix or cross-platform certification.

## Final integrated run (first delivery)

The pinned isolated dependency installation was executed, including Kernel 0.1.12, cjs-module-lexer 2.1.0, TypeScript 5.8.3, React/ReactDOM 19.2.0, SystemJS 6.15.1 and Express 5.1.0. Final commands from the fork root:

```sh
node beyond/example/run.mjs
node --test beyond/capabilities.test.mjs beyond/react/react.test.mjs beyond/express/express.test.mjs
node beyond/demo/build.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/demo/verify.mjs
```

Result: **authored CommonJS/ESM runner passed; 12 Node tests passed, 0 failed/skipped; real Chromium verification passed for both ESM and SystemJS.** React and Express tests rebuild their external-package artifacts. The browser used Playwright 1.62.1 and Chromium 151.0.7922.34. On this machine Playwright was selected from the bundled tooling installation; no browser success was inferred from textual artifact checks.

| Acceptance slice | Executed result |
| --- | --- |
| Beyond authored module | Four independent creators, a separate shared public module, entry exports, actual Kernel 0.1.12; retained-consumer patches in Node CJS/ESM and browser ESM/SystemJS |
| React package | Generated CJS SSR with hooks in a fresh Node process; React 19.2.0 actually renders and updates state in both browser formats using generated external-package artifacts |
| Express package | Generated CJS and ESM each handle a real HTTP JSON POST through route parameters/middleware; external builtins and transitive dependency inventory checked |
| Dependency graphs | Native esbuild file traversal with direct/transitive edges; classified internal/public references; package/version records kept separate; no general Beyond version resolver claimed |
| Modular CSS | Fork-built independent app/shared CSS, app -> palette input edge, actual Kernel style registration and HTTP serving; computed styles distinct in two shadow roots and unchanged in the document |
| Browser diagnostics | No page errors or failed artifact responses; retained-consumer answer 42 -> 43, internal counter 1 -> 2; React interaction passed; 390px layout has no horizontal overflow |

Inspect generated evidence under `beyond/.cache/`: `example/report.json`, `react/report.json` and `*.graph.json`, `express/report.json` and `*.graph.json`, `demo/styles.graph.json`, `demo/browser.json`, `demo/browser.png`, and `demo/mobile.png`. The desktop screenshot was visually inspected. The verifier starts and closes its own HTTP server/browser. A separate `node beyond/demo/server.mjs` session serves the page for manual inspection.

## Remaining implementation boundaries (first delivery)

This ledger is what the second delivery started from; its outcome per row is in [ledger outcome](#ledger-outcome).

### Reproduced failures, fixture adaptations and open gaps

| Observed failure or limitation | What the fixture does | What remains to implement or validate |
| --- | --- | --- |
| `cjs-module-lexer` 2.1.0 reports no exports for the tested esbuild helper-based CJS output | Uses a separate ESM metadata pass for the tested named exports | Default/star/re-exports, arbitrary CJS shapes, cycles and export discovery beyond this fixture |
| esbuild-generated CJS export getters reject deletion/reassignment required by the selected legacy creator model | Copies values into the Kernel export proxy after creator evaluation | Later mutable live bindings and general update semantics; copying values is not full ESM equivalence |
| esbuild does not emit System.register natively | Converts the outer ESM envelope with TypeScript 5.8.3 and executes the result with SystemJS | Broader conversion semantics and source-map/interop cases; this is not native compiler support |
| Direct execution of tested CJS external require in ESM rejects without adaptation | Supplies explicit external interop wrappers in the package cases | Other package export shapes, computed imports and runtime conditions |

The new implementation agent has substantive work: reproduce the baseline, extend tests that can expose demo false positives, obtain concrete reproductions of the owner's reported conflicts, resolve confirmed gaps and decide between APIs, adapters and compiler-core changes from evidence. Neither necessity nor absence of future core changes is established by this preparation. These documentation corrections do not initiate that implementation.

These required fixture paths work through the public fork API plus explicit adapters; no core fix was necessary to pass them. SystemJS is TypeScript envelope conversion, not a native esbuild output. Creator export copying has snapshot limits for arbitrary later mutations. Complete cycles, default/star re-export policies, export-shape changes, automatic HMR/watch transport, lifecycle/rollback, composed source-map positions, general package-version solving, Sass/Tailwind and CSS replacement/recovery remain unvalidated. Express is Node-only. The simple loopback server is a distribution proof, not production CDN integration. Necessary future compiler fixes are authorized when concrete cases establish the need; no blanket compatibility guarantee is made.

## Documentation and repository checks (first delivery)

An independent final documentation consistency review found no required corrections. All 63 local links/anchors checked in the Beyond-authored fork guides resolved. First-party JavaScript modules passed syntax checks, all new source files were below 300 lines and whitespace checks passed. The upstream introduction body was compared to the base README: it is preserved with adjusted image paths and a provenance preface. Compiler implementation and license files remain unchanged. These checks validate this delivery's organization and provenance, not exhaustive upstream source correctness.

## Second delivery: compiler change and remaining contracts

Executed 2026-09-18 in the same environment: Node.js `v22.21.1`, Go `go1.27.1 darwin/arm64`, Playwright 1.62.1 with Chromium 151.0.7922.34. The checkout was at `4559612a348fd0aa3d49a60e2bef6ed674852d45`, the first delivery committed on top of upstream `f6058f83`. The compiler and fixture changes of this delivery were uncommitted working changes at execution time, so the recorded `beyond/.cache/provenance.json` named that commit and not the modified sources. They were committed afterwards with owner authorization: the compiler change as `6241fc5ab536419a293529b85a05cf4f0e191fbf`, then the fixtures, tests and guides in the commit that contains this record. The final rerun before committing, after factoring one duplicated condition in `internal/linker/cjs_assign_exports.go`, gave the same results. The dependency installation added `semver@7.5.4` to the pinned list.

The first-delivery baseline was reproduced first, unchanged: runner passed, 12 of 12 Node tests, Chromium ESM and SystemJS.

### Ledger outcome

| First-delivery row | Outcome |
| --- | --- |
| Lexer reports no exports for esbuild CommonJS | **Resolved.** [Assigned CommonJS exports](cjs-exports.md) are lexer-readable, including default, named and star re-exports (X1, L2, L3). Separately observed: upstream's `platform: 'node'` annotation already exposes names and star re-exports for getter output |
| Getter exports reject the delete/refill creator model; values were copied as snapshots | **Resolved by a compiler change**, after a copying adapter, a getter adapter and a second TypeScript pass were each shown insufficient. Live reassigned exports, defaults and updates are executed (L1, L2, L6). Re-exports keep TypeScript's accessor boundary (L3, L4) |
| System.register is not an esbuild format | **Unchanged: still an explicit TypeScript adapter**, executed by the real SystemJS loader in Chromium. New: its source map is chained to the original sources (M1). No native support is claimed or was attempted |
| External CommonJS `require` in ESM needs adaptation | **Unchanged: explicit facades.** Extended to `react/jsx-runtime`, consumed by the browser demo and SSR. Computed requires and other export shapes remain open |

No reproduction of an owner-reported conflict other than these rows exists in the repository, so none beyond them was addressed.

### Compiler regression checks

```sh
go vet ./internal/linker ./internal/js_printer ./internal/runtime ./internal/config ./pkg/api ./pkg/cli
go test -count=1 ./internal/... ./pkg/... ./cmd/...
node beyond/.cache/runtime/node_modules/typescript/bin/tsc -noEmit -p lib/tsconfig.json \
  --typeRoots beyond/.cache/lib-types/node_modules/@types
```

Result: **vet clean; all 16 Go packages that have tests passed uncached**, including `internal/bundler_tests` with every upstream snapshot unchanged plus the fork's three `TestBeyond*` cases; `lib/` type-checks; `gofmt -l` lists none of the changed files. An intermediate placement of the new runtime helper changed the chunk hashes of two upstream splitting snapshots; the helper was moved rather than the snapshots refreshed. Not run: upstream `scripts/` JavaScript API, plugin, end-to-end, source-map, WASM, browser and Yarn PnP suites, other operating systems and `make` targets. The type check used TypeScript 5.8.3, not upstream's pinned 6.0.2.

### Node and browser run

```sh
node beyond/prepare.mjs
node beyond/example/run.mjs
node --test beyond/capabilities.test.mjs beyond/example/creators.test.mjs beyond/graph/graph.test.mjs \
  beyond/demo/styles.test.mjs beyond/react/react.test.mjs beyond/express/express.test.mjs
node beyond/demo/build.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/demo/verify.mjs
```

Result: **authored runner passed; 25 Node tests passed, 0 failed, 0 skipped; real Chromium passed both formats.**

### Creator contract cases

All against the actual `@beyond-js/kernel@0.1.12`, creators compiled by the fork with `cjsExports: 'assign'`, consumed as ESM and CommonJS from disposable packages.

| Case | Executed assertion |
| --- | --- |
| L1 | `count++` in one creator is read live by another, and an assignment to a public `let` reaches the original ESM namespace and CommonJS object |
| L2 | A default class crosses creators; a public default function is replaced by an update in both module systems |
| L3 | `export *` and named re-exports of internals define the public API, excluding `default`; a re-exported binding is a live accessor internally but is not pushed to the public binding |
| L4 | Replacing a creator that re-exports throws `TypeError` in the Kernel and leaves the loaded value untouched: the boundary TypeScript output has |
| L5 | The Kernel rejects a cycle between internal modules with its recursive-load trace |
| L6 | An update adds an internal module while an untouched one keeps its state; a source that does not compile produces no update; sequential updates arrive in order with one `change` event each; a loaded ES module does not gain a new export although the runtime holds its value |
| M1 | Child Node processes with `--enable-source-maps` report `nested/fail.ts:4:9` and `index.ts:2` for an error thrown inside a creator, through the published ESM and CommonJS maps, with a non-ASCII line before the code; the chained System.register map resolves the same statement to zero-based line 3, column 2, with `sourcesContent` |

### Other acceptance slices

| Slice | Executed result |
| --- | --- |
| Compiler option | X1: the lexer reads assigned exports and the star re-export; upstream getters yield nothing; a non-CommonJS format is rejected. Go snapshots cover convert-format, bundle and CommonJS-source entries |
| Authored example | The public module holds four creators, no `module.exports` and no getter helpers; lexer names equal ESM metadata names; maps are emitted for `.mjs`, `.cjs` and `.system.js`; patches 42 -> 43 keep identity and state in both module systems |
| Three graphs | F1 direct, transitive and erased file edges; F2 public edges with importer, kind, lazy flag, same-package subpath and an erased bare import; F3 `builtin`/`external`/`workspace`/own classification, a single package edge, and `DEPENDENCY_INCOMPATIBLE`, `DEPENDENCY_NOT_DECLARED`, `MODULE_NOT_FOUND`; F4 cycle report; G2 the metafile erased-import finding |
| React | SSR in a fresh process through the packaged `react/jsx-runtime`, loading only built files; package edges `react-dom -> react` (peer, `^19.2.0`, public) and `react-dom -> scheduler` (`^0.27.0`, bundled), both satisfied; four System.register artifacts |
| Express | Real HTTP JSON POST in CommonJS and ESM; more than 20 transitive package edges, each declared and satisfied by the installed version |
| Modular CSS | Y1: a palette change invalidates only the importing module, the independent stylesheet stays byte-identical, a missing import keeps the last good artifact and graph, a fix recovers. Browser: after a rebuild, the Kernel `change()` contract requests `app.css?version=1`, the app shadow root becomes `rgb(122, 31, 92)`, shared and document colors are unchanged, and one stylesheet link remains |
| Browser | Both formats render React 19.2.0 through the packaged JSX runtime, update state, apply the creator patch 42 -> 43 with counter 1 -> 2, with no page errors, no failed responses and no horizontal overflow at 390px. The desktop screenshot was inspected |

Generated evidence under `beyond/.cache/`: `example/report.json` (including `graphs`), `example/node_modules/@fixture/app/main.{mjs,cjs,system.js}` with their `.map` files, `example/patch.*`, `react/report.json` and `*.graph.json` (with `packageEdges`), `express/report.json` and `*.graph.json`, `demo/styles.graph.json`, `demo/browser.json`, `demo/browser.png` and `demo/mobile.png`. The verifier restores the pristine stylesheets when it finishes.

### Remaining limits

- Re-exports in creators are not pushed to public bindings and are not replaceable in place (L3, L4). A proposal is recorded in [requirements](requirements.md#proposals-to-evaluate-not-approved-compiler-changes); nothing was approved.
- Public shape changes require a reload, removed internal modules stay registered in the Kernel, and the Kernel rejects cycles. These are runtime contracts, asserted rather than changed.
- Updates are applied by importing a patch explicitly. No filesystem watcher, notification transport, reconnect, rollback, disposal or stale asynchronous publication is implemented or claimed, and only the demo control calls `change()` on a stylesheet.
- Graphs omit `import type` and computed specifiers. The package graph mirrors Packages' validation over explicit manifests and installed versions; it selects and solves nothing.
- Browser devtools and coverage tools were not exercised with the maps. Assigned exports were not exercised with minification, splitting, ES5 lowering or IIFE output; see [the option's limits](cjs-exports.md#limits).
- CSS is plain CSS only: no Sass, Tailwind, CSS Modules or Widgets controllers.
- Express is Node-only. The loopback server is a distribution proof, not the production CDN. No Packages service, CDN or consumer was migrated to this fork, and nothing in this delivery was pushed or published; it is committed locally on `feature/next` only.

## Third delivery: packaging mode, package coverage and Packages trial

This section is the record of that delivery as executed. Its split build, case E6 as listed here and the `BEYOND_COHESION` control were later removed; [the architecture correction](#architecture-correction-public-modules-as-the-only-division) records what replaced them. The results below are kept as evidence, including the negative control, which is the recorded failure of Svelte when its public modules are compiled separately.

Executed 2026-09-18 in the same environment: Node.js `v22.21.1`, Go `go1.27.1 darwin/arm64`, Playwright 1.62.1 with Chromium 151.0.7922.34, SystemJS 6.15.1, TypeScript 5.8.3. The checkout was at `7efe3fb4fdd10d894a04fc911fb200d4c02d8458` with this delivery's fixtures, tests and guides as working changes, committed afterwards with owner authorization in the commit that contains this record; no Go or `lib/` source changed, and `beyond/.cache/provenance.json` was regenerated at that revision before the runs. Contracts, findings and limits are in [the packaging guide](packaging.md); this section is the run record. None of it is acceptance of the unified-runtime mode, and the creator cases above remain legacy Kernel evidence only.

### Commands and results

```sh
node beyond/prepare.mjs && node beyond/package.mjs
go vet ./internal/... ./pkg/... ./cmd/...
go test -count=1 ./internal/... ./pkg/... ./cmd/...
node beyond/example/run.mjs
node --test beyond/capabilities.test.mjs beyond/example/creators.test.mjs beyond/graph/graph.test.mjs \
  beyond/demo/styles.test.mjs beyond/react/react.test.mjs beyond/express/express.test.mjs \
  beyond/packaging/packaging.test.mjs beyond/packaging/ecosystem.test.mjs
node beyond/demo/build.mjs && PLAYWRIGHT=/absolute/path/to/playwright node beyond/demo/verify.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/packaging/verify.mjs
```

| Check | Result |
| --- | --- |
| `go vet`, every Go test package | Clean; 16 of 16 packages `ok`, upstream snapshots unchanged |
| Second-delivery runner, Node tests and demo verification | Runner `PASS`; the 25 earlier tests pass; Chromium ESM and SystemJS demo `PASS` |
| `packaging.test.mjs` | 5 of 5 (K1–K5) |
| `ecosystem.test.mjs` | 7 of 7 (E1–E7) |
| `beyond/packaging/verify.mjs` | `PASS browser.production native ESM`, `PASS browser.development native ESM`, `PASS browser.production System.register adapter + SystemJS`; 85 module requests each, no failed request, no page or console error |
| Negative control `BEYOND_COHESION=off` | Fails as expected: the page never becomes ready, `Cannot read properties of undefined (reading 'call')` |
| Packages trial, `tests/esbuild-packaging/index.mjs` in the Packages checkout | 7 of 7 steps; compiler reported as `0.28.2`, fork revision `7efe3fb4`, `assigned: true`, against the installed `0.25.9` |
| Packages stage-1 validation | 21 of 21 before the Packages changes and after them, and again, with the trial at 7 of 7, after the suite fixture moved to `testbed/module-updates/`. One intermediate run reported 20 of 21: its recovery step waits for two filesystem events inside a fixed window; it passed again with no change |

### Cases

| Case | Established |
| --- | --- |
| K1 | A packaged public module, its facade and its value module execute in a process that cannot resolve any Beyond runtime; the consumer's only reference is the bare public specifier; its internal files are inputs only |
| K2 | Star, named, default and internal re-exports of a reassigned binding are live through an independent consuming public module in native ESM, native CommonJS and assigned CommonJS |
| K3 | Content-only identity leaves the re-exporting module's address unchanged after a dependency edit; the closure identity re-addresses the changed module and its public dependents and nothing else; a new import observes the change; the loaded consumer does not, and both generations keep separate state |
| K4 | A relative import of another public entry of the package becomes a public reference with one state; a shared file that is not public is copied into both modules, asserted as a limit |
| K5 | The external map of the minified artifact resolves a throw to `main/index.ts:8:9` |
| E1–E2 | Vue SFC with a Headless UI control and a Svelte component render on Node from packaged artifacts |
| E3 | Conditional exports follow platform and environment, read from reports and executed through `esm-env` |
| E4 | CommonJS inputs use named adapters; more than 60 ESM artifacts use none; Vue's public star re-export stays native |
| E5 | Over 100 package edges per target are declared and satisfied; nothing unsupported; no import-map scope needed |
| E6 | Svelte and Shoelace subpaths come from one split build per package; a published sibling is a reference |
| E7 | Production artifacts are less than half the development bytes |

### Remaining limits of this delivery

- No update reaches a running consumer in the packaging mode. Rebuild, re-addressing and the reload boundary are executed; notification, delivery, replacement, style replacement, ordering and rollback do not exist. A successful rebuild is not HMR.
- The Packages trial is Node only and unreviewed; it is committed locally in Packages as `dbfd08f`. Its bundler compiles one module at a time: it has no closure identity, no cohesion pass, no framework or CommonJS adapters and no published-package distribution. Packaged artifacts produced by Packages were not executed in a browser.
- Per-module selection was executed for two modules in both directions. Switching the mode of a module that is already running is unspecified. The unified runtime (`local-2026`) was not involved: composed modules ran on the legacy Kernel.
- Package coverage is the pinned list. The unsupported and uncovered cases are listed in [the packaging guide](packaging.md#package-coverage). Import-map scopes for nested versions are implemented but no installed tree exercised them.
- The System.register adapter run does not chain source maps. IIFE output was not exercised. The upstream JavaScript, WASM and end-to-end scripts were again not run; they are unaffected by this delivery, which changes no compiler source.
- Nothing was pushed or published, and no consumer was migrated. The fork, Packages and suite changes are local commits on `feature/next`.

## Architecture correction: public modules as the only division

Executed 2026-09-18, after the third delivery, in the same environment and with the same fork build (`0.28.2`, revision `7efe3fb4`; no compiler source changed). The owner established that Beyond divides executable code by public module only, so the split build was removed rather than carried into Packages. [The packaging guide](packaging.md#shared-state-between-public-modules) describes the resulting behavior.

What changed: `cohesive.mjs` and the `cohesion` option are gone; `Distribution` compiles every public module on its own, gives one artifact to public subpaths that resolve to one file, and reports and withdraws packages whose public modules share private files (`shared.mjs`); `Ecosystem` reports the authored modules those packages block; the System.register conversion moved to `system.mjs` and now chains its source maps with the existing `Chain` of `beyond/example/maps.mjs`, which the third delivery recorded as missing; `verify.mjs` no longer drives Svelte or Shoelace.

```sh
node --test beyond/capabilities.test.mjs beyond/example/creators.test.mjs beyond/graph/graph.test.mjs \
  beyond/demo/styles.test.mjs beyond/react/react.test.mjs beyond/express/express.test.mjs \
  beyond/packaging/packaging.test.mjs beyond/packaging/ecosystem.test.mjs beyond/packaging/boundaries.test.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/packaging/verify.mjs
```

| Check | Result |
| --- | --- |
| All nine Node test files | 41 of 41: the 30 earlier tests outside `ecosystem.test.mjs`, E1–E8 and B1–B3 |
| `beyond/packaging/verify.mjs` | `PASS` for `browser.production` native ESM, `browser.development` native ESM and `browser.production` through the System.register adapter with SystemJS; 43 module requests each, no failed request, no page or console error, no request for a chunk or for a withdrawn module |
| Not run again | `go vet`, the Go test packages, the second-delivery runner and the demo verification: no Go source and none of their inputs changed |

| Case | Established |
| --- | --- |
| E2 (replaced) | The Svelte fixture modules are reported as blocked, are absent from the import map, and loading one is refused with `ERR_MODULE_NOT_FOUND` rather than half loaded |
| E5 (changed) | `unsupported` names exactly `svelte@5.57.0` and `@shoelace-style/shoelace@2.20.1`; the edge assertions are unchanged |
| E6 (replaced) | A published sibling is a public reference; `esm-env/development` and `esm-env/node` are one artifact with two names and one URL in the import map; no artifact records splitting or chunks; every `.mjs` on disk is a published public module; Svelte's shared files include `internal/client/runtime.js`, Shoelace's are all under `dist/chunks/`, and none of their artifacts is written or mapped |
| E8 | The System.register tree has the same modules as the native one, and each converted module declares exactly the public references of its ES module, all of them bare. The position of `litHtmlVersions` in the converted `lit-html` module maps to the line that holds it in `node_modules/lit-html/src/lit-html.ts`, the TypeScript source the published JavaScript itself maps to |
| B1 | Regression guard: two public modules that each bundle one private stateful file hold different state objects (`a, a, b` counts `1, 2, 1`), and `Distribution` reports that package and offers neither module |
| B2 | When the package publishes the shared file, both modules reference it, bundle only their own entry and share one state (`1, 2, 3` through the three modules) |
| B3 | `lit-html` has the same address, bytes, exports and references packaged alone or together with `lit` and a directive, which reach it through the bare reference and hold no copy. Every module is now compiled on its own, so this holds by construction; the case exists to stop a joint build from returning |

Executed the same day in the Packages checkout, and committed there locally as `9922676` with the development runtime as `169d712` in its own repository: the packaging trial at 8 of 8 with the relative and `env:` compiler selection; stage-1 at 21 of 21 after the runtime became a bundler setting; and the unified-runtime validation at 6 of 6 and 7 of 7, in which Packages compiles the development runtime with this fork (`0.28.2`, `assigned: true`, selected as `env:BEYOND_ESBUILD_COMPILER`). Their guides are in that repository. The fork package reports revision `7efe3fb4`: it was laid out before the last fork commit, and no compiler source changed since.

Consequences for the record above: Svelte, both as published JavaScript and as component source, and Shoelace components consumed by subpath moved from covered to **unsupported**. No solution compatible with public module identity is established for them. The third-delivery limit that names a missing "cohesion pass" in the Packages trial no longer describes work to do.

## Source fixtures as checked-in files

Executed 2026-09-22 with Node.js `v22.21.1` on the prepared fork build of `beyond/.cache/` (`0.28.2`, provenance revision `7efe3fb4`; no Go or `lib/` source changed since, and Go was not on `PATH`, so preparation was not rerun). The checkout was at `32f5cf0e` with this change as working changes. No compiler source, upstream test or snapshot changed.

What changed: the multi-file sources the tests used to write from strings are checked-in files under the consuming area's `fixtures/`, each directory with a README, and [the workspace guide](../beyond/README.md#tests-fixtures-and-generated-output) records the layout and the inputs that stay inline. `Workspace.copy()` places a fixture in the test's temporary directory; edits apply only to that copy.

| Old inline source | Checked-in fixture | Cases | Preserved |
| --- | --- | --- | --- |
| The `Fixture` constructor and `counter` string of `packaging.test.mjs` (3 manifests, 9 sources) | `beyond/packaging/fixtures/counter/` | K1–K5 | Byte-identical files; K3's `step.ts` rewrite and K4's appended re-export apply to the copy, K4's edited file byte-identical to before |
| `module(workspace)` of `graph.test.mjs` (5 sources) | `beyond/graph/fixtures/module/` | F1–F3 | Byte-identical files |
| The `node -e` consumer of `express.test.mjs` | `beyond/express/fixtures/consumer.mjs` | Both `Express … serves real HTTP` cases | Same text without the template indentation, still evaluated with `--input-type=module -e` in the same directory; the CommonJS case substitutes the one expression the format used to select |
| The `node -e` consumer of `react.test.mjs` | `beyond/react/fixtures/consumer.cjs` | `React and ReactDOM SSR …` | Same text without the template indentation, still evaluated with `-e` in the same directory |

The existing fixture directories of `example/`, `demo/` and `packaging/` received READMEs; their files are unchanged.

```sh
node --test beyond/packaging/packaging.test.mjs beyond/graph/graph.test.mjs beyond/express/express.test.mjs \
  beyond/react/react.test.mjs beyond/capabilities.test.mjs beyond/demo/styles.test.mjs \
  beyond/packaging/boundaries.test.mjs beyond/example/creators.test.mjs
node --test beyond/packaging/ecosystem.test.mjs
node beyond/example/run.mjs
node beyond/demo/build.mjs
```

| Check | Result |
| --- | --- |
| The eight test files, before and after | 31 of 33 both times, with the same case names passing and the same two failing with the same assertion output |
| Pre-existing failures | `Express graph records transitive installed packages separately from files` and `React outputs retain separate file/package/public graph evidence and System adapters`: each `packageEdges` list gains an unsatisfied `bundled` edge from `@beyond-js/suite-development@0.1.0`, the manifest of a directory that contains the checkout. Package lookup in the React and Express builds walks above the repository root, so the result depends on where the checkout sits. Not caused or repaired by this change |
| `ecosystem.test.mjs`, after | 8 of 8; its fixtures are unchanged and it was not run before |
| `example/run.mjs`, `demo/build.mjs`, after | `PASS` and a completed build; the example runner copies its fixture directory, README included, into `.cache/example/sources/` |
| Byte comparison | A scratch script rebuilt the old written trees from the committed tests and found every fixture file, and every `Workspace.copy()` of it, identical (34 file comparisons, and K4's edited file); the consumers were identical after removing the template indentation |
| Isolation | No `beyond-esbuild-probe-*` directory remained in the system temporary directory after the runs, and `git status` listed only the intended files |

Not run: `demo/verify.mjs`, `packaging/verify.mjs` and the Go regression cases, whose inputs did not change.
