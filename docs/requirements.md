# Beyond capability requirements

Use this inventory to evaluate esbuild for Beyond's modular packaging and dependency analysis before changing the compiler. A confirmed requirement below is a Beyond contract, not a claim that esbuild implements it or must implement it in its core. The fork does not replace any installed consumer dependency.

## Evidence baseline

Source audit dated 2026-09-18. References are repository names, commit identifiers and repository-root paths, so they do not depend on a suite directory layout. The initial inventory was source-only. The subsequent [creator composition example](../beyond/example/README.md) executes fork-produced creators against the actual Kernel and an original consumer, with limits and results recorded separately. It does not execute the Packages service or migrate its consumers.

| ID | Repository and revision | Inspected source |
| --- | --- | --- |
| P1 | `beyondjs/packages` at `593b9f1cffb8af2e972af7030fd7a7ac8883af96` | `modules/bundlers/exports/conditional.ts`, `plugin.ts`, `wrapper.ts` |
| P2 | Same Packages revision | `modules/bundlers/ts/processors/ts/index.ts`, `transpiler.ts`, `analyzer.ts`; `modules/sdk/conditional/esm/index.ts` |
| P3 | Same Packages revision | `modules/artifacts/dependencies.ts`; `modules/dependencies/graph/index.ts` |
| K1 | `beyondjs/kernel` at `b06d67d93701c915adca312e5308e15f371c7330` | `src/modules/bundle/package/ims/im.ts`, `index.ts` |
| C1 | `beyondjs/cdn-v2` at `1f65506696226acdd4e162988a01029e94caf187` | `src/modules/business/bundler/index.ts`, `esbuild-plugin/index.ts`; `docs/architecture.md` |
| S1 | `beyondjs/beyond-suite` at `8e29324bec526364bac0dad937dd3f9331a54f60` | `README.md`, `docs/architecture.md`, `docs/bee-node-hmr.md` |
| S2 | Same suite base, **local working-tree documents**, not a published revision | `docs/testbed-stage-1.md`, `docs/testing.md` |

P1–P3 and K1 paths were unchanged from their listed local Git commits at inspection. Other in-progress Packages changes exist and are not attributed to these commits. S2 contains historical execution reports and evolving contracts; its reported passes were not rerun by this audit. These are source coordinates, not a guarantee that unpublished commits can be fetched from GitHub.

## Observed consumers and boundaries

Packages' exports bundler (P1) calls esbuild with bundling enabled, CommonJS format, browser platform, an external source map and `write: false`. Its plugin composes relative files and externalizes bare and URL references. It collects externals in a set, without requesting a metafile or retaining importer/kind edges. A later wrapper emits ESM imports and exports; this caller still writes debug `output.js`. `write: false` is consequently a compiler capability, not proof that the complete caller is free of writes.

The current TypeScript path (P2) uses TypeScript `transpileModule` per file, then `cjs-module-lexer` and a regular expression over `require` calls. It emits runtime creator bodies and assembles one public ESM artifact. It does **not** currently use esbuild for that transformation or establish a complete source dependency graph. Relative requires are internal; bare requires become public dependencies; `beyond_context` is a runtime-supplied exception.

CDN's esbuild path (C1) requests bundled ESM, but its selected plugin's resolve/load hooks are empty. Its platform argument does not change the hardcoded browser build. This is incomplete implementation evidence, not a working CDN integration or a reason to migrate consumers now.

## Confirmed contracts and acceptance cases

