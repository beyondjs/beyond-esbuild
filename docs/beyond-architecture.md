# Beyond compilation contracts

Beyond ESBuild evaluates how esbuild can provide syntax transformation, traversal and packaging while Beyond owns public-module composition, selected package identity and runtime update behavior. The compiler source is currently upstream esbuild; the assessment adds explicit adapters and executable cases around its public API.

## Two packaging paths

The authored path starts with several internal TypeScript files. Each becomes a separate CommonJS creator body, associated with a stable internal ID and content hash. An assembler produces a public module containing an `ims` map, dependency namespaces, export descriptors and a retained export-processing closure. Initial output creates a real Kernel `Bundle`/`Package` and calls `initialise(ims)`; update output finds the existing versioned instance and calls `update(ims)`.

Only the entry's intended API becomes public. Relative source references stay inside the creator registry; bare public references remain separately addressable. The executable case has four internals and an independent shared public module. Its original CommonJS and ESM consumers observe an entry update while package identity and unchanged internal state survive. This differs from flattening all sources into a conventional ESM file and importing a new URL.

The external-package path starts with installed React/ReactDOM or Express source. Esbuild traverses and bundles package internals while explicit public boundaries stay external. These packages are not retroactively treated as Beyond-authored sources with per-file creators. A facade adapts known package exports and external CommonJS references to the selected delivery format. React supplies browser/client distribution and Node SSR; Express supplies Node server behavior and real HTTP tests.

## Formats and adapters

| Format | Native compiler capability | Beyond or assessment responsibility |
| --- | --- | --- |
| ESM | esbuild emits ESM syntax and import/export metadata | Authored public module composition, creator registry, live outer bindings and bare namespace registration; external-package facade/require bridge |
| CommonJS | esbuild emits CommonJS | Preserve separate creator bodies, select the actual CommonJS Kernel and package map, adapt `import.meta.url` to the artifact URI; Node SSR/server execution |
| System.register | **Not an esbuild output format** | TypeScript 5.8.3 converts the composed envelope; actual SystemJS loads it and the matching Kernel in the browser |

The authored CommonJS creator bridge copies values from esbuild's local `module.exports` object into the runtime's existing exports proxy. This handles the fixture's functions, classes, constants and replacement updates. It does not provide general live tracking of later mutations inside a creator. Re-exports, cycles, export-shape changes and other unsupported forms require their own tests and contracts before widening the adapter.

`cjs-module-lexer` currently discovers exports/re-exports in Beyond's existing CommonJS analysis; it does not build the full dependency graph. The fixture demonstrates that version 2.1.0 discovers no export names in esbuild's helper-based CommonJS pattern. Separate emitted ESM metadata supplies names for this bounded assembler. That mismatch is a concrete compatibility finding, not evidence that the compiler core must be rewritten.

## Three graph identities

| Graph | Evidence and identity | What it must not imply |
| --- | --- | --- |
| Internal/source files | Native esbuild traversal records direct and transitive imports, including `index -> format -> decoration`; relative files map to internal IDs | A file is not automatically a public module; an optimized metafile is not every syntactic/type-only authoring relationship |
| Public modules | Explicit bare references such as `@fixture/shared/message` and `react`; source importer and kind remain available | An `external` flag alone does not establish a Beyond public boundary, especially with `bundle: false` |
| Packages and versions | Explicit fixture manifests or actual installed package manifests, recorded independently | esbuild does not implement Beyond's workspace precedence, version selection or public-subpath validation |

The native bundled traversal used for graph evidence is distinct from the unflattened authored delivery artifact. Per-file metadata used for export discovery is retained separately. React/Express graph reports associate traversed files with installed packages and preserve external relationships; they do not claim a general Beyond package resolver.

## Styles and runtime ownership

The browser case compiles separate app/shared CSS artifacts and records CSS traversal, including imported styles. These artifacts belong to versioned public-module identities. The page registers those identities with the actual Kernel styles registry, obtains their artifact URLs, and adopts styles inside distinct shadow roots. Runtime adoption and computed browser styles are separate assertions from successful CSS compilation.

Modular styles in this case means module identity, delivery and scoped adoption; it does not imply that esbuild CSS Modules class-name renaming implements Beyond's complete style system. Stylesheet updates, dependency invalidation, widget lifecycle and disposal remain separate contracts unless explicitly exercised. Likewise, manual JavaScript patch application does not establish a watcher, notification transport, update ordering, reconnect recovery or complete Packages service integration.

## Refactoring gate

Derive each compiler adaptation from an observed need. Record a source-backed contract, minimal input, exact output and failing executable assertion. First determine whether a public esbuild option, plugin or bounded adapter can satisfy it. Distinguish costs introduced by temporary adapters from compiler defects. Necessary targeted core changes for external-package packaging, internal creator composition or graph traversal are authorized; implement them with focused regression coverage and explicit compatibility limits when the evidence requires them. This does not authorize an unrelated rewrite, commits, pushes, publication or general consumer migration.

The [requirements inventory](requirements.md) and [compiler audit](compiler-audit.md) hold supporting evidence. No measured performance target, complete source audit, production package migration or general-purpose Beyond compiler replacement is claimed by the current examples.
