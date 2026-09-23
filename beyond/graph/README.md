# Three dependency graphs

Beyond keeps three graphs apart: internal source files, public modules and packages with versions. This directory traces the first with esbuild and joins the other two from explicit inputs, without merging their identities. The contracts and the metafile finding that shapes the traversal are in [Beyond compilation contracts](../../docs/beyond-architecture.md#three-graph-identities).

| Class | Responsibility |
| --- | --- |
| [`Traversal`](traversal.mjs) | One bundled esbuild pass from a module entry with every bare reference external, plus a transform of each traversed file alone. Yields direct edges with their kind, the transitive closure, erased edges and runtime cycles |
| [`Graph`](graph.mjs) | The three views of one public module: `files`, `modules` (bare specifier, importing file, kind, lazy, erased) and `packages` |
| [`Packages`](packages.mjs) | Bounded mirror of the artifact dependency validation in `beyondjs/packages` at `593b9f1cffb8af2e972af7030fd7a7ac8883af96`, `modules/artifacts/dependencies.ts:35–119`, over an explicit list of manifests |
| [`Installed`](installed.mjs) | Package boundaries crossed by an installed dependency tree, with the declared range and whether the installed version satisfies it; used by the React and Express builds |

```sh
node --test beyond/graph/graph.test.mjs
```

Cases F1–F3 copy the checked-in module of [`fixtures/module/`](fixtures/README.md) into a temporary workspace; it mixes internal, transitive, unused, type-only, lazy, `require`, builtin, same-package, undeclared, incompatible and undeclared-subpath references. F4 writes a second, three-line module with a cycle. The creator example writes the same three views for its fixture into `beyond/.cache/example/report.json` under `graphs`.

Nothing here selects a version or resolves a workspace: `Packages` is given its manifests, and `Installed` reads what npm already installed. `import type` edges and computed specifiers are not represented. The report shape is this assessment's, not an approved Beyond graph schema.
