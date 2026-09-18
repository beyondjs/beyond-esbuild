# esbuild packaging mode

This guide covers the first of the two [execution modes](execution-modes.md): a public module compiled and bundled by esbuild into a distributable artifact that needs no Beyond runtime. It records which contract each fixture path implements, the adapters the mode needs, the executed package coverage, the behavior of re-exports and development updates, the format assessment and the bounded Packages trial. Results are those of the pinned fixtures; they are not a guarantee for arbitrary packages.

## Which contract each path implements

| Path | Output contract | Evidence |
| --- | --- | --- |
| `beyond/example/` and `beyond/example/creators.test.mjs` | Unified-runtime composition: one creator per source file, registered in the legacy Kernel 0.1.12, updated with `Package.update(ims)` | Compatibility evidence for using esbuild as the creator transformer. It is not packaged-mode acceptance and shows no packaged-mode HMR |
| `beyond/packaging/` (`Authored`, `Packaged`) | esbuild packaging: internal files are bundled, public references stay bare, the artifact imports nothing from Beyond | Cases K1–K5 below |
| `beyond/packaging/` (`Distribution`, `Cohesive`) | esbuild packaging of published packages: one artifact per package, version and public subpath | Cases E1–E7 and the browser verification below |
| `beyond/react/`, `beyond/express/` | Earlier, hand-specified packaging of React and Express | Kept unchanged; `Distribution` now derives the same React artifacts generically |

