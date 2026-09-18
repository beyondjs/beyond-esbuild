# Build and execute the assessment

Run all commands from the repository root. Use Node 22 or newer, a Go toolchain compatible with upstream `go.mod`, npm, and local network permission for dependency downloads and loopback HTTP tests. The recorded baseline is Node 22.21.1 and Go 1.27.1. No global package installation is needed.

## Prepare compiler and dependencies

```sh
node beyond/prepare.mjs
npm install --prefix beyond/.cache/runtime --no-save --package-lock=false @beyond-js/kernel@0.1.12 cjs-module-lexer@2.1.0 typescript@5.8.3 react@19.2.0 react-dom@19.2.0 systemjs@6.15.1 express@5.1.0
```

Set `GO=/absolute/path/to/go` on preparation if Go is not on `PATH`. Standard `GOCACHE` and `GOMODCACHE` variables can select writable Go caches. Preparation builds the checked-out Go compiler and its matching JavaScript API into `beyond/.cache/`, with toolchain/revision provenance. Rerun it after compiler changes. A base commit does not identify uncommitted source modifications; retain the relevant diff with any future result.

The pinned top-level packages make each scenario explicit. Their transitive versions are recorded from the actual installation in generated graph reports; this command does not create a permanent dependency lockfile. The authored example additionally supports `BEYOND_DEPENDENCIES=/absolute/path/to/node_modules`; other scenarios use the isolated default installation.

## Node and compiler checks

```sh
node --test beyond/capabilities.test.mjs
node beyond/example/run.mjs
node --test beyond/react/react.test.mjs
node --test beyond/express/express.test.mjs
```

React and Express tests build their own artifacts. Their standalone build commands are useful when preparing the browser demo or inspecting output:

```sh
node beyond/react/build.mjs
node beyond/express/build.mjs
```

The creator example leaves initial artifacts, patches and provenance under `.cache/example/`; React leaves ESM/System.register/CommonJS artifacts and graphs under `.cache/react/`; Express leaves Node ESM/CommonJS and graphs under `.cache/express/`, all beneath `beyond/`. The creator runner copies the selected Kernel into its isolated generated package map. Express tests bind an ephemeral loopback port, make real HTTP requests and close the server.

## Browser demo

Prepare authored and external package outputs before starting the demo:

```sh
node beyond/example/run.mjs
node beyond/react/build.mjs
node beyond/demo/build.mjs
node beyond/demo/server.mjs
```

Open the local URL printed by the server, normally `http://127.0.0.1:4178`; `PORT` selects another port. The demo exposes native ESM and SystemJS modes, React interaction, a Beyond update action and independently adopted styles. Serving these outputs locally demonstrates the distribution contract; it does not deploy or change Beyond's production CDN. Stop the manual server with Ctrl-C when finished.

For an isolated Playwright installation and browser verification:

```sh
npm install --prefix beyond/.cache/browser --no-save --package-lock=false playwright@1.62.1
node beyond/.cache/browser/node_modules/playwright/cli.js install chromium
PLAYWRIGHT="$PWD/beyond/.cache/browser/node_modules/playwright" node beyond/demo/verify.mjs
```

Alternatively, set `PLAYWRIGHT` to an existing installation's absolute module path. With Playwright resolvable directly from the repository, `node beyond/demo/verify.mjs` also works. The verifier starts its own ephemeral loopback server and closes it and Chromium afterward; it does not need the manual server. Browser evidence comes from running the page and checking behavior/computed styles, not from searching generated code for format strings. The recorded run used an existing Playwright installation rather than executing the fresh-install commands above.

## Interpreting results

`beyond/.cache/provenance.json` names the compiler revision/toolchain. Per-scenario reports name selected package versions and artifacts. The [validation record](validation.md) and scenario run guides distinguish execution from emitted-only formats and remaining cases. Expected-limitation tests can pass while documenting unsupported behavior; their success is not proof that the corresponding production requirement has been solved.
