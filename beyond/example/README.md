# Executable Beyond creator composition

This small adapter compiles four internal TypeScript files into **four separate creators inside one public module**. It does not flatten the internals into an ordinary esbuild bundle. The generated module imports a second public module by bare name and executes against the actual `@beyond-js/kernel@0.1.12` runtime. CommonJS, ESM and System.register artifacts preserve the same creator composition.

The fixture is an assessment adapter, not a replacement Packages bundler. It changes no compiler core, consumer implementation or package resolution configuration.

## Run

Use Node 22.21.1 or a compatible newer Node release. First prepare the fork compiler as described in the [assessment guide](../README.md). From the fork root:

```sh
node beyond/prepare.mjs
npm install --prefix beyond/.cache/runtime --no-save --package-lock=false @beyond-js/kernel@0.1.12 cjs-module-lexer@2.1.0 typescript@5.8.3
node beyond/example/run.mjs
```

`GO` may select a Go executable for preparation. Dependency installation stays in ignored assessment output. Alternatively, select an existing dependency directory explicitly; the script checks the Kernel version and records the runtime file digest:

```sh
BEYOND_DEPENDENCIES=/absolute/path/to/node_modules node beyond/example/run.mjs
```

The script copies the selected Kernel package into an isolated generated `node_modules`, uses the fork-built API/binary and leaves all generated files under `beyond/.cache/example/`. It overwrites its generated fixture sources and output when rerun. It does not edit the original dependency installation or source fixture.

Inspect these paths after execution:

| Generated path, relative to `beyond/.cache/example/` | Content |
| --- | --- |
| `node_modules/@fixture/app/main.mjs` | Actual public ESM: bare shared import, four creator/hash records, dependency table, descriptor, live public bindings and initialization |
| `node_modules/@fixture/app/main.cjs` | CommonJS envelope transformed by the fork; actually loaded with Node `require` |
| `node_modules/@fixture/app/main.system.js` | System.register envelope converted with TypeScript; browser input |
| `node_modules/@fixture/shared/message.mjs` | Independently addressable public dependency with its own creator |
| `node_modules/@fixture/shared/message.cjs`, `message.system.js` | Shared public module in matching CommonJS/System.register formats |
| `patch.mjs`, `patch.cjs`, `patch.system.js` | Updates targeting the existing app Bundle/Package identity in each format |
| `consumer.mjs` | Original native ESM consumer retained while the patch executes |
| `report.json` | Runtime/compiler provenance, internal hashes, exports and three separate graph views |

The `traversal` report uses a separate native esbuild `bundle: true` build over real files, with bare packages externalized. Its `inputs` records supply classified internal/public edges, including direct `index.ts -> format.ts` and transitive `format.ts -> decoration.ts`. The traversal output is **not** the distributed artifact; it is graph evidence. No duplicate parser reconstructs those relationships. Package edges come from the fixture's explicit manifests, not esbuild metadata or a general version solver.

The additional `emittedMetadata` field preserves per-file ESM metadata used during assembly. Its raw `external: true` flags also appear on relative imports because that separate analysis uses `bundle: false`; those flags do **not** mean the corresponding files are public modules. This flat fixture needs no nested relative-ID normalization.

## Assembly and evidence

1. [Compiler](compiler.mjs) transforms each source independently to CommonJS with the fork. A separate non-bundled ESM analysis supplies its emitted export names and import kinds.
2. Each creator contains a local `module` object for esbuild's generated `module.exports`. After evaluation, the adapter copies its enumerable values by assignment into the existing Kernel exports proxy. This avoids attempting to install esbuild's non-configurable getter descriptors directly on that mutable object.
3. [Assembler](assembler.mjs) imports dependency namespaces by bare name and registers them with `__pkg.dependencies.update`. It emits the `ims` map, creator hashes, entry-only export descriptor, live public `export let` bindings and retained export-processing closure.
4. The initial artifact creates `new Bundle(...).package()` and calls `initialise(ims)`. The patch retrieves `instances.get(vspecifier).package()` and calls `update(ims)`, retaining the original public namespace and runtime identity.
5. [Formats](formats.mjs) keeps the composed ESM, transforms its outer envelope to CommonJS with the fork, and converts it to `System.register` with TypeScript 5.8.3. Esbuild has native ESM/CommonJS output, **not native SystemJS output**. The SystemJS stage is an explicit adapter; it does not merge the internal creators. CommonJS substitutes the artifact's actual file URL for ESM `import.meta.url`.

