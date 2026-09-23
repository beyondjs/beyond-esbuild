# Browser demo fixtures

Sources of the [browser demo](../README.md) that are not produced by another area: the React component, a configuration module and the modular stylesheets. [`build.mjs`](../build.mjs) and [`verify.mjs`](../verify.mjs) read them as build input and write every output under `beyond/.cache/demo/`; the verifier's stylesheet edit happens in a temporary copy.

| File | Role |
| --- | --- |
| `component.jsx` | The page's React component: renders values of `@fixture/app/main`, applies the Beyond patch and re-adopts module CSS through the Kernel styles registry |
| `config.js` | The `@fixture/demo/config` module |
| `app.css` | Stylesheet of the app module; imports `palette.css` |
| `palette.css` | The `--module-accent` custom property read only by `app.css` |
| `shared.css` | Independent stylesheet of the shared module |

Expected behavior is asserted by `verify.mjs` in Chromium: React state updates, the Beyond patch, and a palette change that invalidates and replaces only the app stylesheet.

Case Y1 of `styles.test.mjs` does not copy these stylesheets. It writes smaller inline stylesheets of the same shape, whose edits and assertions depend on their exact content: its recovery step asserts that `font-weight: 700` appears once the corrected source builds, and the checked-in `app.css` already contains that rule.
