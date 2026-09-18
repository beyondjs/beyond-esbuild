# Beyond ESBuild handoff

Updated 2026-09-18 after the second delivery. Durable contracts, commands and results live in `docs/`; this file only orients whoever resumes and can be retired once the open items below are decided. Inspect the task and Git state first: other suite work continues in parallel.

## State

- Fork <https://github.com/beyondjs/beyond-esbuild> of `evanw/esbuild`, branch `feature/next`, esbuild `0.28.2`. `4559612a` is the first delivery (fixtures, adapters, guides) on upstream `f6058f83`.
- The second delivery is committed locally on top of it with owner authorization, as two commits: `6241fc5a` is the compiler change with its regression suite and guide; the following commit holds the fixtures, tests and updated guides. Nothing was pushed or published, and no consumer was migrated. Further commits, pushes, publication and general consumer migration still need explicit authorization.
- The manual demo server may still be listening on `http://127.0.0.1:4178`; restart it with `node beyond/demo/server.mjs` after rebuilding.

## What the second delivery did

1. Reproduced the first-delivery baseline unchanged.
2. Compiler: `cjsExports: 'assign'` (`--cjs-exports=assign`), documented in `docs/cjs-exports.md` with the contract, the alternatives measured first, the implementation map and limits. Upstream snapshots and helper order are unchanged; regressions are `internal/bundler_tests/bundler_beyond_test.go`.
3. Authored path: creators are esbuild output unchanged (no bridge), names come from `cjs-module-lexer`, the assembler mirrors Packages (star composition, `_default`, ordering, reserved names), and maps are composed for ESM, CommonJS and System.register. `beyond/example/creators.test.mjs` holds cases L1–L6 and M1 against the actual Kernel.
4. Graphs: `beyond/graph/` keeps files, public modules and packages/versions separate, handles esbuild's erased-import metafile records, mirrors Packages' dependency diagnostics, and adds manifest-joined package edges to the React and Express reports.
5. Traditional packages: `react/jsx-runtime` is packaged and consumed by SSR and by the browser demo.
6. CSS: `beyond/demo/styles.mjs` with dependency invalidation and fail-closed rebuilds; the browser replaces a module stylesheet through the Kernel `change()` contract.

`docs/validation.md` has the exact commands and results: 16 Go packages, the authored runner, 25 Node tests, Chromium ESM and SystemJS.

## Open decisions for the owner

- Pushing `feature/next` to the fork remote. The second delivery is committed locally only.
- Re-exports in creators keep TypeScript's accessor boundary (cases L3, L4). Configurable accessors plus a lexer annotation would allow in-place replacement; recorded as a proposal in `docs/requirements.md`, not implemented.
- Whether Packages should adopt the fork for its TypeScript creator path. That is consumer migration and was not started; Packages pins upstream `esbuild ~0.25.9`.

## Remaining limits

Listed in `docs/validation.md#remaining-limits` and `docs/cjs-exports.md#limits`. In short: no watcher, transport, rollback or disposal; public shape changes need a reload; `import type` and computed specifiers are outside the graphs; nothing selects or solves versions; plain CSS only; System.register remains a TypeScript adapter; upstream JavaScript, WASM and end-to-end scripts were not run; assigned exports were not exercised with minification, splitting or ES5 lowering.

## Resuming

Read `AGENTS.md`, `docs/README.md`, `docs/setup.md`, `docs/beyond-architecture.md`, `docs/cjs-exports.md`, `docs/requirements.md` and `docs/validation.md`, then reproduce the second-delivery run from `docs/setup.md` before changing anything. `GO=/absolute/path/to/go` and `PLAYWRIGHT=/absolute/path/to/playwright` select local tooling. Install the complete pinned dependency list in one command.