The CommonJS and ESM runtime registries are separate execution environments. Each format's consumer and patch resolve the matching Kernel artifact through Node package conditions. Neither run assumes they share the same instance registry.

For the actual browser integration, map `@fixture/app/main` to `main.system.js`, `@fixture/shared/message` to `message.system.js`, and `@beyond-js/kernel/bundle` to `node_modules/@beyond-js/kernel/bundle/bundle.sjs.js` under the generated output. Load them with an actual SystemJS loader. `run.mjs` generates these artifacts; it does not itself launch a browser. Browser execution belongs to the combined demo's separate evidence.

These shapes follow the inspected sources:

- `beyondjs/engine`, revision `7502043f9638e558007b980f5ef219510b6c8866`: `lib/engine/process/bundler/bundle/packager/code/js/package/process.js`, `ims/im.js`, `exports/index.js`, `initialisation.js`.
- `beyondjs/packages`, revision `593b9f1cffb8af2e972af7030fd7a7ac8883af96`: `modules/sdk/conditional/esm/index.ts`, `modules/bundlers/ts/processors/ts/transpiler.ts`, `analyzer.ts`.
- `beyondjs/kernel`, revision `b06d67d93701c915adca312e5308e15f371c7330`: `src/modules/bundle/package/index.ts`, `exports.ts`, `ims/im.ts`, `ims/index.ts`.

The executable uses the **installed 0.1.12 artifact**, not compilation of that Kernel checkout. Its exact path and SHA-256 appear in `report.json`. The sources above explain the contract; the run verifies the selected installed artifact independently.

## Why cjs-module-lexer is relevant

Packages declares `cjs-module-lexer ~2.1.0`. Its exports bundler parses bundled CommonJS to find export names before emitting an ESM wrapper. Its TypeScript analyzer parses emitted creator bodies for exports and re-exports; ordinary bare `require` dependencies are collected separately with a regular expression. The lexer is not the package-version resolver or a complete dependency graph engine.

The fixture **executes** `cjs-module-lexer@2.1.0` against the fork's CommonJS output and asserts that its export list is empty for the helper-based esbuild export pattern. The ESM metafile reports `answer`, `main`, and `runs`, and those names drive the bounded assembly. This is a concrete compatibility difference, not evidence that either library is broken or must be rewritten.

## Executed result

On 2026-09-18, the example passed with fork revision `f6058f8364fe7ab91ca57a83e02577ed74c9cae4`, esbuild `0.28.2`, Go `1.27.1`, Node `22.21.1`, Kernel `0.1.12`, and cjs-module-lexer `2.1.0`. It first used an explicitly selected existing dependency directory, then passed again with the pinned isolated npm installation and default runner path. Browser ESM/SystemJS execution and retained-consumer patches subsequently passed in the [integrated demo](../demo/README.md); see the [final validation record](../../docs/validation.md).

Assertions establish four creator records, an unflattened shared bare import, entry-only public exports, native transitive file traversal, initial execution returning `[app] Hello Beyond` and `answer = 42`, deterministic unchanged hashes, a changed entry hash with unchanged helper hashes, and `answer = 43` through the **original** consumer after the patch. Both actual Node CommonJS `require` and ESM `import` execute successfully and retain their respective runtime package identities after their patches. The counter's static state survives in its unchanged internal module and advances from `1` to `2` when the entry runs again.

## Deliberate limits

The assignment bridge snapshots each exported value when its creator completes. It supports this fixture's function/class/constants and replacement updates; arbitrary later mutation of an exported variable is not automatically mirrored into the Kernel proxy. The outer public bindings are live across the demonstrated patch, but that does not prove general ESM live-binding equivalence inside creators.

Only explicit `.ts` source lists and ordinary named entry exports are supported. Default/reserved entry exports and re-export declarations are rejected by the example's bounded guards; the latter are fixture guards, not a full parser. Cycles, computed dynamic imports, top-level await, shape-changing exports, namespace re-exports, file deletion, resource disposal, arbitrary CJS packages and source-map concatenation are not implemented or validated here. Inputs must be trusted local fixtures. There is no filesystem watcher, HTTP transport, notification ordering or reconnect behavior. A complete Packages integration must retain those separate responsibilities.

Add new cases by keeping the fixture sources small, stating which compiler or runtime contract is under test, asserting behavior through the retained consumer, and recording observed failures before extending the adapter. Do not convert this proof into a claim of production-ready integration.
