# Beyond ESBuild handoff

Preparation handoff, updated 2026-09-18. **The compiler core is unchanged. This delivery consists of preparation, fixtures and bounded tests using existing APIs and explicit adapters; full Beyond implementation and production integration are not complete.** The working demo is evidence for those cases only. The user will start a new implementation agent using this handoff; this documentation closeout does not launch it. Inspect current task and Git state before resuming. Preparation changes are recorded in local closeout commits; inspect `git log` and preserve any later concurrent work. Durable contracts/results live in `docs/`.

## Identity and authorization

Verified real GitHub fork: <https://github.com/beyondjs/beyond-esbuild>, parent/source `evanw/esbuild`. The independent repository is `beyond-esbuild/` inside a suite checkout, or another location chosen by the developer. All commands and paths below are relative to the fork root unless stated otherwise. `origin` points to the Beyond fork; `upstream` points to `https://github.com/evanw/esbuild.git`. The selected branch is `feature/next`, with `main` preserved. The compiler was built from upstream base `f6058f8364fe7ab91ca57a83e02577ed74c9cae4`, esbuild `0.28.2`; later local closeout commits contain preparation code and documentation. Recheck Git state when resuming.

The user authorized the fork, checkout, preparation, audits, adapters, fixtures, tests, local demo and documentation. Necessary functional compiler changes remain authorized for the **new implementation task**, when concrete requirements justify them; this closeout makes no such changes. The user separately authorized local commits of this preparation and its documentation corrections in the fork and suite. That closeout authorization does not grant arbitrary future commits, pushes, publication, deployment or general consumer migration. Preserve MIT attribution, public boundaries and unrelated work.

## Complete acceptance scope

1. Beyond-authored public module with several internal modules: preserve individual creators, identity/hash records, public bare dependencies, entry exports and the actual Bundle/Package initialization/update contract. Do not substitute a flattened ESM bundle. The user's spoken ESM phrase is interpreted through existing Engine/Packages code, not as a new API identifier.
2. Separate existing external **React** package packaging for CDN consumption. Show a real React component compiled by this fork in a real browser consuming generated artifacts.
3. Both paths produce **CommonJS**, **ESM**, and **SystemJS**. Execute CommonJS in Node (React SSR); execute ESM and SystemJS with the real browser/loader. esbuild emits CJS/ESM natively; System.register conversion is an explicit TypeScript adapter, not native esbuild support.
4. Add **Express** as a Node-only external package case: packaging/exports/graph plus actual HTTP consumption. Do not claim Express browser support.
5. Modular **CSS** linked to Beyond public identities: separate addressable artifacts, actual Kernel style registration and browser adoption/isolation, grounded in the suite style contract rather than invented APIs.
6. Record **three distinct graphs**: source-file direct/transitive dependencies from esbuild traversal, public-module edges retaining bare identity, and package/version selection. A metafile alone is not a Beyond package resolver or complete authoring graph.
7. Identify `cjs-module-lexer` with source evidence and an executed limitation case. Compare native support, bounded adapters, and genuine gaps before proposing core changes.
8. Audit compiler architecture across entrypoints/API, parser, resolver, scanner, linker/code generation/exports, cache/rebuild, plugins and tests. Report exact reading depth and pending work; directory coverage is not a line-by-line review of all code.
9. Self-contained product README, `AGENTS.md`, maintained `docs/`, executable tests/fixtures outside docs, and temporary material in `docs-temp/`. Audit the suite root documentation without automatically rewriting child repositories.

## Completed ownership and coordination

- Primary implementation task: fork/remotes, suite inventory, compiler preparation, supporting probes, `beyond/demo/`, browser/CSS verification, this handoff, final integration.
- `requirements` subagent: `beyond/example/` creator adapter and graph, root README/AGENTS, `docs/`, and fork documentation integration completed.
- `compiler_audit` subagent: compiler audit and `beyond/react/`, `beyond/express/`; external package builds/tests completed, available for follow-up.
- `documentation_audit` subagent: suite-root documentation classification/moves/link repair and policy completed; fork docs read-only review coordinated with `requirements`.

