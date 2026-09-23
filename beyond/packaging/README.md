# esbuild packaging mode cases

Executable cases for the packaging mode: a public module bundled into a distributable artifact that keeps its public references bare and needs no Beyond runtime. The contract, findings, coverage and limits are in [the packaging guide](../../docs/packaging.md); installation and commands are in [setup](../../docs/setup.md#packaging-cases). The creator example in `../example/` implements the other mode and is not acceptance for this one.

| File | Role |
| --- | --- |
| `resolution.mjs`, `boundary.mjs`, `packaged.mjs` | Target conditions, the public boundary plugin and the build of one public module |
| `authored.mjs` | Authored packages: `exports` entries that point to source files, closure identities in development, CommonJS `node_modules` layout |
| `distribution.mjs`, `shared.mjs` | Closure of published packages, each public module compiled on its own; import map with scopes and package edges; one artifact for subpaths that resolve to one file; packages whose public modules share private files are reported and withdrawn, never split |
| `system.mjs` | The System.register adapter over a built tree, with chained source maps and the dependencies each converted module declares |
| `adapters/` | Vue and Svelte source adapters |
| `fixtures/` | Authored fixture packages, described in [their guide](fixtures/README.md): the `counter/` packages of K1–K5 (a value module, a re-exporting facade and a consumer), and the ecosystem targets, a Vue SFC app, a Svelte component app and modules that consume Radix and Shoelace controls, each with client and server entries where that applies. The Svelte and Shoelace modules are built and then reported as blocked |
| `loader.mjs`, `register.mjs`, `process.mjs`, `consumer.mjs` | Test tooling: import maps in Node and a long-lived consumer process |
| `packaging.test.mjs` | K1–K5: production execution, re-exports, development re-addressing, shared state, source maps |
| `ecosystem.mjs`, `ecosystem.test.mjs` | Builds the three targets; E1–E8: SSR, conditional exports, adapters, package edges, public modules as the only division, minification, the System.register graph |
| `boundaries.test.mjs` | B1–B3: the duplicated-state regression guard, shared state through a published module, and one artifact whether a module is packaged alone or with its consumers |
| `verify.mjs` | Real Chromium: native ESM in production and development, and the System.register adapter with SystemJS |

```sh
node --test beyond/packaging/packaging.test.mjs beyond/packaging/ecosystem.test.mjs
node beyond/packaging/ecosystem.mjs
PLAYWRIGHT=/absolute/path/to/playwright node beyond/packaging/verify.mjs
```

The fixtures declare the versions they were executed with. Reports name each artifact's adapters; an artifact with none is native compiler output. A pass here is fixture evidence, not a guarantee for other packages, and nothing here delivers an update to a running consumer.
