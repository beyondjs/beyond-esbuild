# Beyond ESBuild handoff

Updated 2026-09-18 after the third delivery. Durable contracts, commands and results live in `docs/`; this file only orients whoever resumes and can be retired once the open items below are decided. Inspect the task and Git state first: other suite work continues in parallel.

## Current execution-mode scope

The owner clarified that esbuild packaging is intended for production and development, with HMR required in development. Its output does not require internal creators. Development must eventually allow per-public-module selection between that path and the unified Kernel/Local runtime, provisionally checked out as `local-2026`. See [execution modes](../docs/execution-modes.md).

The third delivery worked within that scope: packaging, its update behavior and a bounded Packages integration. It did not implement the unified runtime or the complete mode switch. Existing creator tests remain valid compatibility evidence; their re-export limitation did not become a packaging requirement. The [continuation response](next-agent.md) is the request that delivery answered; a new continuation should start from the open decisions below.

## State

- Fork <https://github.com/beyondjs/beyond-esbuild> of `evanw/esbuild`, branch `feature/next`, esbuild `0.28.2`. Committed locally, not pushed: `4559612a` first delivery, `6241fc5a` the opt-in compiler change, `7efe3fb4` its fixtures and guides.
- The third delivery is committed locally on top of `7efe3fb4` with owner authorization: `beyond/packaging/`, `beyond/package.mjs`, `docs/packaging.md`, guide updates and the owner's execution-mode revisions. It changes no Go or `lib/` source. Nothing is pushed or published; further commits, pushes and publication need explicit authorization.
- The Packages trial is committed locally in the Packages checkout as `dbfd08f`: a new `modules/bundlers/esbuild/`, optional-patch changes in `modules/artifacts/` and `modules/sdk/conditional/esm/index.ts`, `tests/esbuild-packaging/` and documentation. It needs the Packages owner's review before anything else.
- The Engine instances this work started for Packages (1110–1112) and the watchers utility (1120) were stopped afterwards. The manual demo server may still be listening on `http://127.0.0.1:4178`; restart it with `node beyond/demo/server.mjs` after rebuilding.

## What the third delivery did

1. Established that the authored example implements runtime composition, and added a packaged authored path: `Authored`, `Packaged`, `Boundary`, cases K1–K5.
2. Re-exports reproduced through an independent consuming public module: correct in ESM, native CommonJS and assigned CommonJS. Development propagation depends on re-addressing public dependents through the graph (closure identity), not on the compiler; a loaded consumer is a reload boundary.
3. Assessed `cjsExports: 'assign'` per path: needed for creators only.
4. Generic published-package closure with pinned Vue, Radix, Headless UI and Lit (Svelte and Shoelace components are reported as unsupported since the architecture correction: the public module is the only division, no split build, no private chunks): framework source adapters, CommonJS adapters, conditional exports, subpaths, peer dependencies, styles, minification; Node SSR and Chromium, native ESM and the System.register adapter.
5. Two state hazards found by execution and handled in adapters: published siblings become public references; subpaths sharing unpublished files are split natively.
6. Packages trial: per-module selection through the existing `bundler` key, explicit compiler selection with the resolved identity reported, production conditional, watched development rebuild. 7 of 7; stage-1 still 21 of 21.

`docs/packaging.md` has contracts, findings, coverage and limits; `docs/validation.md` has the run record: 16 Go packages, 37 Node tests, the runner, two Chromium verifications, the Packages trial, and after the architecture correction 41 Node tests and the packaging Chromium verification again.

## Open decisions for the owner

- Pushing `feature/next` in the fork, Packages and the suite, and the Packages owner's review of the trial bundler.
- How Packages obtains the fork: a published identity and version policy, or a location setting as in the trial.
- The development update strategy for packaged modules: reload through the public graph, or finer replacement. The independent HMR audit addresses this; nothing here presumes its result.
- Whether CommonJS output is retired and whether System.register stays a delivery format in Packages. The adapter carried everything tried; no case justifies native emission.
- Where framework source adapters belong in Packages.
- Runtime composition only: replaceable re-exports in creators remain a proposal, not a packaging requirement.

## Remaining limits

Listed in `docs/packaging.md#remaining-work-and-blocking-decisions`, `docs/validation.md#remaining-limits-of-this-delivery` and `docs/cjs-exports.md#limits`. In short: no update reaches a running consumer in the packaging mode; the Packages bundler is Node-only, one module at a time, without closure identity, cohesion or adapters; coverage is the pinned list; the unified runtime was not involved.

## Resuming

Read `AGENTS.md`, `docs/README.md`, `docs/execution-modes.md`, `docs/packaging.md`, `docs/setup.md` and `docs/validation.md`, then reproduce the third-delivery run before changing anything. `GO=/absolute/path/to/go` and `PLAYWRIGHT=/absolute/path/to/playwright` select local tooling. Install each pinned dependency list completely, in one command per prefix. The Packages trial additionally needs Engine, BEE Node and the watchers utility as its README describes, and `BEYOND_ESBUILD` pointing at this checkout after `node beyond/package.mjs`.
