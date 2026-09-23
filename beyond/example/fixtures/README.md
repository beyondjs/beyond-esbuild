# Creator example fixtures

Two authored Beyond packages compiled by [`run.mjs`](../run.mjs), the creator-composition example described in [the example guide](../README.md). The runner copies this whole directory to `beyond/.cache/example/sources/` and edits only that copy; the browser demo then consumes the generated output.

| Directory | Public module | Sources |
| --- | --- | --- |
| `shared/` | `@fixture/shared/message` | `index.ts`: `greeting()` |
| `app/` | `@fixture/app/main` | `index.ts` (entry: `answer`, `runs`, `main()`), `format.ts`, `counter.ts` (a private static counter kept across patches) and `decoration.ts`, reached only through `format.ts` |

Expected behavior: the four `app/` files become four creators inside one public module that imports `@fixture/shared/message` by bare name and runs on the real Kernel as ESM, CommonJS and System.register; the runner then changes `answer = 42` to `answer = 43` in its copy of `app/index.ts` and applies the rebuilt entry as a patch that the original consumers observe, while the other creators keep their hashes. The graph report traces `index.ts -> format.ts -> decoration.ts`.

```sh
node beyond/example/run.mjs
```

The creator cases L1–L6 and M1 of `creators.test.mjs` do not use these files: each builds a small probe module of one to three short files, written inline, that isolates one creator behavior.