| ID | Contract and source | Concrete acceptance case | Scope of an isolated probe |
| --- | --- | --- | --- |
| R1 | Keep internal-source, public-module and package/version graphs distinct (S1, P2, P3). | Entry imports `./helper`, `@fixture/shared/message`, and a different public subpath of its own package. Record the relative edge as internal and both bare edges as public; do not inline the public dependencies. Attach selected versions separately through the Beyond resolver. | Can verify extraction and externalization; cannot prove package-version selection. |
| R2 | Preserve bare public identities through compilation (P1–P3). | Static import, re-export, literal dynamic import and literal `require` of a bare module remain identifiable and external; no installed package implementation is silently embedded. Keep importer and import kind so lazy and eager relationships can be distinguished. | Syntax forms are coverage cases for the established boundary; final graph schema and dynamic-edge policy remain proposals. |
| R3 | Public ESM composition does not promote internal exports (P2, S1). | Entry exports one name and internally imports a helper with another export; output exposes only the intended entry API. Internal star re-exports contribute the intended names, excluding default. A second public module stays independently addressable. | Verify emitted namespace and external import; full Beyond artifact/runtime metadata is separate. |
| R4 | CJS interoperability must preserve the external public API (P1). | Package with `require('@fixture/shared/message')` consumes a named export from an ESM dependency that has no default. Exercise default-only and mixed exports separately. Distinguish an unsupported compiler output from a faulty Beyond wrapper. | P1 currently emits default imports for all externals and named export snapshots; test those assumptions before proposing a compiler change. |
| R5 | Preserve internal identity and change granularity required by current runtime composition (P2, K1). | Change one internal source, retaining stable IDs; unchanged creator bodies/hashes stay equal. Updated output must not imply every source is a new public ESM record. | Whole-bundle rebuild success does not meet this contract; per-file transformation is a useful compatibility probe. |
| R6 | Mutable export handling must be compatible with the selected runtime (P2, K1). | Evaluate a candidate CommonJS creator, clear its exported keys, then evaluate the replacement into the same object. Inspect descriptors for normal exports and re-exports; record non-configurable accessors or `module.exports` replacement as compatibility findings. | Legacy Kernel's delete/refill model is confirmed, not an approved permanent design for the new runtime. No automatic migration is authorized. |
| R7 | Compilation and graph invalidation must follow current source state (P2, S1, historical S2). | Rebuild after modifying a leaf and after removing an import; graph/output must reflect the new edges. Missing source or syntax error must report failure; correction must recover. Rebuild unchanged inputs must produce stable output. | Does not validate filesystem transport, runtime HMR, stale async publication, or cleanup in Beyond services. |
| R8 | Code, maps and diagnostic positions must remain available to callers (P1, P2; map contract in S2). | Build nested `a/index.ts` and `b/index.ts`; preserve distinct source paths, complete or absent `sourcesContent`, and correct source locations. A malformed source reports file/position. `write: false` returns output without writing artifacts. | Map decoding after wrapper insertion and coverage-tool behavior need further integration tests. |
| R9 | Conditional/platform selection belongs to explicit module identity and resolution (P1, P3, C1). | Compile public node and web targets separately; record which target produced each graph and artifact. Keep `node:` references external where appropriate; unsupported target/configuration must be visible. | A generic esbuild platform test cannot prove Beyond's module-manifest selection. P1's node target/browser build mismatch needs characterization, not silent correction. |

R1–R4 are the first graph/composition priorities. R5–R7 determine whether candidate output can participate in the current development model. R8–R9 prevent apparently successful builds from losing debugging or selection information.

## Executed coverage

Status of each contract after the second delivery. "Executed" names the case that asserts it; every case is bounded by its fixture. Commands and results are in [validation](validation.md).

| ID | Executed | Still open |
| --- | --- | --- |
| R1 | `beyond/graph/graph.test.mjs` F1–F3 and the example report: relative edges internal, bare and same-package public edges separate, versions attached from manifests with Packages' diagnostics | The real Packages workspace resolver is not invoked; the mirror selects nothing |
| R2 | F2: static, literal dynamic and literal `require` bare references keep importer and kind; G1: re-export and same-package subpath stay external | Computed specifiers; final graph schema and dynamic-edge policy |
| R3 | L3 and the example: entry-only API, internal star re-exports contribute names except `default`, shared module independently addressable | — |
| R4 | React/Express facades and C1 | P1's default-only import assumption was characterized, not changed |
| R5 | Example run: one changed source, stable IDs, unchanged hashes and retained state; L6: added internal module | Removed internal modules stay registered in the Kernel (K1) |
| R6 | [Assigned CommonJS exports](cjs-exports.md): L1 live reassigned exports, L2 defaults, delete/refill across updates; H1 keeps the upstream descriptor finding | Re-exports are non-configurable accessors: L3, L4 |
| R7 | R1 probe; L6 failed compile publishes nothing and recovers; Y1 for stylesheets | Filesystem watching, transport, stale asynchronous publication |
| R8 | M1: Node resolves creator positions through composed ESM and CommonJS maps, including a non-ASCII source; System.register map decoded; S1 | Browser devtools and coverage-tool consumption |
| R9 | React is built separately for node and browser, Express for node only, each recorded in its report | Beyond module-manifest conditional selection; P1's platform mismatch |

