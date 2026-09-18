import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire as require } from 'node:module';
import { fileURLToPath as filename, pathToFileURL as url } from 'node:url';
import { readFileSync as read } from 'node:fs';
import { Workspace } from './workspace.mjs';

process.env.ESBUILD_BINARY_PATH = filename(new URL(
  process.platform === 'win32' ? '.cache/esbuild.exe' : '.cache/esbuild', import.meta.url));
const api = require(import.meta.url)('./.cache/api.cjs');
const provenance = JSON.parse(read(new URL('.cache/provenance.json', import.meta.url)));
console.log('Compiler provenance:', JSON.stringify(provenance));
assert.equal(api.version, provenance.version);

/** Configures a probe boundary without implementing Beyond's package resolver. */
class Compilation {
  #workspace;
  constructor(workspace) { this.#workspace = workspace; }

  /** Compose internals while retaining bare public references and source metadata. */
  get options() {
    return { absWorkingDir: this.#workspace.root, entryPoints: ['entry.ts'],
      outfile: 'output.mjs', bundle: true, format: 'esm', platform: 'neutral',
      packages: 'external', metafile: true, sourcemap: 'external', write: false,
      logLevel: 'silent' };
  }

  /** Build one isolated fixture with optional API settings. */
  build(options = {}) { return api.build({ ...this.options, ...options }); }

  /** Return the generated JavaScript, excluding its source map. */
  code(result) { return result.outputFiles.find(file => file.path.endsWith('.mjs')).text; }
}

test('G1: internal files and external public references remain distinct', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', `import { value } from './internal.ts';
export { remote } from '@fixture/dependency/main';
export const answer = value;
export const later = () => import('@fixture/dependency/lazy');
export const sibling = () => import('@fixture/app/other');`);
  workspace.set('internal.ts', 'export const value = 42; export const hidden = 7;');
  const compilation = new Compilation(workspace);
  const result = await compilation.build();
  assert.deepEqual(Object.keys(result.metafile.inputs).sort(), ['entry.ts', 'internal.ts']);
  const imports = result.metafile.inputs['entry.ts'].imports;
  assert.ok(imports.some(item => item.path === 'internal.ts' && !item.external));
  for (const path of ['@fixture/dependency/main', '@fixture/dependency/lazy', '@fixture/app/other']) {
    assert.ok(imports.some(item => item.path === path && item.external));
    assert.ok(compilation.code(result).includes(path));
  }
  assert.deepEqual(result.metafile.outputs['output.mjs'].exports,
    ['answer', 'later', 'remote', 'sibling']);
  assert.ok(!compilation.code(result).includes('./internal.ts'));
  assert.equal(imports.find(item => item.path.endsWith('/lazy')).kind, 'dynamic-import');
});

test('E1: composed ESM executes and retains live entry exports', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', "export { count, increment } from './counter.ts';");
  workspace.set('counter.ts', 'export let count = 0; export function increment() { count++; }');
  const compilation = new Compilation(workspace);
  const result = await compilation.build();
  const entry = await import(url(workspace.set('output.mjs', compilation.code(result))));
  assert.equal(entry.count, 0);
  entry.increment();
  assert.equal(entry.count, 1);
  assert.deepEqual(Object.keys(entry), ['count', 'increment']);
});

test('G2: an unused TypeScript import is erased yet still listed as an external input edge', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', "import { unused } from './unused.ts'; import { gone } from '@fixture/gone/main'; export const value = 1;");
  workspace.set('unused.ts', "export { discarded } from '@fixture/unused/main';");
  const result = await new Compilation(workspace).build({ treeShaking: true });
  // The file is never traversed and the output imports nothing...
  assert.ok(!Object.hasOwn(result.metafile.inputs, 'unused.ts'));
  assert.deepEqual(result.metafile.outputs['output.mjs'].imports, []);
  // ...but both erased records remain on the input, flagged external with the written specifier.
  assert.deepEqual(result.metafile.inputs['entry.ts'].imports.map(item => [item.path, item.external]),
    [['./unused.ts', true], ['@fixture/gone/main', true]]);
});

test('R1: explicit rebuild refreshes dependencies and recovers after deletion', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', "export { value } from './first.ts';");
  workspace.set('first.ts', 'export const value = 1;');
  const compilation = new Compilation(workspace);
  const context = await api.context(compilation.options);
  t.after(() => context.dispose());
  const first = await context.rebuild();
  workspace.set('second.ts', 'export const value = 2;');
  workspace.set('first.ts', "export { value } from './second.ts';");
  const second = await context.rebuild();
  assert.ok(Object.hasOwn(second.metafile.inputs, 'second.ts'));
  assert.notEqual(compilation.code(first), compilation.code(second));
  workspace.delete('second.ts');
  await assert.rejects(context.rebuild(), error => error.errors.some(item => item.text.includes('second.ts')));
  workspace.set('first.ts', 'export const value = 3;');
  const recovered = await context.rebuild();
  assert.ok(!Object.hasOwn(recovered.metafile.inputs, 'second.ts'));
  const entry = await import(url(workspace.set('output.mjs', compilation.code(recovered))));
  assert.equal(entry.value, 3);
});

test('C1: CJS external require survives ESM conversion and needs an adapter', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', "module.exports = require('@fixture/dependency/main');");
  const compilation = new Compilation(workspace);
  const result = await compilation.build();
  assert.ok(result.metafile.inputs['entry.ts'].imports.some(item =>
    item.path === '@fixture/dependency/main' && item.kind === 'require-call' && item.external));
  // Characterization: format:esm alone cannot supply a runtime external require.
  await assert.rejects(import(url(workspace.set('output.mjs', compilation.code(result)))),
    /Dynamic require.*not supported/);
});

test('H1: CJS export getters cannot satisfy mutable legacy export objects directly', async () => {
  const result = await api.transform('export let count = 1;', { format: 'cjs', loader: 'ts' });
  const module = { exports: {} };
  new Function('module', 'exports', result.code)(module, module.exports);
  const descriptor = Object.getOwnPropertyDescriptor(module.exports, 'count');
  assert.equal(typeof descriptor.get, 'function');
  assert.equal(descriptor.configurable, false);
  assert.equal(Reflect.deleteProperty(module.exports, 'count'), false);
  assert.equal(Reflect.set(module.exports, 'count', 2), false);
});

test('S1: source map distinguishes same-basename internal TypeScript files', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('entry.ts', "export { left } from './left/value.ts'; export { right } from './right/value.ts';");
  workspace.set('left/value.ts', 'export const left: number = 1;');
  workspace.set('right/value.ts', 'export const right: number = 2;');
  const result = await new Compilation(workspace).build();
  const map = JSON.parse(result.outputFiles.find(file => file.path.endsWith('.map')).text);
  for (const path of ['left/value.ts', 'right/value.ts']) {
    const index = map.sources.indexOf(path);
    assert.ok(index >= 0);
    assert.match(map.sourcesContent[index], /number/);
  }
  assert.ok(map.mappings.length > 0);
});

test('X1: cjs-module-lexer reads assigned exports; upstream getters need the node annotation', async () => {
  const lexer = require(import.meta.url)('./.cache/runtime/node_modules/cjs-module-lexer');
  await lexer.init();
  const source = "export let count = 0; export function increment() { count++; } export * from './values';";
  const names = async options => lexer.parse((await api.transform(source, { format: 'cjs', loader: 'ts', ...options })).code);
  assert.deepEqual(await names({}), { exports: [], reexports: [] }, 'Upstream getters are invisible to the lexer');
  // The upstream node annotation is lexer-complete; what getters lack is assignment, not names.
  assert.deepEqual(await names({ platform: 'node' }), { exports: ['count', 'increment'], reexports: ['./values'] });
  const assigned = await names({ cjsExports: 'assign' });
  assert.deepEqual(assigned.exports.sort(), ['__esModule', 'count', 'increment']);
  assert.deepEqual(assigned.reexports, ['./values']);
  await assert.rejects(api.transform(source, { format: 'esm', loader: 'ts', cjsExports: 'assign' }), /require the "cjs" output format/);
});
