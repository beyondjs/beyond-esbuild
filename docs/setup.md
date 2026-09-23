# Build and execute the assessment

Run all commands from the repository root. Use Node 22 or newer, a Go toolchain compatible with upstream `go.mod`, npm, and local network permission for dependency downloads and loopback HTTP tests. The recorded baseline is Node 22.21.1 and Go 1.27.1. No global package installation is needed.

## Prepare compiler and dependencies

```sh
node beyond/prepare.mjs
npm install --prefix beyond/.cache/runtime --no-save --package-lock=false @beyond-js/kernel@0.1.12 cjs-module-lexer@2.1.0 typescript@5.8.3 react@19.2.0 react-dom@19.2.0 systemjs@6.15.1 express@5.1.0 semver@7.5.4
```

Always install the complete list in one command. Because nothing is saved to a manifest, installing a single additional package makes npm remove every package that is not named in that command.

Set `GO=/absolute/path/to/go` on preparation if Go is not on `PATH`. Standard `GOCACHE` and `GOMODCACHE` variables can select writable Go caches. Preparation builds the checked-out Go compiler and its matching JavaScript API into `beyond/.cache/`, with toolchain/revision provenance. Rerun it after compiler changes. A base commit does not identify uncommitted source modifications; retain the relevant diff with any future result.

The pinned top-level packages make each scenario explicit; `semver` evaluates declared ranges in the package/version graphs, as Beyond Packages does. Their transitive versions are recorded from the actual installation in generated graph reports; this command does not create a permanent dependency lockfile. The authored example additionally supports `BEYOND_DEPENDENCIES=/absolute/path/to/node_modules`; other scenarios use the isolated default installation.

## Node and compiler checks

```sh
node --test beyond/capabilities.test.mjs
node beyond/example/run.mjs
node --test beyond/example/creators.test.mjs
node --test beyond/graph/graph.test.mjs
node --test beyond/demo/styles.test.mjs
node --test beyond/react/react.test.mjs
node --test beyond/express/express.test.mjs
```

The creator, graph and style tests build disposable fixtures in the system temporary directory and remove them; the graph test copies its module from the checked-in `beyond/graph/fixtures/module/`. Checked-in source fixtures live under each area's `fixtures/`, each with a README, and a run never edits them; the [workspace guide](../beyond/README.md#tests-fixtures-and-generated-output) lists them and the inputs that stay inline. `creators.test.mjs` links the pinned Kernel into each fixture and starts child Node processes with `--enable-source-maps`.

React and Express tests build their own artifacts. Their standalone build commands are useful when preparing the browser demo or inspecting output:

```sh
node beyond/react/build.mjs
node beyond/express/build.mjs
```

The creator example leaves initial artifacts, patches, source maps, the three-graph report and provenance under `.cache/example/`; React leaves ESM/System.register/CommonJS artifacts and graphs under `.cache/react/`; Express leaves Node ESM/CommonJS and graphs under `.cache/express/`, all beneath `beyond/`. The creator runner copies the selected Kernel into its isolated generated package map. The React and Express tests evaluate their checked-in consumers, `beyond/react/fixtures/consumer.cjs` and `beyond/express/fixtures/consumer.mjs`, in those output directories. Express tests bind an ephemeral loopback port, make real HTTP requests and close the server.

## Packaging cases

The [packaging mode](packaging.md) cases use their own pinned installation, so they never disturb the one above. Install the complete list in one command here too:

```sh
npm install --prefix beyond/.cache/ecosystem --no-save --package-lock=false vue@3.5.43 @vue/compiler-sfc@3.5.43 @vue/server-renderer@3.5.43 svelte@5.57.0 react@19.2.0 react-dom@19.2.0 @radix-ui/react-tabs@1.1.21 @headlessui/vue@1.7.23 @shoelace-style/shoelace@2.20.1 lit@3.3.3
node --test beyond/packaging/packaging.test.mjs beyond/packaging/ecosystem.test.mjs beyond/packaging/boundaries.test.mjs
node beyond/packaging/ecosystem.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/packaging/verify.mjs
```

