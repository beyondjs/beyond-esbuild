# Real browser and modular CSS fixture

This page consumes two independently built paths: the authored Beyond module from `example/` and existing React/ReactDOM packages from `react/`. The same JSX component is compiled by the fork and runs in native ESM and SystemJS frames. A simple loopback HTTP server distributes generated artifacts; this is not a deployment or an implementation of the production Beyond CDN.

## Build and open

Follow [setup](../../docs/setup.md) to build the compiler and install pinned test dependencies first. From the fork root:

```sh
node beyond/example/run.mjs
node beyond/react/build.mjs
node beyond/demo/build.mjs
node beyond/demo/server.mjs
```

Open <http://127.0.0.1:4178>. `PORT=4180` selects another port. Stop the server with Ctrl-C. Only loopback is exposed. The page provides separate ESM and SystemJS frames, React state controls, a Beyond patch control and a control that re-adopts the app module stylesheet. The component is compiled with the automatic JSX runtime, so the page also consumes the packaged `react/jsx-runtime`. Each page load starts from the initial artifact; the generated patch updates the original consumer.

The server aliases the public app/shared artifacts to `.js` URLs to satisfy the selected Kernel's established stylesheet sibling convention. Import maps map public bare names to those URLs. Native ESM imports load directly. SystemJS 6.15.1 consumes TypeScript 5.8.3-converted System.register envelopes. React and its renderer use the generated external-package outputs; no remote browser CDN or installed development bundler is substituted.

## Verify in Chromium

Install Playwright in an isolated tooling directory, including its Chromium browser:

```sh
npm install --prefix beyond/.cache/browser --no-save --package-lock=false playwright@1.62.1
node beyond/.cache/browser/node_modules/playwright/cli.js install chromium
PLAYWRIGHT="$PWD/beyond/.cache/browser/node_modules/playwright" node beyond/demo/verify.mjs
```

Alternatively select an existing installation explicitly:

```sh
PLAYWRIGHT=/absolute/path/to/playwright node beyond/demo/verify.mjs
```

If `playwright` resolves normally from the repository, the environment variable is optional. The verifier starts an ephemeral loopback server, launches real headless Chromium, closes both on completion, and retains `beyond/.cache/demo/browser.json`, `browser.png` and `mobile.png`. This run used Playwright 1.62.1 and Chromium 151.0.7922.34.

Assertions cover React rendering through the packaged JSX runtime and state changes, stylesheet replacement, original-consumer Beyond updates, retained internal state, real network consumption of ESM/SystemJS React artifacts, no browser runtime errors or failing HTTP responses, and no horizontal overflow at 390px. Screenshot inspection complements the assertions; it is not the execution test.

## CSS contract and evidence

`fixtures/app.css` imports `palette.css`; `shared.css` is an independent public module stylesheet. [`Styles`](styles.mjs) builds each separately with one incremental compiler context per module, with maps and `styles.graph.json` retaining its input relationships. `affected(file)` names the modules whose last successful build read a file, and a failed build replaces neither the artifact nor its graph; `node --test beyond/demo/styles.test.mjs` (case Y1) executes invalidation, failure and recovery. The CSS is addressable as `/cdn/<format>/app.css` and `/cdn/<format>/shared.css`.

The consumer calls the actual Kernel 0.1.12 `styles.register(vspecifier)` API for each loaded module. That runtime derives the CSS resource from its registered Bundle URI. The fixture adopts each `href` through a `<link>` inside the appropriate open Shadow DOM root, following the module-owned stylesheet and shadow adoption contract. The real Kernel core's application configuration is supplied by the fixture's independently mapped config module.

The test compares the same `.probe` selector in app, shared and document scopes: blue `rgb(36, 91, 117)`, orange `rgb(182, 83, 36)`, green `rgb(40, 84, 52)`. Both formats must preserve all three colors. Replacement follows the Kernel contract: `change()` on the registered stylesheet increments its version and emits `change`, and `href` becomes `app.css?version=1`. The page adopts that `href` and removes the previous link only after the new one has loaded. The verifier rebuilds the stylesheets from a copy whose palette differs, checks that only `app` is invalidated, triggers the control in each frame, and requires the app shadow root to turn `rgb(122, 31, 92)` while the shared and document colors stay unchanged and a single link remains; it then restores the pristine build.

This proves actual registration, serving, adoption, isolation and replacement for these artifacts. It does not implement Widgets controllers, Sass/Tailwind, or the notification that would call `change()` in a development server.

Contract references: `beyondjs/kernel` source `src/modules/styles` at `b06d67d93701c915adca312e5308e15f371c7330`; execution selects installed `@beyond-js/kernel@0.1.12` files `styles/styles.browser.mjs`, `styles/styles.sjs.js` and their bundle/core dependencies. The suite's maintained modular-style contract distinguishes these runtime responsibilities from compiler-only CSS output.
