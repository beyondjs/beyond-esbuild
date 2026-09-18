# Beyond ESBuild

Beyond ESBuild is the [Beyond-maintained fork](https://github.com/beyondjs/beyond-esbuild) of [evanw/esbuild](https://github.com/evanw/esbuild), used to develop and test compilation for Beyond's modular runtime and package distribution.

**Current status: preparation and bounded tests with existing APIs/adapters. The esbuild compiler core has not been modified.** The working demo establishes only the recorded fixture behavior; complete Beyond implementation and production integration remain open for a new implementation task.

Beyond delivers addressable public modules composed from internal source modules. Their bare public references, internal identities, exports and dependency relationships must survive compilation. This repository makes those requirements executable before adapting the compiler core.

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
- [Compiler subsystem audit and reading coverage](docs/compiler-audit.md)
- [Executable assessment workspace](beyond/README.md)
- [Coding standards](docs/coding-standards.md) and [contributor instructions](AGENTS.md)

The current work adds bounded adapters, fixtures and validation. The upstream compiler implementation remains unchanged; no consumer migration, package publication or production CDN deployment has occurred. Passing local examples does not establish complete Packages integration or a general-purpose runtime adapter.

## Upstream and license

The compiler retains esbuild's source layout, public APIs, history and [MIT license](LICENSE.md), including Evan Wallace's attribution. The [original upstream introduction](docs/upstream.md), [upstream architecture](docs/architecture.md) and [upstream development guide](docs/development.md) remain available. See the [esbuild documentation](https://esbuild.github.io/) for the underlying compiler API and supported syntax.