Coordinate before changing another owner's files. The suite has unrelated preexisting and concurrent edits. Inspect Git status and diffs before every integration.

## Layout and concrete implementations

- `beyond/prepare.mjs`: compiles checked-out Go compiler and its matching JS API to ignored `.cache/`; never substitutes an installed npm esbuild.
- `beyond/capabilities.test.mjs`: seven focused characterization probes. `workspace.mjs` owns disposable fixtures.
- `beyond/example/`: four internal TS sources, separate shared public module, per-file CJS transform, assignment bridge into Kernel exports, canonical ESM assembly, native CJS envelope, TypeScript System.register conversion. Graph traversal records direct `index -> format` and transitive `format -> decoration` edges.
- `beyond/react/`: production React/ReactDOM facades and explicit external-require bridge; output under `.cache/react/`; real SSR tests against generated packages.
- `beyond/express/`: CJS/ESM packaging and real Node HTTP probes; output under `.cache/express/`.
- `beyond/demo/`: React JSX consumer, standalone module CSS inputs, local loopback artifact server and passing real-browser verification.
- `.cache/example/node_modules/@fixture/app/main.{mjs,cjs,system.js}` and shared equivalents are inspectable builds; `.cache/example/patch.*` exercise retained consumers.
- `.cache/runtime/node_modules` holds pinned dependencies. `.cache/` is ignored; it is not a published CDN.

The architecture audit traces Node/service/public API -> scanner/parser/resolver -> linker -> printer plus cache and plugin boundaries. It inventories all 350 upstream tracked paths and 27 internal packages, with selected code regions read; it is not an exhaustive line-by-line code review. See `docs/compiler-audit.md` for exact coverage. Current Packages source shows esbuild in the exports bundler, TypeScript plus lexer in the maintained creator path, existing independent package/public graphs, and historical esbuild internal composition under `trash/`. Preserve the three responsibility designs; absence of metafile does not imply absent design.

## Verified findings and limits

Packages currently uses `cjs-module-lexer ~2.1.0` for CommonJS exports/reexports. Its TypeScript creator path is separate from its esbuild exports-bundler path. For the fixture, lexer 2.1.0 reports no exports from esbuild's helper-based CommonJS output; a separate ESM metadata pass yields the correct names. The adapter copies esbuild getter exports into the legacy Kernel mutable export proxy. It demonstrates replacement updates, **not arbitrary intra-creator ESM live binding equivalence**.

SystemJS requires TypeScript 5.8.3 envelope conversion. React/Express use explicit interop wrappers. No compiler-core modification was made. The fixtures neither prove a core modification is required nor prove one can be avoided for the complete requirements. Cycles, computed imports, shape changes, wrapped maps, lifecycle and full Packages/CDN acceptance remain open.

## Executed evidence at this revision

- Exact fork compiler built: Node `22.21.1`, Go `1.27.1 darwin/arm64`.
- Seven supporting tests passed.
- Five upstream Go packages passed: `internal/bundler_tests`, `internal/js_parser`, `internal/js_printer`, `pkg/api`, `cmd/esbuild`.
- Authored path CJS and ESM execute against actual Kernel `0.1.12`; original-consumer patch 42 -> 43, same package identity, unchanged internal hashes/state retained; direct/transitive graph asserted.
- React `19.2.0` tests: 2 passed, including fresh-process SSR/hooks with generated-artifact-only React consumption.
- Express `5.1.0` tests: 3 passed, including actual loopback HTTP POST in both module formats.
- Final integrated Node run: **12 tests passed, 0 failed/skipped**, plus authored CJS/ESM runner passed.
- **Real Chromium 151.0.7922.34 / Playwright 1.62.1 passed both browser modes**: rendered React, clicked state control, original-consumer Beyond patch 42 -> 43, retained internal counter 1 -> 2, actual Kernel style registration, distinct app/shared/document computed styles, no page/network errors, 390px layout without horizontal overflow. `beyond/.cache/demo/browser.json`, `browser.png`, `mobile.png` retain evidence; desktop screenshot visually inspected.
- Compiler core and license intact. Preparation/code/doc changes are recorded in local closeout commits, without push or publication. Root README presents Beyond ESBuild and preserves the upstream introduction in `docs/upstream.md`. Passing fixture paths through APIs/adapters does not establish that the remaining implementation can avoid core changes.
- Documentation audit completed: root `AGENTS.md`, `docs/AGENTS.md`, maintained guides and temporary lifecycle consistent. Suite temporary assignments moved to `docs-temp/`; durable Workspace design/acceptance and historical evidence preserved. Suite audit checked 705 local links/anchors. No child-repository sweep or blind deletion occurred.
- Final independent documentation review passed with no required corrections. Final integration checked 63 fork links/anchors and 721 suite local link targets with no missing targets, first-party JavaScript module syntax, source lengths below 300 lines, whitespace, unchanged compiler/license files and preserved upstream introduction body. The simple manual server was left available at `http://127.0.0.1:4178`; restart it with the documented command if that process ends.

