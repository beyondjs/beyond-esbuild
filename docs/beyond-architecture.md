# Beyond compilation contracts

Beyond ESBuild evaluates how esbuild can provide syntax transformation, traversal and packaging while Beyond owns public-module composition, selected package identity and runtime update behavior. The compiler is upstream esbuild plus one bounded, opt-in change, [assigned CommonJS exports](cjs-exports.md); everything else is explicit adapters and executable cases around its public API.

## Two packaging paths

The authored path starts with several internal TypeScript files. Each is transformed alone with `format: 'cjs'` and `cjsExports: 'assign'` into a separate creator body, associated with a stable internal ID and content hash. An assembler produces a public module containing an `ims` map, dependency namespaces, export descriptors and a retained export-processing closure. Initial output creates a real Kernel `Bundle`/`Package` and calls `initialise(ims)`; update output finds the existing versioned instance and calls `update(ims)`.

Only the entry's intended API becomes public: the names `cjs-module-lexer` reads from the entry creator, plus the names of internal modules it re-exports with `export *`, excluding `default`, which is the rule of the Packages assembler. A default export is published through a live `_default` alias. Relative source references stay inside the creator registry; bare public references remain separately addressable. The executable case has four internals and an independent shared public module. Its original CommonJS and ESM consumers observe an entry update while package identity and unchanged internal state survive. This differs from flattening all sources into a conventional ESM file and importing a new URL.

The external-package path starts with installed React/ReactDOM or Express source. Esbuild traverses and bundles package internals while explicit public boundaries stay external. These packages are not retroactively treated as Beyond-authored sources with per-file creators. A facade adapts known package exports and external CommonJS references to the selected delivery format. React supplies browser/client distribution and Node SSR; Express supplies Node server behavior and real HTTP tests.

## Formats and adapters

| Format | Native compiler capability | Beyond or assessment responsibility |
| --- | --- | --- |
| ESM | esbuild emits ESM syntax and import/export metadata | Authored public module composition, creator registry, live outer bindings and bare namespace registration; external-package facade/require bridge |
| CommonJS | esbuild emits CommonJS; the fork adds assigned exports for creator bodies | Preserve separate creator bodies, select the actual CommonJS Kernel and package map, adapt `import.meta.url` to the artifact URI; Node SSR/server execution |
| System.register | **Not an esbuild output format** | TypeScript 5.8.3 converts the composed envelope; actual SystemJS loads it and the matching Kernel in the browser |

Creator bodies no longer need a bridge. Upstream output defines getters on a replaced `module.exports`, which the runtime can neither observe nor refill; the earlier adapter copied those values onto the runtime object and therefore delivered snapshots. With assigned exports the body writes on the runtime's `exports` object directly, a reassigned export is a property of that object, and the runtime forwards each assignment to the public binding. Re-exports remain accessors, as in the TypeScript output Packages compiles today: they are not pushed to the public binding and a creator containing them cannot be replaced in place. The Kernel rejects cycles between internal modules, and a loaded ES module cannot gain or lose bindings, so an update that changes the public shape requires a reload. Each of these boundaries has an executed case in `beyond/example/creators.test.mjs`.

`cjs-module-lexer` discovers exports and star re-exports in Beyond's existing CommonJS analysis; it does not build the dependency graph. It reports nothing for upstream getter output, reports names and star re-exports when upstream's `platform: 'node'` annotation is present, and reads assigned exports directly (probe X1). The example therefore uses the lexer exactly as Packages does and cross-checks the names against esbuild's ESM metadata.

Source maps are composed, not regenerated: each creator keeps the map esbuild produced for it, shifted to its first line inside the public module. The CommonJS envelope is converted by esbuild, which composes the inline input map natively. The System.register envelope is converted by TypeScript, whose map only reaches the envelope, so it is chained through the envelope map explicitly. Node resolves a thrown error inside a creator to its TypeScript line and column through the published ESM and CommonJS maps; the System.register map is decoded and asserted directly.

## Three graph identities

| Graph | Evidence and identity | What it must not imply |
| --- | --- | --- |
| Internal/source files | Native esbuild traversal records direct imports; the closure gives transitive files, including `index -> format -> decoration`; cycles are reported before the runtime rejects them | A file is not automatically a public module. `import type` reaches no pass: type edges belong to declaration analysis |
| Public modules | Bare references such as `@fixture/shared/message`, `react` or another public module of the same package, each with its importing file and kind (`import-statement`, `dynamic-import`, `require-call`) | A metafile `external` flag alone is not a runtime public dependency: see below |
| Packages and versions | Manifests only: declared range, selected version, public subpath. Authored modules mirror Packages' validation (`runtime`, `builtin`, `external`, `workspace`; `DEPENDENCY_NOT_DECLARED`, `DEPENDENCY_INCOMPATIBLE`, `MODULE_NOT_FOUND`; no self dependency for own public modules). Installed packages record every crossed package boundary with the declaring field, range and whether the installed version satisfies it | Nothing is selected or solved. Workspace precedence and version selection remain Packages' resolver; installed versions are whatever npm resolved |

esbuild lists an import that TypeScript semantics erase because it is unused in `inputs[file].imports` with `external: true` and the written specifier, for relative and bare specifiers alike, while `outputs[].imports` omits it (probe G2). `beyond/graph/traversal.mjs` therefore transforms each traversed file alone as well and marks an input edge `erased` when its specifier does not survive there. Erased edges stay visible as authoring relationships but never reach the transitive closure, cycle detection or package validation.

The native bundled traversal used for graph evidence is distinct from the unflattened authored delivery artifact. `beyond/graph/` holds the three responsibilities as separate classes: `Traversal` (files), `Graph` (public-module edges and the join) and `Packages` or `Installed` (manifests). React/Express graph reports associate traversed files with installed packages and preserve external relationships; they do not claim a general Beyond package resolver.

## Styles and runtime ownership

The browser case compiles separate app/shared CSS artifacts and records CSS traversal, including imported styles. These artifacts belong to versioned public-module identities. The page registers those identities with the actual Kernel styles registry, obtains their artifact URLs, and adopts styles inside distinct shadow roots. Runtime adoption and computed browser styles are separate assertions from successful CSS compilation.

Replacement follows the Kernel contract: `change()` on a registered stylesheet increments its version, emits `change`, and `href` gains `?version=N`. The page adopts the new `href` and removes the previous stylesheet only after the replacement has loaded. On the build side one incremental context per module stylesheet records its inputs; a changed file invalidates exactly the modules that read it, and a failed build neither replaces the last good artifact nor its graph.

Modular styles in this case means module identity, delivery, scoped adoption and replacement; it does not imply that esbuild CSS Modules class-name renaming implements Beyond's complete style system. Who calls `change()` in production, widget lifecycle, disposal and other processors remain separate contracts. Likewise, manual JavaScript patch application does not establish a watcher, notification transport, update ordering, reconnect recovery or complete Packages service integration.

## Refactoring gate

Derive each compiler adaptation from an observed need. Record a source-backed contract, minimal input, exact output and failing executable assertion. First determine whether a public esbuild option, plugin or bounded adapter can satisfy it. Distinguish costs introduced by temporary adapters from compiler defects. Necessary targeted core changes for external-package packaging, internal creator composition or graph traversal are authorized; implement them with focused regression coverage and explicit compatibility limits when the evidence requires them. This does not authorize an unrelated rewrite, commits, pushes, publication or general consumer migration.

The [requirements inventory](requirements.md) and [compiler audit](compiler-audit.md) hold supporting evidence. No measured performance target, complete source audit, production package migration or general-purpose Beyond compiler replacement is claimed by the current examples.