`BEYOND_ECOSYSTEM=/absolute/path` selects another directory that contains the `node_modules` of that list. `packaging.test.mjs` copies the authored packages of `beyond/packaging/fixtures/counter/` into a disposable directory, builds them and starts child Node processes that resolve only through the import maps the build wrote. `ecosystem.mjs` writes `beyond/.cache/packaging/<platform>.<environment>/` with the authored and package artifacts, `importmap.json` and the two reports; the verifier adds `browser.json` and `browser.png`, and a `browser.production.system/` tree for the System.register adapter run. `BEYOND_COHESION=off` on the verifier is the negative control of the split build and is expected to fail.

`node beyond/package.mjs` lays the prepared compiler out as an unpublished, self-contained package under `beyond/.cache/npm/node_modules/esbuild`, with the native binary of this platform as its sibling package and a `beyond.json` that records revision, toolchain and binary digest. It is what the Packages trial selects by location; rerun it after `prepare.mjs`.

## Compiler checks

Run these after changing Go or `lib/` sources, with the same `GOCACHE`/`GOMODCACHE` selection as preparation:

```sh
go vet ./internal/linker ./internal/js_printer ./internal/runtime ./pkg/api ./pkg/cli
go test ./internal/... ./pkg/... ./cmd/...
```

`UPDATE_SNAPSHOTS=1 go test ./internal/bundler_tests -run TestBeyond` regenerates only the fork's `snapshots_beyond.txt`. Never refresh an upstream snapshot to make a change pass; a differing upstream snapshot means the change leaked into upstream behavior. The JavaScript API sources can be type-checked without installing into `lib/`:

```sh
npm install --prefix beyond/.cache/lib-types --no-save --package-lock=false @types/node@25.5.0
node beyond/.cache/runtime/node_modules/typescript/bin/tsc -noEmit -p lib/tsconfig.json --typeRoots beyond/.cache/lib-types/node_modules/@types
```

## Browser demo

Prepare authored and external package outputs before starting the demo:

```sh
node beyond/example/run.mjs
node beyond/react/build.mjs
node beyond/demo/build.mjs
node beyond/demo/server.mjs
```

Open the local URL printed by the server, normally `http://127.0.0.1:4178`; `PORT` selects another port. The demo exposes native ESM and SystemJS modes, React interaction, a Beyond update action, independently adopted styles and a control that re-adopts the app module stylesheet through the Kernel change contract; rebuild with `node beyond/demo/build.mjs` after editing a fixture stylesheet, then use that control. Serving these outputs locally demonstrates the distribution contract; it does not deploy or change Beyond's production CDN. Stop the manual server with Ctrl-C when finished.

For an isolated Playwright installation and browser verification:

```sh
npm install --prefix beyond/.cache/browser --no-save --package-lock=false playwright@1.62.1
node beyond/.cache/browser/node_modules/playwright/cli.js install chromium
PLAYWRIGHT="$PWD/beyond/.cache/browser/node_modules/playwright" node beyond/demo/verify.mjs
```

Alternatively, set `PLAYWRIGHT` to an existing installation's absolute module path. With Playwright resolvable directly from the repository, `node beyond/demo/verify.mjs` also works. The verifier starts its own ephemeral loopback server and closes it and Chromium afterward; it does not need the manual server. Browser evidence comes from running the page and checking behavior/computed styles, not from searching generated code for format strings. The recorded run used an existing Playwright installation rather than executing the fresh-install commands above.

## Interpreting results

`beyond/.cache/provenance.json` names the compiler revision/toolchain; the revision is the checked-out commit and does not describe uncommitted compiler changes. Per-scenario reports name selected package versions and artifacts. The [validation record](validation.md) and scenario run guides distinguish execution from emitted-only formats and remaining cases. Expected-limitation tests can pass while documenting unsupported behavior; their success is not proof that the corresponding production requirement has been solved.
