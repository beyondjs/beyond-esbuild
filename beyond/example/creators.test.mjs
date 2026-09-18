import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync as execute } from 'node:child_process';
import { readFileSync as read } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL as url } from 'node:url';
import { Fixture } from './fixture.mjs';
import { Lookup } from './maps.mjs';

const counter = 'export let count = 0;\nexport function increment() { count++; }\n';

test('L1: reassigned exports stay live inside the package and in the public bindings', async t => {
  const fixture = await new Fixture({ 'counter.ts': counter, 'index.ts':
    "import { count, increment } from './counter';\nexport let total = 0;\n" +
    'export function bump() { increment(); total = count; return count; }\n' }).build();
  t.after(() => fixture.destroy());
  for (const consumer of [await fixture.import(), fixture.require()]) {
    assert.equal(consumer.total, 0);
    assert.equal(consumer.bump(), 1, 'The entry reads the live binding of another creator');
    assert.equal(consumer.bump(), 2);
    assert.equal(consumer.total, 2, 'The runtime observed the assignment and updated the public binding');
  }
});

test('L2: default exports cross creators and become a live public default', async t => {
  const fixture = await new Fixture({ 'thing.ts': "export default class Thing { name = 'thing'; }\n",
    'index.ts': "import Thing from './thing';\nexport default function create() { return new Thing().name; }\n" +
      "export const kind = 'first';\n" }).build();
  t.after(() => fixture.destroy());
  const esm = await fixture.import();
  const cjs = fixture.require();
  assert.equal(esm.default(), 'thing');
  assert.equal(cjs.default(), 'thing');
  const patch = await fixture.patch({ 'index.ts': "import Thing from './thing';\n" +
    "export default function create() { return new Thing().name + '!'; }\nexport const kind = 'second';\n" });
  await patch.esm();
  patch.cjs();
  assert.equal(esm.default(), 'thing!', 'The original ESM default binding was replaced');
  assert.equal(cjs.default(), 'thing!');
  assert.equal(esm.kind, 'second');
});

test('L3: named and star re-exports of internals define the public API', async t => {
  const fixture = new Fixture({ 'values.ts': "export const one = 1;\nexport default 'hidden';\n",
    'helper.ts': 'export function helper() { return 2; }\n', 'counter.ts': counter,
    'index.ts': "export * from './values';\nexport { helper as aid } from './helper';\n" +
      "export { count, increment } from './counter';\n" });
  t.after(() => fixture.destroy());
  assert.deepEqual((await fixture.assembler()).exports, ['aid', 'count', 'increment', 'one'],
    'A star re-export contributes the names of the internal module except its default');
  const esm = await (await fixture.build()).import();
  assert.deepEqual([esm.one, esm.aid(), esm.count], [1, 2, 0]);
  esm.increment();
  // Same boundary as the TypeScript creators Packages compiles today: a re-export is an
  // accessor, so the runtime is not notified and the outer binding keeps its last value.
  assert.equal(esm.count, 0, 'Re-exported bindings are not pushed to the public binding');
  assert.equal(esm.__beyond_pkg.ims.require('./index', { register() {}, pop() {} }).count, 1,
    'The internal accessor itself stays live');
});

test('L4: replacing a creator that re-exports is rejected by the runtime, as with TypeScript output', async t => {
  const fixture = await new Fixture({ 'helper.ts': 'export function helper() { return 2; }\n',
    'index.ts': "export { helper } from './helper';\nexport const version = 1;\n" }).build();
  t.after(() => fixture.destroy());
  const esm = await fixture.import();
  const patch = await fixture.patch({ 'index.ts': "export { helper } from './helper';\nexport const version = 2;\n" });
  await assert.rejects(patch.esm(), TypeError, 'Accessors are not configurable, so the exports cannot be refilled');
  assert.equal(esm.version, 1);
});

test('L5: the runtime rejects cycles between internal modules', async t => {
  const fixture = await new Fixture({ 'a.ts': "import { b } from './b';\nexport const a = () => b;\n",
    'b.ts': "import { a } from './a';\nexport const b = () => a;\n",
    'index.ts': "export { a } from './a';\n" }).build();
  t.after(() => fixture.destroy());
  await assert.rejects(fixture.import(), /Recursive module load found[\s\S]*"\.\/a" again/);
});

