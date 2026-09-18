# Assigned CommonJS exports

`cjsExports: 'assign'` is the first compiler change of this fork. It makes esbuild write the exports of an ES module as assignments on the free `exports` object when the output format is CommonJS, which is the form Beyond's runtime requires of every internal module. The default, `'getters'`, is the unchanged upstream behavior. This guide records the contract that motivated the change, the alternatives that were measured first, the emitted code, the implementation map and the limits.

## Scope

This option was introduced for the creator compatibility fixture. It is not automatically required for esbuild packaging, whose output does not need runtime internal modules. Assess its applicability against [execution modes](execution-modes.md) before selecting it for Packages. Keep the recorded implementation and tests; this clarification neither removes the option nor establishes that it is needed in both modes.

Assessed since: the option is needed for creators consumed by the Kernel and for nothing in the packaging mode. Packaged ESM cannot use it, packaged CommonJS re-exports are live with upstream getters as well as with assigned exports, and the Packages trial builds its packaged module with upstream `esbuild` too. The evidence is in [the packaging guide](packaging.md#necessity-of-cjsexports-assign-per-path).

## The contract

Beyond evaluates each internal source file as `creator(require, exports)`. Three sources define what that body must do:

- `beyondjs/packages` at `593b9f1cffb8af2e972af7030fd7a7ac8883af96`, `modules/bundlers/ts/processors/ts/transpiler.ts:13–17`: exports must be written as assignments on `exports`; the runtime empties and refills that object when it re-creates an internal module, which only works while its properties are configurable; emitters that define exports as accessors produce internal modules that cannot be updated.
- `beyondjs/kernel` at `b06d67d93701c915adca312e5308e15f371c7330`, `src/modules/bundle/package/ims/exports.ts` and `im.ts:41–52`: the `exports` object is a proxy whose only trap is `set`. An assignment to a name in the public descriptor is forwarded to `exports.process({prop, value})`, which assigns the outer `export let` binding of the public module. Before a creator runs again, every enumerable key is deleted. There is no `module` object.
- Same Packages revision, `analyzer.ts:21–58`: `cjs-module-lexer` reads the emitted code to obtain exported names and `export *` re-exports; the assembler derives the public API from them.

Upstream CommonJS output satisfies none of these. It defines non-configurable getters on a new object and replaces `module.exports`:

```js
__export(entry_exports, { count: () => count });
module.exports = __toCommonJS(entry_exports);
let count = 0;
function increment() { count++; }
```

## Alternatives measured before changing the compiler

| Approach | Executed result | Why it does not suffice |
| --- | --- | --- |
| Previous bridge: evaluate into a local `module`, then copy each value onto `exports` | Initial values and replacement updates work | Values are snapshots. `increment()` in one creator is invisible to another creator and to the public binding (now case L1). Every creator repeats the helper prelude. |
| Forwarding getters defined on the runtime `exports` object | Reads inside the package are live | Defining a property bypasses the `set` trap, so the public `export let` binding is never updated. The adapter cannot know when a local binding changes. |
| A second TypeScript `transpileModule` pass from esbuild's ESM output to CommonJS | Satisfies the contract | Every file is parsed and printed by two compilers; esbuild contributes only type erasure. That is the path Packages already has, not an esbuild creator path. |
| `platform: 'node'` lexer annotation (`0 && (module.exports = {...})`) | `cjs-module-lexer` reports names and star re-exports (probe X1) | Solves name discovery only; exports remain getters on a replaced `module.exports`. |

Only an emitter that assigns at the mutation site can notify the runtime, so the change belongs in the compiler.

## Emitted code

```js
Object.defineProperty(exports, "__esModule", { value: true });
exports.increment = increment;        // hoisted function declarations first
exports.legacy = void 0;              // "export var" exists from the start
var import_thing = __toESM(require("./thing"));
__exportStar(require("./star"), exports);
exports.count = 0;                    // was "export let count = 0"
function increment() { exports.count++; }
class Box {}
exports.Box = Box;                    // everything else after the module body
Object.defineProperty(exports, "other", { enumerable: true, get: function() {
  return import_thing.other;          // re-exported import
} });
```

- A `let` or `var` export that is reassigned anywhere becomes a property of `exports`: its declaration turns into an assignment and every reference, including destructuring targets, shorthand properties and call targets (`(0, exports.fn)()`), is printed as a property access. Every mutation is therefore an observable assignment.
- Bindings that are never reassigned keep their local declaration and are assigned once. Hoisted function declarations are assigned at the start, the rest at the end of the module body.
- A re-exported import, a second alias of a reassigned binding, a reassigned function or class declaration, and a reassigned binding of another bundled file use the accessor form TypeScript emits. `export *` uses `__exportStar(require(path), exports)`. Both forms are the exact patterns `cjs-module-lexer@2.1.0` recognizes; a `configurable` key or an arrow function makes the lexer miss the name.
- The output never references `module`, `__export` or `__toCommonJS`, and omits the node lexer annotation because the assignments are already readable.

`TestBeyondCJSAssignExportsConvertFormat` and `TestBeyondCJSAssignExportsBundle` in `internal/bundler_tests/bundler_beyond_test.go` hold the complete expected output in `snapshots/snapshots_beyond.txt`.

## Using it

```js
await esbuild.transform(source, { loader: 'ts', format: 'cjs', cjsExports: 'assign' });
```

CLI: `--format=cjs --cjs-exports=assign`. Go: `api.TransformOptions{Format: api.FormatCommonJS, CJSExports: api.CJSExportsAssign}`; the same field exists on `BuildOptions`. Any other output format is an error: `Assigned CommonJS exports require the "cjs" output format`. The option applies to ES module entry points that are not wrapped; a CommonJS source file, or an entry that another bundled file requires, keeps the upstream output (`TestBeyondCJSAssignExportsLeavesCommonJSSource`).

## Implementation map

| File | Change |
| --- | --- |
| `internal/linker/cjs_assign_exports.go` (new) | Applicability, serial aliasing of reassigned exports before the parallel export step, start and end export statements, replacement of the `__export` part with identical tree-shaking dependencies |
| `internal/linker/cjs_assign_locals.go` (new) | Rewrites `let count = 0` to `exports.count = 0`, including patterns that mix exported and ordinary bindings |
| `internal/linker/linker.go` | Free `exports`/`Object` symbols; skips `__toCommonJS`, the `module.exports` second target and the node annotation; routes `export *` to `__exportStar`; converts declarations; appends the end statements to the entry-point tail |
| `internal/js_printer/js_printer.go` | Prints an identifier whose symbol is aliased to the free `exports` symbol as a property access; disables shorthand properties for it. Inactive unless the linker enables `AssignsExports` |
| `internal/runtime/runtime.go` | `__exportStar(mod, target)`, declared last so the part order of upstream helpers, and therefore upstream chunk hashes, are unchanged. The name is on upstream's forbidden tslib list deliberately: the lexer requires it, and the TypeScript helper it could collide with has the same contract |
| `internal/config/config.go`, `pkg/api/api.go`, `pkg/api/api_impl.go`, `pkg/cli/cli_impl.go`, `cmd/esbuild/main.go`, `lib/shared/common.ts`, `lib/shared/types.ts` | Option plumbing, validation and help text. The JavaScript API forwards the option as the CLI flag, so no protocol message changed |

Upstream snapshots were not refreshed. The first placement of `__exportStar`, between existing helpers, changed the content hashes of two upstream splitting snapshots; moving it to the end restored them, which is why the placement is documented in the source.

## Executed evidence

See [validation](validation.md) for the environment. Against the actual Kernel 0.1.12, in `beyond/example/creators.test.mjs`: reassigned exports are live across creators and in the public ESM and CommonJS bindings (L1); default exports cross creators and update (L2); named and star re-exports define the public API (L3). `beyond/capabilities.test.mjs` X1 shows the lexer reading the fork's output. The generated public module contains neither `module.exports` nor getter helpers (`beyond/example/run.mjs`).

## Limits

- Re-exported bindings are accessors, as in TypeScript output. The runtime is not notified when the underlying binding changes (L3), and the Kernel cannot delete a non-configurable accessor, so replacing a creator that re-exports throws `TypeError` (L4). Packages documents the same boundary: such a module is reloaded rather than updated. A configurable accessor plus a lexer annotation would lift it, but that is a proposal, not an approved contract.
- The end placement of non-function exports means a cyclic CommonJS consumer can observe a missing export during evaluation. The Kernel rejects cycles between internal modules outright (L5), so this does not arise in creators.
- A nested scope that declares its own `exports` binding shadows the free object inside that scope. TypeScript has the same hazard. A reassigned export declared in a `for` initializer is not rewritten.
- `import * as self` of the entry's own file sees the real `exports` object, including `__esModule`.
- Minification, code splitting, lowering to ES5 and the IIFE format with a global name were not exercised with this option. The upstream JavaScript API, end-to-end and WASM test scripts were not run; `lib/` was type-checked with TypeScript 5.8.3, not upstream's pinned 6.0.2.