## Reproduction and continuation

The next task is substantive implementation, not approval of the demo as a finished product. Read the failure/adaptation ledger in `docs/validation.md`, extend cases that can invalidate the current simplified assumptions, and reproduce specific reported conflicts before deciding a fix. The lexer failure, SystemJS conversion and mutable-getter bridge are concrete evidence; their fixture workarounds leave open semantics. This closeout changes documentation only and does not launch that implementation.

From the fork root, use Go plus Node 22 or newer:

```sh
node beyond/prepare.mjs
npm install --prefix beyond/.cache/runtime --no-save --package-lock=false react@19.2.0 react-dom@19.2.0 systemjs@6.15.1 typescript@5.8.3 @beyond-js/kernel@0.1.12 cjs-module-lexer@2.1.0 express@5.1.0
node --test beyond/capabilities.test.mjs
node beyond/example/run.mjs
node beyond/react/build.mjs
node --test beyond/react/react.test.mjs
node beyond/express/build.mjs
node --test beyond/express/express.test.mjs
node beyond/demo/build.mjs
node beyond/demo/server.mjs
```

Preparation uses `go` on `PATH`; the documented `GO` override can select another executable. `GOCACHE` and `GOMODCACHE` may select writable cache directories configured by the developer. For browser verification, follow the pinned tooling setup in `docs/setup.md`, then run `PLAYWRIGHT="$PWD/beyond/.cache/browser/node_modules/playwright" node beyond/demo/verify.mjs`. The recorded browser run used an existing compatible installation; fresh-install instructions are documented separately. Local loopback/browser execution may require environment permission. Never copy physical machine paths from ignored diagnostics into repository content.

Manual page: run `node beyond/demo/server.mjs` and open `http://127.0.0.1:4178`. Automated verification creates/closes its own ephemeral server and Chromium. The page's React component is built by this fork; both frames consume the generated public Beyond and React artifacts.

The next implementation agent should first read `AGENTS.md`, `docs/README.md`, `docs/beyond-architecture.md`, `docs/requirements.md`, `docs/compiler-audit.md`, and `docs/validation.md`; inspect source and current generated reports, then reproduce the baseline. Expand confirmed missing cases with executable acceptance, adapting APIs or making necessary targeted core changes when evidence requires. Do not repeat the finished fork/bootstrap work. Remaining limits are listed explicitly above and in validation: general live bindings/cycles/default-star semantics, shape-changing updates, automated transport/lifecycle, maps after wrapping, a real version solver, broader CSS processors/replacement, and production consumer integration. None is silently marked complete by this delivery. Commits/pushes/publication/general migration still require explicit authorization.

Acceptance for subsequent changes remains all three independent responsibilities, real CJS Node/SSR + ESM/SystemJS browser consumption, Express Node, module CSS registration/isolation, traceable direct/transitive graphs and honest native/adapter/gap reporting. Add focused regressions, rerun affected cases and update durable evidence before claiming completion. A ready-to-copy continuation request is in `next-agent.md`.