test('L6: updates add internals, keep order, fail closed and cannot reshape loaded exports', async t => {
  const fixture = await new Fixture({ 'state.ts': 'export const state = { created: Date.now(), hits: 0 };\n',
    'index.ts': "import { state } from './state';\nexport const version = 1;\n" +
      'export function hit() { return ++state.hits; }\n' }).build();
  t.after(() => fixture.destroy());
  const esm = await fixture.import();
  let changes = 0;
  esm.hmr.on('change', () => changes++);
  assert.equal(esm.hit(), 1);

  const added = await fixture.patch({ 'label.ts': "export const label = (value: number) => `v${value}`;\n",
    'index.ts': "import { state } from './state';\nimport { label } from './label';\nexport const version = 2;\n" +
      'export function hit() { return label(++state.hits); }\n' });
  await added.esm();
  assert.equal(esm.version, 2);
  assert.equal(esm.hit(), 'v2', 'A new internal module is registered and the untouched one keeps its state');

  await assert.rejects(fixture.patch({ 'index.ts': 'export const version = ;\n' }), /Unexpected/,
    'A source that does not compile produces no update');
  assert.equal(esm.version, 2, 'The loaded package is untouched by the failed build');

  const third = await fixture.patch({ 'index.ts': "import { state } from './state';\nexport const version = 3;\n" +
    'export const extra = true;\nexport function hit() { return ++state.hits; }\n' });
  await third.esm();
  assert.equal(esm.version, 3, 'Sequential updates are observed in order');
  assert.equal(esm.hit(), 3);
  assert.equal(changes, 2, 'One package change event per applied update');
  assert.equal('extra' in esm, false, 'A loaded ES module cannot gain a binding: shape changes need a reload');
  assert.equal(esm.__beyond_pkg.exports.values.extra, true, 'The runtime itself holds the new value');
});

test('M1: composed maps resolve creator positions in every format', async t => {
  const fixture = await new Fixture({ 'nested/fail.ts': "// ünïcödé text before the code shifts UTF-16 columns\n" +
    "interface Shape { value: number }\nexport function fail(shape: Shape): never {\n" +
    "  throw new Error('boom ' + shape.value);\n}\n",
    'index.ts': "import { fail } from './nested/fail';\nexport function run() { return fail({ value: 1 }); }\n" }).build();
  t.after(() => fixture.destroy());
  // Node applies the published maps itself; the stack must name the original TypeScript line.
  const scripts = { 'main.mjs': `import(${JSON.stringify(url(join(fixture.package, 'main.mjs')).href)}).then(m => m.run())`,
    'main.cjs': `require(${JSON.stringify(join(fixture.package, 'main.cjs'))}).run()` };
  for (const [file, script] of Object.entries(scripts)) {
    const stack = execute(process.execPath, ['--enable-source-maps', '-e',
      `Promise.resolve().then(() => ${script}).catch(error => console.log(error.stack))`], { encoding: 'utf8' });
    assert.match(stack, /boom 1/);
    assert.match(stack, /nested\/fail\.ts:4:9/, `${file} maps the throw to its source line and column`);
    assert.match(stack, /index\.ts:2:\d+/, `${file} maps the calling creator`);
  }
  // System.register is a TypeScript conversion; its chained map is decoded directly.
  const system = read(join(fixture.package, 'main.system.js'), 'utf8').split('\n');
  const line = system.findIndex(text => text.includes("throw new Error('boom '") || text.includes('throw new Error("boom "'));
  const lookup = new Lookup(read(join(fixture.package, 'main.system.js.map'), 'utf8'));
  const original = lookup.original(line, system[line].indexOf('throw'));
  assert.deepEqual([original.source, original.line, original.column], ['nested/fail.ts', 3, 2]);
  assert.match(lookup.map.sourcesContent[lookup.map.sources.indexOf('nested/fail.ts')], /interface Shape/);
});
