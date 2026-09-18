# Executed capability evidence

This record covers preparation and bounded API/adapter tests. No compiler-core modifications were made. Passing fixtures and the browser demo do not establish complete Beyond implementation or production integration.

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

## Upstream regression checks

Executed against the same unchanged compiler and temporary Go caches. Portable equivalent with the selected Go toolchain on `PATH`:

```sh
go test \
  ./internal/bundler_tests ./internal/js_parser ./internal/js_printer ./pkg/api ./cmd/esbuild
```

Result: **all five Go test packages passed**. These exercise upstream bundling, JavaScript parsing/printing, public Go API behavior and the executable entrypoint. This is a bounded regression run, not the full upstream test matrix or cross-platform certification.

## Final integrated run

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

## Remaining implementation boundaries

### Reproduced failures, fixture adaptations and open gaps

| Observed failure or limitation | What the fixture does | What remains to implement or validate |
| --- | --- | --- |
| `cjs-module-lexer` 2.1.0 reports no exports for the tested esbuild helper-based CJS output | Uses a separate ESM metadata pass for the tested named exports | Default/star/re-exports, arbitrary CJS shapes, cycles and export discovery beyond this fixture |
| esbuild-generated CJS export getters reject deletion/reassignment required by the selected legacy creator model | Copies values into the Kernel export proxy after creator evaluation | Later mutable live bindings and general update semantics; copying values is not full ESM equivalence |
| esbuild does not emit System.register natively | Converts the outer ESM envelope with TypeScript 5.8.3 and executes the result with SystemJS | Broader conversion semantics and source-map/interop cases; this is not native compiler support |
| Direct execution of tested CJS external require in ESM rejects without adaptation | Supplies explicit external interop wrappers in the package cases | Other package export shapes, computed imports and runtime conditions |

The new implementation agent has substantive work: reproduce the baseline, extend tests that can expose demo false positives, obtain concrete reproductions of the owner's reported conflicts, resolve confirmed gaps and decide between APIs, adapters and compiler-core changes from evidence. Neither necessity nor absence of future core changes is established by this preparation. These documentation corrections do not initiate that implementation.

These required fixture paths work through the public fork API plus explicit adapters; no core fix was necessary to pass them. SystemJS is TypeScript envelope conversion, not a native esbuild output. Creator export copying has snapshot limits for arbitrary later mutations. Complete cycles, default/star re-export policies, export-shape changes, automatic HMR/watch transport, lifecycle/rollback, composed source-map positions, general package-version solving, Sass/Tailwind and CSS replacement/recovery remain unvalidated. Express is Node-only. The simple loopback server is a distribution proof, not production CDN integration. Necessary future compiler fixes are authorized when concrete cases establish the need; no blanket compatibility guarantee is made.

## Documentation and repository checks

An independent final documentation consistency review found no required corrections. All 63 local links/anchors checked in the Beyond-authored fork guides resolved. First-party JavaScript modules passed syntax checks, all new source files were below 300 lines and whitespace checks passed. The upstream introduction body was compared to the base README: it is preserved with adjusted image paths and a provenance preface. Compiler implementation and license files remain unchanged. These checks validate this delivery's organization and provenance, not exhaustive upstream source correctness.
