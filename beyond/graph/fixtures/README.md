# Graph fixtures

## `module/`: one public module for F1–F3

[`graph.test.mjs`](../graph.test.mjs) copies this directory into a fresh temporary workspace for each of F1, F2 and F3 and traces it from `index.ts`. It is never edited. The module is not meant to build or run: its bare references name packages that do not exist, because each line exists to produce one kind of graph edge.

| File | Edge it contributes |
| --- | --- |
| `index.ts` | The entry. A runtime import of `./format`; a type-only import of `./types`; an unused value import of `./unused` and of `@fixture/gone/main` (erased); static imports of `@fixture/shared/message` and of `@fixture/app/settings` (a public module of the module's own package); the builtin `node:path`; the external `react`; a `require` of `@fixture/legacy/main`; lazy imports of `@fixture/shared/lazy` and `@fixture/strict/main` |
| `format.ts` | The internal edge to `nested/decoration.ts`, which the entry reaches only transitively |
| `nested/decoration.ts` | A public reference, `@fixture/shared/message`, owned by a transitive internal file |
| `types.ts` | A type-only file, absent from the runtime graph |
| `unused.ts` | A file imported but unused, so its edge is erased and it is not a runtime input |

Expected behavior: F1 finds one runtime internal edge from the entry, the transitive closure to `nested/decoration.ts`, the erased `./unused` edge and no cycle; F2 keeps every public edge bare with its importing file, kind and lazy flag, and marks `@fixture/gone/main` erased; F3 classifies `node:path` as builtin, `react` as external and the `@fixture/` references against the package manifests declared in the test, reporting `DEPENDENCY_INCOMPATIBLE` (`@fixture/strict/main`), `DEPENDENCY_NOT_DECLARED` (`@fixture/legacy/main`) and `MODULE_NOT_FOUND` (`@fixture/shared/lazy`).

Those manifests stay in the test as data: `Packages` receives an explicit list of manifests and no package directory is traversed. F4's two-file cycle also stays inline, as a three-line probe.

```sh
node --test beyond/graph/graph.test.mjs
```