The authored example was the only authored path before this delivery, and it implements the runtime-composition contract. What the packaging objective still needed, and now has, is a packaged authored path, a generic published-package path, their consumers and the Packages trial. What it still lacks is listed under [remaining work](#remaining-work-and-blocking-decisions).

## Responsibilities

| Class | Responsibility |
| --- | --- |
| [`Target`](../beyond/packaging/resolution.mjs) | Platform (`browser`, `node`) and environment (`production`, `development`): export conditions, main fields, `process.env.NODE_ENV`, minification in production |
| [`Boundary`](../beyond/packaging/boundary.mjs) | The public boundary. Relative files and package-private `#imports` are bundled; every other bare specifier stays as written. A relative import that lands on a file the same package publishes becomes a reference to that public specifier |
| [`Resolution`](../beyond/packaging/resolution.mjs) | Resolves a specifier with the compiler's own resolver, names the owning package and version, and answers which public specifier a file is published as |
| [`Packaged`](../beyond/packaging/packaged.mjs) | One public module: native ESM or CommonJS output, external source map with sources content, CSS sibling output, exported names, star re-exports, references, inputs |
| [`Authored`](../beyond/packaging/authored.mjs) | Authored packages that declare public modules as `exports` entries pointing to source files, the model Packages reads. Development artifacts are addressed by a closure identity |
| [`Distribution`](../beyond/packaging/distribution.mjs) | The transitive closure of published packages: every reference is resolved from the importing package, versions are read from the installation, nested versions become import-map scopes, declared ranges are checked with `semver` |
| [`Cohesive`](../beyond/packaging/cohesive.mjs) | Subpaths of one package that share unpublished files, compiled together with native code splitting |
| [`VueSource`](../beyond/packaging/adapters/vue.mjs), [`SvelteSource`](../beyond/packaging/adapters/svelte.mjs) | Framework source adapters |
| [`loader.mjs`](../beyond/packaging/loader.mjs) | Test tooling: applies the written import maps, with scopes, in Node, which has none |

Source files, public modules and package versions stay separate: `inputs` are files, `references` are bare public specifiers, and `packageEdges` join package versions with the declared field, range and whether the installed version satisfies it. Nothing selects a version.

## Native output and adapters

Native compiler output: ESM, CommonJS, minification, source maps, CSS bundling, conditional export resolution, code splitting (ESM only). Everything below is an adapter around the public API; each artifact's report names the ones it used.

| Adapter | Needed when | What it does |
| --- | --- | --- |
| `commonjs-names` | The entry is CommonJS and the output is ESM | Reads exported names from the source with `cjs-module-lexer`, following re-exported requires including public ones, and writes a static facade. The default is `module.exports`, or its `default` for a transpiled module |
| `commonjs-star-names` | An ESM entry does `export * from './file.cjs'` (Vue's Node entry) | The same names, added to the star re-export |
| `require-bridge` | Bundled CommonJS calls `require()` on a public reference and the output is ESM | Static imports plus a local `require` that hands a CommonJS facade back as its value and anything else as a flagged ES module |
| Framework source | `.vue` or `.svelte` source | `@vue/compiler-sfc` or `svelte/compiler`. Emitted code imports `vue`, `svelte/internal/client` or `svelte/internal/server` by bare name; component CSS becomes the style output of the module. Published Vue and Svelte JavaScript needs no framework adapter |
| System.register | A SystemJS consumer | TypeScript converts each native ESM artifact. See [formats](#format-assessment) |

## Two state hazards found by execution

Bundling "everything relative" per public subpath is wrong for real packages, because two artifacts of one package can each receive a private copy of the same file and its state.

1. **The shared file is itself published.** `lit-html/directives/class-map.js` imports `../lit-html.js`, which is also the entry of `lit-html`. Before the rule in `Boundary`, the directive artifact was 7,845 bytes and contained a second lit-html core; with it, 871 bytes and a reference to `lit-html`. In Chromium `globalThis.litHtmlVersions` and `reactiveElementVersions` each have exactly one entry. The same rule makes an authored module that relatively imports another public entry of its package reference it (case K4).
2. **The shared file is not published.** `svelte` and `svelte/internal/client` share the runtime's internal files; Shoelace components share `dist/chunks/*`, which its `exports` map does not publish. `Distribution` detects files bundled into more than one artifact of a package and compiles those subpaths again as one native split build, so the shared files become private chunks evaluated once. Negative control, executed: with `BEYOND_COHESION=off` the consumer page never becomes ready and Chromium reports `Cannot read properties of undefined (reading 'call')`. Splitting exists for ESM only: a package whose subpaths share unpublished CommonJS files is reported under `unsupported` as `duplicated-state`. None of the pinned packages is in that situation.

An authored file shared by two public modules of one package and not itself a public entry is still copied into both (asserted as a limit in K4). Authors reach shared state through a public module.

## Re-exports

Reproduced through an independent consuming public module: `@fixture/values/counter` owns a reassigned binding, `@fixture/facade/api` only re-exports (a star re-export of the public module, a named default, an aliased internal function, an internal reassigned binding), and `@fixture/consumer/main` reads them.

- **Ordinary correctness (K2):** after `increment()` and `bump()`, the consumer observes the new values through the star, the named and the internal re-export. This holds in native ESM, in native CommonJS with upstream getters, and in CommonJS with `cjsExports: 'assign'`. A public star re-export stays a native `export * from` statement. No compiler change and no adapter is involved: re-exports are correct in the packaged path.
- **Propagation during a development update (K3):** the responsible layer is the addressing of rebuilt artifacts, not the compiler. With a content-only identity, editing a file of `values` re-addresses only `values`; the facade keeps its address, so a new import of it keeps the old dependency. With the closure identity of `Authored`, which covers a module's code and the identities of the workspace modules it references, the edit re-addresses `values`, `facade` and `consumer`, leaves an unrelated module alone, and a new import observes the change through the re-export.
- **Reload boundary:** the consumer that was already loaded keeps its old module instances; ES module namespaces are not replaceable. Both generations stay alive with separate state. Nothing here delivers the new addresses to a running page or re-evaluates it.

The legacy creator replacement failure (L4 in [validation](validation.md)) is a property of runtime composition with the installed Kernel. It does not occur in the packaged path, so the configurable-accessor proposal is not a packaging requirement; it remains a runtime-composition proposal in [requirements](requirements.md).

## Necessity of `cjsExports: 'assign'` per path

| Path | Needed | Evidence |
| --- | --- | --- |
| Creators for the Kernel (runtime composition) | Yes | [Assigned CommonJS exports](cjs-exports.md): the Kernel observes exports only through assignment |
| Packaged ESM, the preferred distribution output | No | The option applies to CommonJS output only. The Packages trial builds the same module with upstream `esbuild` 0.25.9 |
| Packaged CommonJS | No | K2 passes with upstream getters and with assigned exports |

The option stays in the fork, opt-in, for the first row.

## Package coverage

Pinned: `vue`, `@vue/compiler-sfc`, `@vue/server-renderer` 3.5.43, `svelte` 5.57.0, `react` and `react-dom` 19.2.0, `@radix-ui/react-tabs` 1.1.21, `@headlessui/vue` 1.7.23, `@shoelace-style/shoelace` 2.20.1, `lit` 3.3.3. `node beyond/packaging/ecosystem.mjs` builds three targets.

| Target | Authored modules | Package artifacts | Packages | Package edges | Bytes | Split artifacts | CommonJS inputs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `browser.production` | 6 | 79 | 38 | 109 | 890,931 | 15 | 5 |
| `browser.development` | 6 | 79 | 38 | 109 | 2,780,068 | 15 | 5 |
| `node.production` | 6 | 83 | 46 | 119 | 1,216,811 | 11 | 16 |

Every package edge is declared (`dependencies` or `peerDependencies`) and satisfied by the installed version; `unsupported` is empty; the installation has one version per package, so no import-map scope was needed and scopes are exercised by code only.

| Concern | Executed evidence |
| --- | --- |
| Published JavaScript | Vue, Svelte, Radix, Headless UI, Shoelace, Lit and their dependencies are packaged with no framework adapter; ESM inputs use no adapter at all |
| Framework source | A scoped `<script setup lang="ts">` SFC and a runes-mode `.svelte` component with `svelte/store` compile through the adapters, in client and server form |
| Browser consumers | Real Chromium, production (minified) and development: Vue state with a Headless UI switch, Svelte state and store, Radix tabs through packaged React and the JSX runtime, Shoelace button and switch. 85 module requests, no failed request, no page or console error |
| Node consumers | `renderToString` of the SFC with `vue/server-renderer`, including the Headless UI control (E1); `render` from `svelte/server` (E2) |
| Conditional exports | `vue` resolves to `dist/vue.runtime.esm-bundler.js` for the browser and `index.mjs` for Node; `svelte` to `index-client.js` and `index-server.js`; `esm-env` executes as `DEV: true, BROWSER: true` in `browser.development` and `DEV: false, NODE: true` in `node.production` (E3) |
| Public subpaths | `react/jsx-runtime`, `react-dom/client`, `vue/server-renderer`, `svelte/internal/client`, `svelte/store`, `lit/directives/class-map.js`, Shoelace component and utility paths |
| CommonJS input | React, ReactDOM and scheduler in the browser; Vue's CommonJS builds, `@babel/parser` and others on Node (E4) |
| Dependency interoperability | `@headlessui/vue` and the fixture share one `vue` through a peer dependency; Radix packages share one React; Svelte's store and component runtime share one state |
| Assets and styles | The Shoelace theme is packaged from its CSS subpath and applied: the primary button and the checked switch compute the same theme color inside their shadow roots. Scoped SFC CSS and Svelte component CSS are separate style outputs of their modules and apply |
| Minification | Production is less than half the development bytes (E7); the minified authored artifact maps a thrown error to `main/index.ts:8:9` under `node --enable-source-maps` (K5) |

Unsupported or not covered: subpaths sharing unpublished CommonJS files (reported, not solved); Shoelace icons and other assets fetched at runtime from a base path; Sass, Tailwind and CSS Modules; Vue or Svelte features beyond the fixture, including custom blocks, `<style module>` and preprocessors; hydration of server-rendered markup; WASM; packages that compute their specifiers; more than one installed version of a package; Windows paths; every package outside the pinned list. A page links style outputs itself: registering them through Beyond's style contract is not part of this mode's fixtures.

## Format assessment

| Output | Kind | Status |
| --- | --- | --- |
| ESM | Native | Preferred distribution output. Every case above uses it; it is the only format with native splitting, native star re-exports and live bindings without helpers |
| CommonJS output | Native | Works for authored packaged modules (K2). CommonJS **input** is required for ecosystem coverage and is unaffected by any decision about CommonJS output |
| IIFE | Native | Not exercised |
| System.register | Adapter (TypeScript) | Kept. The complete `browser.production` closure, including split chunks and star re-exports, was converted and run with SystemJS 6.15.1 in Chromium with the same assertions |

No executed requirement justifies native System.register emission: the adapter carried everything that was tried. What it costs is a second parse and print per artifact and source maps that are not chained in this path (they are in `beyond/example/formats.mjs`). Unresolved format decisions: whether CommonJS output is retired, and who produces and serves the System.register variant in Packages, where no such output exists yet.

## Packages trial

Executed in the Packages checkout on top of revision `d2a63f3`, under BEE Node with Engine 1.4.1 serving the implementation, and committed there afterwards as `dbfd08f`. The run guide is `tests/esbuild-packaging/README.md` there. The fixture is the suite testbed; the trial resolves it through the stage-1 harness, and it passed again, with stage-1, after that fixture moved to `testbed/module-updates/`.

- **Integration point:** a new bundler, `@beyond-js/packages/bundlers/esbuild`, selected per module with the existing `bundler` key of a module manifest or the package default. No configuration syntax was added. Its conditional extends the SDK conditional, so inputs are watched like any other; its processor bundles the entry point and keeps public references bare, including the published-sibling rule.
- **Resolved compiler:** the bundler has no default compiler. `processors.bundle.compiler` in the bundler's package settings is a module specifier resolved by the running loader. The trial passes a `file:` URL of the package that `node beyond/package.mjs` lays out, so nothing is installed into Packages and its `esbuild ~0.25.9` dependency is untouched. Each artifact reports the compiler: version `0.28.2`, location, the fork's revision from `beyond.json`, and `assigned: true`, a capability probe only the fork passes. Negative cases: no selection is `COMPILER_NOT_SELECTED`, an unimportable one is `COMPILER_IMPORT_ERROR`, and selecting the upstream dependency is reported as `0.25.9`, `assigned: false`.
- **Artifacts:** `composition: 'packaged'`, no internal modules, no update file, `inputs`, `stars`, `compiler`. The artifact address does not include the mode, so selection does not change a public identity. The artifacts writer and delivery accept a conditional without a patch.
- **Per-module selection:** `shared` packaged with `app` composed, and the reverse, build without diagnostics and execute in one consumer; only the composed module registers in the Kernel.
- **Production:** a `node/production` conditional is minified, references and registers no Beyond runtime, and its map names `decorate.ts` and `index.ts` with their content.
- **Development:** an edit seen by the real watcher rebuilds the packaged module only; the dependent artifact is byte-identical. A consumer that is already running keeps the old value, also when it imports again; a restarted consumer observes the change. A source error is `BUNDLE_ERROR` with file and position, nothing is published for the module, and restoring the source restores the original hash.
- **Result:** 7 of 7 steps. The existing stage-1 validation passed 21 of 21 before the change and after it; one intermediate run failed its recovery step, which waits for two filesystem events, and passed again unchanged.

This is a trial, not adoption: it is committed locally only, nothing was pushed, published or migrated, and the bundler has not been reviewed by the Packages owner.

## Status against the execution-mode acceptance

| Target in [execution modes](execution-modes.md) | Status |
| --- | --- |
| Packaged public module and independent public dependency, executed without a Dev Server or creator registry | Executed: K1, the Packages production step, the browser and Node consumers |
| Same mode in development; change a dependency or re-export; show the HMR behavior through a loaded consumer | Partly. Rebuild, re-addressing through the public graph and the reload boundary are executed (K3, Packages development step). Delivery of an update and replacement in a running consumer do not exist |
| Unified-runtime mode verified independently | Not part of this work. Creator cases remain legacy Kernel evidence |
| Per-module selection, interoperability, separated identity, no silent fallback | Executed in Packages for both directions on Node. Not executed in a browser, and switching a running module is unspecified |
| Fork integrated in the actual Packages path with the resolved compiler verified | Executed as a bounded trial, committed locally in Packages, not pushed or adopted |

## Remaining work and blocking decisions

esbuild-specific work that remains: an update integration for packaged modules (notification, new addresses for a running page through the public graph, the accept or reload policy, styles); carrying the closure identity and the cohesion pass into the Packages bundler, which today bundles one module at a time; the framework adapters and the CommonJS adapters in Packages; browser execution of Packages-produced packaged artifacts; published-package distribution through Packages, whose `exports` bundler is a separate older path; chained source maps for the System.register adapter.

Decisions that block parts of it:

1. How Packages obtains the fork: a published package name and version policy, or a location setting as in the trial. Publication is not authorized, so the trial cannot become a dependency yet.
2. Whether packaged-mode development updates are reload-based through the public graph or need finer replacement. This is the question the independent HMR audit addresses.
3. Whether CommonJS output is retired, and whether System.register remains a required delivery format for Packages.
4. Where framework source adapters belong: processors of this bundler or bundlers of their own.

## Commands

```sh
node beyond/prepare.mjs
node beyond/package.mjs
node --test beyond/packaging/packaging.test.mjs beyond/packaging/ecosystem.test.mjs
node beyond/packaging/ecosystem.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/packaging/verify.mjs
```

[Setup](setup.md#packaging-cases) has the pinned installation. Reports, import maps, artifacts and browser evidence are written under `beyond/.cache/packaging/<target>/`.
