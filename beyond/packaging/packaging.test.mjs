import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync as read } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Toolchain } from '../toolchain.mjs';
import { Workspace } from '../workspace.mjs';
import { Authored } from './authored.mjs';
import { ConsumerProcess } from './process.mjs';
import { Target } from './resolution.mjs';

const toolchain = await Toolchain.load();
const sources = fileURLToPath(new URL('./fixtures/counter/', import.meta.url));

/**
 * The checked-in packages of `fixtures/counter/` (a value module, a facade that only re-exports,
 * and a consumer), copied to a temporary workspace; tests edit only that copy.
 */
class Fixture {
  #workspace = new Workspace();

  constructor() { this.#workspace.copy(sources); }

  get root() { return this.#workspace.root; }
  source(path, contents) { this.#workspace.set(path, contents); }
  read(path) { return this.#workspace.read(path); }
  destroy() { this.#workspace.destroy(); }

  /** `directory` names the output under the fixture, so two builds of one fixture stay apart. */
  authored(environment, { directory = environment, ...options } = {}) {
    return new Authored(toolchain, { packages: ['values', 'facade', 'consumer'].map(name => join(this.root, name)),
      output: join(this.root, 'out', directory), target: new Target({ platform: 'node', environment }), ...options });
  }
}

test('K1: a packaged public module and its public dependencies execute with no Beyond runtime', async t => {
  const fixture = new Fixture();
  t.after(() => fixture.destroy());
  const { report } = await fixture.authored('production').build();
  const consumer = new ConsumerProcess({ maps: [join(fixture.root, 'out/production/importmap.node.production.json')], cwd: fixture.root });
  t.after(() => consumer.stop());

  const main = report.modules.find(module => module.specifier === '@fixture/consumer/main');
  assert.deepEqual(main.references.map(({ specifier, source }) => [specifier, source]), [['@fixture/facade/api', 'workspace']]);
  assert.deepEqual(main.files, ['main/index.ts'], 'Internal files are inputs of the artifact, not runtime objects');
  assert.deepEqual(await consumer.load('main', '@fixture/consumer/main'), ['bump', 'fail', 'increment', 'observe']);
  await assert.rejects(consumer.load('kernel', '@beyond-js/kernel/bundle'), /Cannot find package/,
    'The consumer process cannot resolve a Beyond runtime at all');
  assert.deepEqual(await consumer.call('main', 'observe'), { count: 0, star: 0, total: 0, aid: 'aid', label: 'counter' });
});

test('K2: re-exports through an independent public module are live in every native output', async t => {
  for (const [name, format, options] of [['esm', 'esm', {}], ['cjs-getters', 'cjs', {}], ['cjs-assign', 'cjs', { cjsExports: 'assign' }]]) {
    const fixture = new Fixture();
    t.after(() => fixture.destroy());
    const { report } = await fixture.authored('production', { options }).build(format);
    const maps = format === 'esm' ? [join(fixture.root, 'out/production/importmap.node.production.json')] : [];
    const consumer = new ConsumerProcess({ maps, cwd: join(fixture.root, 'out/production') });
    t.after(() => consumer.stop());

    const facade = report.modules.find(module => module.specifier === '@fixture/facade/api');
    if (format === 'esm') {
      assert.deepEqual(facade.exports, ['Counter', 'aid', 'bump', 'total'], `${name}: own names are static`);
      assert.deepEqual(facade.stars, ['@fixture/values/counter'], `${name}: the public star re-export stays a native statement`);
    }
    await consumer.load('main', '@fixture/consumer/main', format);
    assert.equal(await consumer.call('main', 'increment'), 1);
    assert.equal(await consumer.call('main', 'bump'), 2);
    assert.deepEqual(await consumer.call('main', 'observe'), { count: 2, star: 2, total: 2, aid: 'aid', label: 'counter' },
      `${name}: a reassigned binding is observed through a star, a named and an internal re-export`);
  }
});

test('K3: a development update reaches a re-export only when public dependents get a new address', async t => {
  const fixture = new Fixture();
  t.after(() => fixture.destroy());
  const map = join(fixture.root, 'out/development/importmap.node.development.json');
  const stale = (await fixture.authored('development', { closure: false, directory: 'naive' }).build()).imports;
  const before = (await fixture.authored('development').build()).imports;
  const consumer = new ConsumerProcess({ maps: [map], cwd: fixture.root });
  t.after(() => consumer.stop());
  await consumer.load('first', '@fixture/consumer/main');
  assert.equal(await consumer.call('first', 'increment'), 1);

  fixture.source('values/counter/step.ts', 'export const step = 10;\n');
  const naive = (await fixture.authored('development', { closure: false, directory: 'naive' }).build()).imports;
  assert.notEqual(naive['@fixture/values/counter'], stale['@fixture/values/counter']);
  assert.equal(naive['@fixture/facade/api'], stale['@fixture/facade/api'],
    'Content-only identity: the re-exporting module keeps its address, so a new import of it keeps the old dependency');

  const after = (await fixture.authored('development').build()).imports;
  for (const specifier of ['@fixture/values/counter', '@fixture/facade/api', '@fixture/consumer/main']) {
    assert.notEqual(after[specifier], before[specifier], `${specifier} is re-addressed through the public graph`);
  }
  assert.equal(after['@fixture/facade/plain'], before['@fixture/facade/plain'], 'An unrelated module keeps its address');

  assert.equal(await consumer.call('first', 'increment'), 2, 'The loaded consumer is not replaced: explicit reload boundary');
  await consumer.load('second', '@fixture/consumer/main');
  assert.equal(await consumer.call('second', 'increment'), 10, 'A new import observes the change through the re-export');
  assert.deepEqual((await consumer.call('second', 'observe')).count, 10);
  assert.equal(await consumer.call('first', 'increment'), 3, 'Both generations stay alive with separate state');
});

test('K4: a relative import of another public entry is a public reference; other shared files are copied', async t => {
  const fixture = new Fixture();
  t.after(() => fixture.destroy());
  fixture.source('values/counter/index.ts', `${fixture.read('values/counter/index.ts')}export { token, state } from '../shared';\n`);
  const { report } = await fixture.authored('production').build();
  const again = report.modules.find(module => module.specifier === '@fixture/values/again');
  assert.deepEqual(again.references.map(reference => reference.specifier), ['@fixture/values/counter']);
  assert.deepEqual(again.files.sort(), ['again/index.ts', 'shared.ts']);

  const consumer = new ConsumerProcess({ maps: [join(fixture.root, 'out/production/importmap.node.production.json')], cwd: fixture.root });
  t.after(() => consumer.stop());
  await consumer.load('counter', '@fixture/values/counter');
  await consumer.load('again', '@fixture/values/again');
  assert.equal(await consumer.call('counter', 'increment'), 1);
  assert.equal(await consumer.call('again', 'increment'), 2, 'One counter state: the entry was referenced, not bundled again');
  assert.deepEqual(await consumer.read('counter', 'state'), { loads: 1 });
  // Limit: a file that is not itself public is evaluated once per public module that bundles it.
  assert.equal(await consumer.same('counter', 'again', 'token'), false, 'The shared internal file has two instances');
});

test('K5: the external map of a minified packaged artifact resolves an internal TypeScript position', async t => {
  const fixture = new Fixture();
  t.after(() => fixture.destroy());
  await fixture.authored('production').build();
  const consumer = new ConsumerProcess({ maps: [join(fixture.root, 'out/production/importmap.node.production.json')],
    cwd: fixture.root, flags: ['--enable-source-maps'] });
  t.after(() => consumer.stop());
  await consumer.load('main', '@fixture/consumer/main');
  await assert.rejects(consumer.call('main', 'fail'), error => {
    assert.match(error.message, /packaged boom/);
    assert.match(error.message, /main\/index\.ts:8:9/, 'Line and column of the throw in the authored source');
    return true;
  });
  const code = read(join(fixture.root, 'out/production/@fixture/consumer@1.0.0/main.node.production.mjs'), 'utf8');
  assert.ok(code.split('\n').length <= 4, 'The production artifact is minified');
});
