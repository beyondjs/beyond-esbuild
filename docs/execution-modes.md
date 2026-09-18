# Module compilation and development modes

## Confirmed direction

Beyond must support two selectable delivery modes per public module. Per-module selection is required during development; esbuild packaging also serves production compilation. This does not establish a production requirement to ship the advanced development runtime.

| Mode | Required output and purpose | Development updates |
| --- | --- | --- |
| esbuild packaging | Compile and bundle the public module for distribution, with production compilation a primary objective. Internal source files remain compiler/graph inputs; the output does not require Beyond's per-file creator registry or runtime internal-module objects. Preserve public module boundaries, intended exports and bare public dependencies. | Support development use and HMR through an explicitly implemented and tested integration. Successful rebuilds or legacy Kernel patch tests alone do not prove this mode's HMR. |
| Unified Beyond runtime | Preserve internal-module identity/composition and the advanced development behavior of the planned Kernel/Local integration. `local-2026` is its provisional checkout name, not a final public package name. | Validate its finer-grained internal updates and runtime contract independently. This is the mode in which creators and internal runtime objects have meaning. |

A compiler implementation can also be used to transform source for the runtime mode. That use of esbuild does not turn a creator-bearing artifact into the esbuild packaging mode. Distinguish the selected output/runtime contract from the tool that happened to transform its inputs.

## Primary packaging objective and complementary compiler use

The primary esbuild use case is modular packaging of public packages, including third-party packages such as React, for independent consumption and distribution without requiring Kernel. Package entry points, public subpaths and dependency boundaries remain explicit. Existing React/Express fixtures provide bounded evidence toward this objective; their results do not establish support for arbitrary packages.

Using esbuild to transform creators consumed by Kernel is a separate, potentially useful compiler role. Packaging the Kernel implementation itself as a public package is a third operation and must not be confused with producing those creators. Granular internal-module HMR should be evaluated for actual benefits and lifecycle correctness against simpler update strategies; the architecture does not establish its comparative value without evidence.

## Package coverage and format policy

Broad ecosystem packaging is the primary compatibility goal, not a claim that every published package already works. Acceptance should include pinned versions of React (browser and SSR), Express (Node), Vue and Svelte, plus representative UI controls. Distinguish consuming published JavaScript from compiling framework-specific source components; record required framework compilers/adapters explicitly. Run actual consumers and cover public subpaths, conditional exports, CommonJS inputs, assets/styles, peer dependencies and production minification where applicable. Report unsupported cases instead of inferring universal compatibility from a few fixtures.

ESM is the proposed preferred public distribution output. CommonJS input compatibility is a separate concern and remains necessary for ecosystem coverage; discussing deprecation of CommonJS output does not authorize removing CommonJS input support or creator compatibility. No output removal is approved by this guide.

Upstream esbuild supports ESM, CommonJS and IIFE output ([official format API](https://esbuild.github.io/api/#format)). The current fork's System.register output uses an explicit TypeScript adapter. Native System.register emission would be a separate compiler feature requiring demonstrated consumer need and regression coverage; it is not approved or a prerequisite for this packaging delivery. Preserve existing compatibility while evaluating whether a direct emitter is justified.

## Per-module selection and shared contracts

During development, a module must be selectable between these modes without changing its public identity or forcing every module into the same mode. Packages must resolve the selected compiler/runtime path explicitly. Preserve independent module boundaries when esbuild bundles internal files; bundling internals does not authorize flattening all public modules or packages into an application-wide artifact.

Keep source-file traversal, public-module dependencies and package/version resolution separate in both modes. Confirm behavior when a selected module is consumed by another public module, including differently selected modes. Configuration keys, defaults, cache/artifact discrimination and exact switching mechanics must be derived from existing Packages design. No new configuration syntax is established by this document. Selection does not promise that switching an already running module between modes preserves all state without a restart; that lifecycle behavior remains to specify and test.

## HMR and re-exports

HMR is a required development outcome for the esbuild packaging mode, not a demonstrated capability of the current fixture or a claim that esbuild alone supplies an application runtime. Compilation/rebuild, change delivery, loaded-code replacement and consumer behavior require separate evidence. Keep production output independent of an author's development server and avoid requiring a development-only creator registry merely because it was used in a proof.

Reproduce re-export behavior in the mode under investigation. A failure while replacing a creator in the legacy Kernel is evidence about that runtime composition; it does not by itself prove a defect in an ordinary esbuild-packaged module. Conversely, a successful packaged build does not validate the unified runtime's internal update semantics. Keep existing creator tests as scoped compatibility evidence, not universal acceptance for every esbuild output.

## Required acceptance and current evidence

- Build a public module and its independent public dependency through the esbuild packaging path; execute its distributable artifact without an authoring Dev Server or mandatory internal creator registry.
- Run that same selected mode in development, change a dependency or re-export and demonstrate the intended HMR behavior through an already loaded consumer. Identify every update layer and any explicit reload boundary.
- Select the unified-runtime mode for the module and verify its internal identities and update contract independently; do not substitute legacy Kernel fixtures for a completed `local-2026` integration.
- Exercise per-module selection and public dependency interoperability, with separated cache/artifact identity and no silent fallback to a different mode.
- Integrate the fork into the actual Packages path and verify the resolved compiler source/version. Do not infer adoption from adjacent checkouts or isolated fixtures.

These are confirmed requirements and acceptance targets. Existing creator/Kernel proofs, external React/Express builds and graph tests retain their recorded results, but they do not demonstrate this two-mode selection contract or esbuild-packaging HMR. Implementation and production integration remain open. The unified-runtime requirements define the architectural boundary; they do not expand an esbuild implementation task into building that runtime.

Status recorded after this guide was written: [the packaging guide](packaging.md#status-against-the-execution-mode-acceptance) lists what has since been executed against each target above and what is still missing. The targets themselves are unchanged.