`cjs-module-lexer@2.1.0` returns no names for upstream getter output, names and star re-exports for upstream's `platform: 'node'` annotation, and all of them for assigned exports (probe X1). The example uses the lexer as Packages does and cross-checks esbuild's ESM metadata. This is not full satisfaction of the broader matrix.

Package resolution in P3 checks declared ranges for workspace dependencies, validates public subpaths, and allows a package to compose its own public modules without declaring a dependency on itself. An esbuild import path, file input, or output chunk alone does not contain that contract. Type-only references likewise belong to declaration analysis, not automatically to the runtime public graph; declaration generation/type checking remains outside this initial assessment.

## Proposals to evaluate, not approved compiler changes

- Implemented in `beyond/graph/` as a bounded adapter: start with metafile inputs/outputs as graph evidence. A candidate adapter can annotate internal edges with source IDs and external edges with public specifiers and import kinds. It must join separately selected package/version information rather than infer it from paths.
- Characterized: erased unused imports (G2, F1, F2), cycles (F4) and rebuild edge removal (R1). Still to characterize before calling the graph complete: type-only imports, which need declaration analysis, and unresolved computed imports. Source relationships and emitted runtime dependencies may legitimately differ; preserve their meaning rather than merging them into one unlabeled set.
- Keep whole-module ESM bundling and per-file creator transformation as separate experimental modes. A successful ESM bundle does not establish compatibility with mutable legacy runtime exports.
- Consider a core fork adaptation only after an executable case exposes a needed capability unavailable through supported options, plugins, or a bounded adapter. Performance or convenience alone has no measured baseline here. One adaptation met that bar: [assigned CommonJS exports](cjs-exports.md), whose guide records the alternatives that were measured first.
- Proposed, not approved: emit re-exports as configurable accessors plus a lexer annotation so creators that re-export can be replaced in place. It departs from the TypeScript parity Packages documents today.

## Unknowns and integration gates

The final graph API, schema, identity normalization, computed-import policy and desired reverse-dependency invalidation are not settled by these sources. No benchmark or memory target was provided. No need for a broad parser/resolver rewrite has been demonstrated; the one compiler change is confined to CommonJS export emission in the linker and printer.

Kernel currently invalidates changed creators by hash, retains unchanged creators, and does not delete missing internal entries (K1). Rebuilding output cannot establish transitive reevaluation, atomic rollback, disposal, export-shape changes or preservation of every captured value. Final runtime naming and migration contracts remain open (S1). A future HMR claim needs the same live consumer to observe updates through original imports, with identity, update order, errors and cleanup asserted.

Before consumer migration, run the actual Packages compiled public-module path with its selected loader and dependencies; verify the esbuild implementation resolved at runtime. The two current consumer manifests select different upstream esbuild ranges. Merely placing this checkout next to them changes neither dependency resolution nor integration status.

## Extending the inventory

For each new requirement, add its actual consumer, repository revision and path; give a minimal fixture with an observable expectation. Label it confirmed, proposed or unknown. Record command, compiler revision, toolchain, pass/failure and the precise assertion in a separate run record. Targeted compiler changes needed for the three central paths are authorized; a failed probe must identify the specific missing contract before implementation, not justify a broad unrelated rewrite. Keep compiler-only results separate from end-to-end Beyond acceptance. Commits, pushes, publication and general consumer migration remain out of scope.
