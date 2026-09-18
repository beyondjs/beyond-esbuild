# Express package acceptance

This Node-only case packages trusted installed `express@5.1.0` with the exact compiler/API built from this fork. It preserves upstream source and does not migrate any consumer.

After the main capability preparation installs pinned dependencies under `beyond/.cache/runtime/`, run from the repository root:

```sh
node beyond/express/build.mjs
node --test beyond/express/express.test.mjs
```

Artifacts are `beyond/.cache/express/express.cjs` and `express.mjs`; `report.json` records resolved input, version, compiler provenance and public names. `cjs.graph.json` and `esm.graph.json` retain file edges, manifest-joined `packageEdges` (declaring field, range and whether the installed version satisfies it for every crossed package boundary), separate installed package identities (including Express's transitive dependencies), external builtins and output metadata. The graph records compiled reachability, not an exhaustive authoring/declaration graph or Beyond package resolver result.

CJS is bundled natively. ESM uses an explicit facade whose default is Express's callable CommonJS export; named values are enumerated from the fixed trusted installed package. Reserved export names such as `static` use local aliases. An ESM banner imports Node `createRequire` for remaining runtime builtin/computed requires. Named facade exports are snapshots, not a general mutable CommonJS live-binding implementation. This build intentionally evaluates only the pinned trusted package to discover its own export keys.

Both formats bundle the installed dependency tree and retain Node builtins externally. No SystemJS/browser artifact is generated: Express's HTTP server contract requires Node APIs. Computed view-engine requires are not statically resolvable; optional templates and dynamically selected engines are outside this fixture and may require an explicit external deployment policy.

On 2026-09-18, all three tests passed with Node 22.21.1, esbuild 0.28.2 baseline `f6058f8364fe7ab91ca57a83e02577ed74c9cae4` built by Go 1.27.1 darwin/arm64. Each format starts a real loopback HTTP server in a fresh Node process, installs JSON middleware, handles a parameterized POST route, and verifies status/body. The CJS require cache must contain only built output paths, excluding installed source dependencies. The graph test checks Express 5.1.0, router and external edges, and that each of the more than 20 transitive package edges is declared and satisfied by the installed version. The first sandbox execution could not listen (`EPERM`); the same tests passed when allowed local loopback access. The server always closes after the request.

This proves the tested middleware/routing vertical, not every Express feature, template engine, optional dependency, file serving policy or deployment platform. Keep original dependency licenses when distributing artifacts; this workspace does not publish them.
