# React package acceptance

This case packages trusted installed `react@19.2.0` and `react-dom@19.2.0` using the compiler binary/API built from this fork. It represents third-party package composition, separately from Beyond-authored creator composition in `../example/`. It changes no React source or consumer installation and uses only upstream compiler behavior.

From the repository root, prepare the compiler and the pinned dependency workspace using the main capability guide, then run:

```sh
node beyond/react/build.mjs
node --test beyond/react/react.test.mjs
```

The build refuses another React/ReactDOM version. Inputs resolve from `beyond/.cache/runtime/node_modules/`; output is in `beyond/.cache/react/`. `report.json` records the actual resolved source, installed React/ReactDOM/scheduler versions, exported names and compiler provenance. Browser production artifacts are `react.mjs`, `react-jsx-runtime.mjs`, `react-dom.mjs`, `react-dom-client.mjs` and corresponding `.system.js` files. Map the bare names `react`, `react/jsx-runtime`, `react-dom` and `react-dom/client` to these files in the ESM or SystemJS import map. No installed React package is required in the browser.

CJS entry files are `react.cjs`, `react-jsx-runtime.cjs`, `react-dom.cjs`, `react-dom-client.cjs` and `react-dom-server.cjs`. They forward to a generated isolated `node_modules` package map containing the actual compiled implementations. ReactDOM's external `require('react')` resolves to that single built React instance, which is essential for hooks. The server artifact selects the installed Node server entry and keeps Node builtins external; this case does not produce a browser/SystemJS SSR implementation.

## Native compiler behavior and adapters

Esbuild natively bundles the internal files, emits CJS/ESM and supplies metafiles. The package's CommonJS default value does not automatically imply the desired public ESM named facade. This probe evaluates the fixed trusted installed package to enumerate its own export keys, generates an explicit default-plus-named ESM facade, and compiles it. This build-time evaluation is deliberate and is not an analyzer for arbitrary untrusted packages. Named facade values are snapshots; general mutable CommonJS named exports need a different contract.

Bare `react` and `react-dom` references stay external. Because ReactDOM's CommonJS source requires them, the ESM banner imports namespaces and provides a bounded require bridge for exactly those identities. Browser maps must supply the same built React module to every consumer. SystemJS output is an explicit TypeScript 5.8.3 `transpileModule` conversion of emitted ESM to `System.register`; it is not a native esbuild output format. The bridge's imports are in the emitted code, but banner-inserted imports are not additional scanner observations in esbuild's metafile.

`*.graph.json` retains per-input direct edges and output metadata. Traversing those edges gives the transitive file graph. Each file separately carries its installed package identity; the package list includes bundled scheduler 0.27.0 for the client. Public external edges remain specifiers. `packageEdges` is a third, separate record joined from the installed manifests by [`Installed`](../graph/installed.mjs): one entry per package boundary that a traversed file crosses, with the declaring field, the declared range, whether the installed version satisfies it, and whether the target was bundled or left public. For the client these are `react-dom -> react` (peer `^19.2.0`, public) and `react-dom -> scheduler` (`^0.27.0`, bundled). These graphs neither infer Beyond's package/version selection nor turn npm internal files into Beyond public modules. They are compilation graphs, with normal pruning limitations.

## Executed acceptance and limits

On 2026-09-18, Node 22.21.1 with fork baseline `f6058f8364fe7ab91ca57a83e02577ed74c9cae4` (esbuild 0.28.2, built with Go 1.27.1 darwin/arm64) passed both tests:

- A fresh Node process evaluating the checked-in consumer [`fixtures/consumer.cjs`](fixtures/README.md) loads only compiled CJS artifacts, observes one React identity, executes a component using `useState`, and renders the exact expected HTML with built ReactDOM server. Its require cache must contain no source from the installed input dependency workspace.
- The client graph includes scheduler package identity, internal file edges, external React edges and exactly the two satisfied package edges above; all four System artifacts contain `System.register`.

The second delivery reran both tests against the modified compiler at `4559612a` plus uncommitted changes, with SSR now rendering through the packaged `react/jsx-runtime`; see [validation](../../docs/validation.md#second-delivery-compiler-change-and-remaining-contracts).

These tests do not claim browser rendering or interaction; the `../demo/` acceptance owns actual ESM/SystemJS browser execution. They do not establish hydration, streaming SSR, React Server Components, arbitrary conditional exports, all React API behavior or HMR. Preserve the package license headers retained in outputs and the original package licenses when distributing artifacts; this workspace does not publish them.
