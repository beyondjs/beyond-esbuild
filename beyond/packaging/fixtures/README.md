# Packaging fixtures

Authored packages for the [packaging mode](../README.md). Each directory is an ordinary package: a `package.json` whose `exports` point to source files, and those sources. Nothing here is built in place or compiled by upstream esbuild tooling; a harness either copies a group into a temporary directory or reads it as build input, and writes every output elsewhere.

## `counter/`: three packages for K1–K5

Copied into a fresh temporary workspace by each case of [`packaging.test.mjs`](../packaging.test.mjs); K2 copies it once per native output.

| Package | Public modules (`exports`) | Sources |
| --- | --- | --- |
| `@fixture/values` | `./counter`, `./again` | `counter/index.ts` holds a reassigned `count`, `increment()` and a default class `Counter`; `counter/step.ts` the step it adds; `shared.ts` a private stateful file; `again/index.ts` re-exports `increment` from the `counter` entry through a relative import and `token` from `shared.ts` |
| `@fixture/facade` | `./api`, `./plain` | `api/index.ts` only re-exports: a star and a default from `@fixture/values/counter`, an internal `helper` renamed `aid`, and `total`/`bump` from `api/totals.ts`, which calls `increment()`; `plain/index.ts` is unrelated to the counter |
| `@fixture/consumer` | `./main` | `main/index.ts` imports the facade by namespace and by name, re-exports `increment` and `bump`, and exposes `observe()` and `fail()` |

Expected behavior: the packaged `@fixture/consumer/main` runs with no Beyond runtime and keeps `@fixture/facade/api` as its only public reference (K1); a reassigned `count` is observed through the star, named and internal re-exports in ESM and both CommonJS forms (K2); a change to `step.ts` gives a new address to every public dependent and none to `@fixture/facade/plain` (K3); the relative import of the `counter` entry stays a public reference while `shared.ts` is copied into each module that bundles it (K4); and the throw in `fail()` at `main/index.ts:8:9` is located through the minified artifact's map (K5). K5 depends on that line and column.

Scenario edits, applied to the temporary copy only: K3 rewrites `values/counter/step.ts` to `export const step = 10;`, and K4 appends `export { token, state } from '../shared';` to `values/counter/index.ts`. The manifests are compact single-line JSON.

## `vue-app/`, `svelte-app/`, `controls/`: the ecosystem targets

Build inputs of [`ecosystem.mjs`](../ecosystem.mjs), selected by name; they are read, never edited. Every ecosystem case (E1–E8 in [`ecosystem.test.mjs`](../ecosystem.test.mjs)) runs over the build of all three. Their dependencies are the pinned packages of the ecosystem installation described in [setup](../../../docs/setup.md#packaging-cases).

| Package | Public modules | Used by |
| --- | --- | --- |
| `@fixture/vue-app` | `./main` (`main/index.ts`, mounts `main/App.vue` with Headless UI), `./server` (`server/index.ts`, server rendering of the same component) | E1 renders `./server` on Node; `verify.mjs` mounts `./main` in Chromium |
| `@fixture/svelte-app` | `./main` (`main/index.js`, mounts `main/Counter.svelte`), `./server` | E2 and E6: both modules are reported as unsupported and never offered to a consumer |
| `@fixture/controls` | `./tabs` (`tabs/index.tsx`, Radix tabs in React), `./shoelace` (`shoelace/index.ts`, Shoelace components) | `verify.mjs` mounts `./tabs`; E6 reports `./shoelace` as blocked |

Run them with the commands in [the packaging guide](../README.md).
