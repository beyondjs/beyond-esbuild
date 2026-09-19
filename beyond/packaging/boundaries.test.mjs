import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Distribution } from './distribution.mjs';
import { Packaged } from './packaged.mjs';
import { Target } from './resolution.mjs';
import { ConsumerProcess } from './process.mjs';

const toolchain = await Toolchain.load();
const target = new Target({ platform: 'node', environment: 'production' });

/** An installation written for one test: `files` maps paths under `node_modules` to their content. */
class Installation {
  #root = realpathSync(mkdtempSync(join(tmpdir(), 'beyond-boundaries-')));
  get root() { return this.#root; }

  constructor(t, files) {
    t.after(() => rmSync(this.#root, { recursive: true, force: true }));
    Object.entries(files).forEach(([file, content]) => {
      const path = join(this.#root, 'node_modules', file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    });
  }

  consumer(t, map) {
    const process = new ConsumerProcess({ maps: [map], cwd: this.#root });
    t.after(() => process.stop());
    return process;
  }
}

// Two public modules of one package whose entries both import the file that holds the state
const stateful = exports => ({
  '@fixture/stateful/package.json': { name: '@fixture/stateful', version: '1.0.0', type: 'module', exports },
  '@fixture/stateful/state.js': 'export const state = { count: 0 };\nexport const add = () => ++state.count;\n',
  '@fixture/stateful/a.js': "export { state, add } from './state.js';\n",
  '@fixture/stateful/b.js': "export { state, add } from './state.js';\n"
});

test('B1: regression guard, two public modules that bundle one private file each hold a copy of its state', async t => {
  const installation = new Installation(t, stateful({ './a': './a.js', './b': './b.js' }));
  const output = join(installation.root, 'separate');
  const imports = {};
  for (const name of ['a', 'b']) {
    const entry = join(installation.root, 'node_modules/@fixture/stateful', `${name}.js`);
    const packaged = await new Packaged(toolchain, { entry, root: installation.root, target, published: async () => undefined }).build();
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${name}.mjs`), packaged.code);
    imports[`@fixture/stateful/${name}`] = `./${name}.mjs`;
  }
  writeFileSync(join(output, 'importmap.json'), JSON.stringify({ imports }));

  const node = installation.consumer(t, join(output, 'importmap.json'));
  await node.load('a', '@fixture/stateful/a');
  await node.load('b', '@fixture/stateful/b');
  assert.equal(await node.same('a', 'b', 'state'), false, 'Each artifact owns its own state object');
  assert.deepEqual([await node.call('a', 'add'), await node.call('a', 'add'), await node.call('b', 'add')], [1, 2, 1],
    'A count made through one module is not seen through the other');

  // Which is why the distribution refuses to publish that package instead of delivering the duplication
  const distribution = new Distribution(toolchain, { root: installation.root, output: join(installation.root, 'distributed'), target });
  await distribution.add('@fixture/stateful/a');
  await distribution.add('@fixture/stateful/b');
  const report = await distribution.finish();
  assert.deepEqual(report.unsupported.map(({ package: name, reason, shared }) => ({ name, reason, shared })),
    [{ name: '@fixture/stateful@1.0.0', reason: 'shared-private-files', shared: ['node_modules/@fixture/stateful/state.js'] }]);
  assert.deepEqual(distribution.importmap().imports, {}, 'Neither module is offered');
});

test('B2: when the package publishes the shared file, both modules refer to it and share one state', async t => {
  const installation = new Installation(t, stateful({ './a': './a.js', './b': './b.js', './state': './state.js' }));
  const output = join(installation.root, 'distributed');
  const distribution = new Distribution(toolchain, { root: installation.root, output, target });
  const a = await distribution.add('@fixture/stateful/a');
  const b = await distribution.add('@fixture/stateful/b');
  const report = await distribution.finish();
  assert.deepEqual(report.unsupported, []);
  for (const artifact of [a, b]) {
    assert.deepEqual(Object.keys(artifact.references), ['@fixture/stateful/state'], 'The relative import became the public reference');
    assert.deepEqual(artifact.inputs.map(input => input.split('/').pop()), [`${artifact.subpath.slice(2)}.js`], 'Only its own entry is bundled');
  }

  const node = installation.consumer(t, join(output, 'importmap.node.production.json'));
  await node.load('a', '@fixture/stateful/a');
  await node.load('b', '@fixture/stateful/b');
  await node.load('state', '@fixture/stateful/state');
  assert.equal(await node.same('a', 'b', 'state'), true);
  assert.equal(await node.same('a', 'state', 'state'), true, 'It is the state of the public module itself');
  assert.deepEqual([await node.call('a', 'add'), await node.call('b', 'add'), await node.call('state', 'add')], [1, 2, 3]);
});

test('B3: a module is the same artifact built alone or together with its consumers', async t => {
  const root = toolchain.ecosystem;
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'beyond-identity-')));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const browser = new Target({ platform: 'browser', environment: 'production' });
  const digest = (directory, file) => createHash('sha256').update(readFileSync(join(directory, file))).digest('hex');

  const alone = new Distribution(toolchain, { root, output: join(scratch, 'alone'), target: browser });
  const core = await alone.add('lit-html');
  await alone.finish();

  const together = new Distribution(toolchain, { root, output: join(scratch, 'together'), target: browser });
  const consumers = [await together.add('lit'), await together.add('lit-html/directives/class-map.js')];
  await together.finish();
  const shared = together.artifacts.find(artifact => artifact.specifier === 'lit-html');

  assert.equal(shared.file, core.file, 'Same public address');
  assert.equal(digest(join(scratch, 'together'), shared.file), digest(join(scratch, 'alone'), core.file), 'Same bytes');
  assert.deepEqual([shared.exports, Object.keys(shared.references)], [core.exports, Object.keys(core.references)]);
  const directive = consumers[1];
  assert.equal(directive.references['lit-html'].file, core.file, 'Its consumer reaches it through the bare public reference');
  assert.ok(!directive.inputs.some(input => input.endsWith('/lit-html.js')), 'and holds no copy of it');
});
