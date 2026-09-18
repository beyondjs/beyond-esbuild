# Beyond ESBuild

Beyond ESBuild is the [Beyond-maintained fork](https://github.com/beyondjs/beyond-esbuild) of [evanw/esbuild](https://github.com/evanw/esbuild), used to develop and test compilation for Beyond's modular runtime and package distribution.

**Current status: one bounded, opt-in compiler change, [assigned CommonJS exports](docs/cjs-exports.md), plus adapters and executable cases around the public API. Upstream behavior and every upstream test snapshot are unchanged when the option is not used.** The recorded cases establish only their fixture behavior; Packages, CDN and production integration remain open.

Beyond delivers addressable public modules composed from internal source modules. Their bare public references, internal identities, exports and dependency relationships must survive compilation. This repository makes each requirement executable before adapting the compiler, and changes the compiler only where a failing case requires it.

Three independent responsibilities guide the prepared examples and the next implementation:

- **Beyond-authored modules:** compile individual TypeScript internals into separate runtime creators, then compose public CommonJS, ESM and System.register artifacts. Execute the real Kernel and update an already loaded consumer without replacing its public identity.
- **Existing packages:** compile React and ReactDOM into independently addressable distribution artifacts, exercise Node server rendering, and supply browser ESM/SystemJS consumers. Express separately exercises Node CommonJS/ESM packaging through actual HTTP requests.
- **Dependency traversal:** use esbuild's file-by-file traversal to retain direct and transitive source edges, then classify Beyond public references and package/version identities separately. This graph path has its own assertions and emitted evidence; a metafile is not a replacement package resolver.

The local browser demo combines the authored module, compiled React, and independently served modular CSS. JavaScript and CSS graphs retain file relationships separately from public-module and package/version identities. SystemJS is an explicit conversion adapter; it is not a native esbuild output format.

## Start

Read [setup and execution](docs/setup.md) for the complete commands, pinned dependencies and generated artifact locations. The short sequence, after a compatible Go toolchain and Node 22 are installed, is:

```sh
node beyond/prepare.mjs
node --test beyond/capabilities.test.mjs
```

The preparation script builds **this checkout's compiler and matching API**. It does not silently substitute an installed npm esbuild. Scenario dependencies and generated output stay under ignored `beyond/.cache/`.

## Guides

- [Scenario index and current evidence](docs/README.md)
- [Beyond compilation and runtime contracts](docs/beyond-architecture.md)
- [Requirements, acceptance cases and unknowns](docs/requirements.md)
- [Assigned CommonJS exports: the fork's compiler change](docs/cjs-exports.md)
- [Compiler subsystem audit and reading coverage](docs/compiler-audit.md)
- [Executable assessment workspace](beyond/README.md)
- [Coding standards](docs/coding-standards.md) and [contributor instructions](AGENTS.md)

The current work adds bounded adapters, fixtures, validation and the `cjsExports: 'assign'` compiler option that Beyond's internal-module creators require. Fork-specific compiler code is marked `Beyond ESBuild` in place. No consumer migration, package publication or production CDN deployment has occurred. Passing local examples does not establish complete Packages integration or a general-purpose runtime adapter.

## Upstream and license

The compiler retains esbuild's source layout, public APIs, history and [MIT license](LICENSE.md), including Evan Wallace's attribution. The [original upstream introduction](docs/upstream.md), [upstream architecture](docs/architecture.md) and [upstream development guide](docs/development.md) remain available. See the [esbuild documentation](https://esbuild.github.io/) for the underlying compiler API and supported syntax.
