# React consumer fixture

`consumer.cjs` is the CommonJS server-rendering application that [`react.test.mjs`](../react.test.mjs) runs against the packaged React artifacts. It loads `./react.cjs` and `./react-dom-server.cjs`, resolves `react/jsx-runtime` and `react` through the generated isolated `node_modules`, renders a component that uses `useState`, and prints `{version, same, html, files}` as JSON.

The test evaluates the file's text with `node -e` in the build output `beyond/.cache/react/`, where those relative and bare references resolve; the file itself is only read and never substituted.

Expected behavior: React `19.2.0`, the renderer's `react` is the same instance as the consumer's (`same: true`, which hooks require), the HTML is `<section data-build="fork">Beyond ESBuild</section>`, and every cached module is inside the build output, never an installed React source. To run it by hand after `node beyond/react/build.mjs`, from the repository root:

```sh
cd beyond/.cache/react && node -e "$(cat ../../react/fixtures/consumer.cjs)"
```
