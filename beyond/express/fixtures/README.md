# Express consumer fixture

`consumer.mjs` is the Node application that [`express.test.mjs`](../express.test.mjs) runs against the packaged Express artifacts. It loads the artifact, installs JSON middleware, handles a parameterized `POST /probe/:name` route on an ephemeral loopback port, sends one request with `fetch`, prints `{status, body, files}` as JSON and closes the server. `files` lists the CommonJS modules in the require cache.

The test evaluates the file's text with `node --input-type=module -e` in the build output `beyond/.cache/express/`, where `./express.mjs` and `./express.cjs` resolve; the file itself is only read. The ESM probe runs it unchanged. The CommonJS probe replaces the expression `(await import('./express.mjs')).default` with `require('./express.cjs')` and nothing else; the test asserts that the expression is present.

Expected behavior: status 200, body `{name: 'Beyond', value: 42}`, and every cached module inside the build output. To run it by hand after `node beyond/express/build.mjs`, from the repository root:

```sh
cd beyond/.cache/express && node --input-type=module -e "$(cat ../../express/fixtures/consumer.mjs)"
```
