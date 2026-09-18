import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Ecosystem } from './ecosystem.mjs';
import { ConsumerProcess } from './process.mjs';

const toolchain = await Toolchain.load();
const ecosystem = new Ecosystem(toolchain);
const builds = {};
for (const [platform, environment] of Ecosystem.targets) builds[`${platform}.${environment}`] = await ecosystem.build(platform, environment);

const consumer = (t, target) => {
  const process = new ConsumerProcess({ maps: [join(builds[target].output, 'importmap.json')], cwd: toolchain.cache });
  t.after(() => process.stop());
  return process;
};
const artifact = (target, specifier) => builds[target].packages.artifacts.find(candidate => candidate.specifier === specifier);

test('E1: Vue single-file source and Headless UI render on Node from packaged artifacts', async t => {
  const node = consumer(t, 'node.production');
  await node.load('vue', '@fixture/vue-app/server');
  const html = await node.call('vue', 'render', 'Vue');
  assert.match(html, /<p id="vue-summary" data-v-[0-9a-f]{8}>Vue: 0<\/p>/, 'Scoped SFC output');
  assert.match(html, /<button class="toggle" id="vue-switch" role="switch"[^>]*aria-checked="false"/,
    'Published control rendered by the same Vue runtime');
});

test('E2: Svelte component source renders on Node from packaged artifacts', async t => {
  const node = consumer(t, 'node.production');
  await node.load('svelte', '@fixture/svelte-app/server');
  assert.match(await node.call('svelte', 'html', 'Svelte'), /<p id="svelte-summary">Svelte: 0<\/p>/);
});

test('E3: conditional exports follow the platform and the environment', async t => {
  assert.equal(artifact('browser.production', 'vue').source, 'node_modules/vue/dist/vue.runtime.esm-bundler.js');
  assert.equal(artifact('node.production', 'vue').source, 'node_modules/vue/index.mjs');
  assert.equal(artifact('browser.production', 'svelte').source, 'node_modules/svelte/src/index-client.js');
  assert.equal(artifact('node.production', 'svelte').source, 'node_modules/svelte/src/index-server.js');
  for (const [target, expected] of [['node.production', { DEV: false, BROWSER: false, NODE: true }],
    ['browser.development', { DEV: true, BROWSER: true, NODE: false }]]) {
    const process = consumer(t, target);
    await process.load('env', 'esm-env');
    const observed = Object.fromEntries(await Promise.all(Object.keys(expected).map(async name => [name, await process.read('env', name)])));
    assert.deepEqual(observed, expected, `${target}: executed esm-env conditions`);
  }
});

test('E4: CommonJS inputs become ESM through named adapters, ESM inputs through none', () => {
  const browser = builds['browser.production'].packages.artifacts;
  assert.deepEqual(artifact('browser.production', 'react').adapters, ['commonjs-names']);
  assert.deepEqual(artifact('browser.production', 'react-dom/client').adapters, ['commonjs-names', 'require-bridge']);
  assert.ok(artifact('browser.production', 'react').exports.includes('useState'));
  assert.deepEqual(artifact('node.production', 'vue').adapters, ['commonjs-star-names', 'require-bridge']);
  assert.ok(artifact('node.production', 'vue').exports.includes('createSSRApp'));
  const native = browser.filter(candidate => !candidate.adapters.length);
  assert.ok(native.length > 60 && native.every(candidate => candidate.input === 'esm'), 'Published ESM needs no adapter');
  assert.deepEqual(artifact('browser.production', 'vue').stars, ['@vue/runtime-dom'], 'A public star re-export stays native');
});

test('E5: every crossed package boundary is declared and satisfied by the installed version', () => {
  for (const [target, build] of Object.entries(builds)) {
    const edges = build.packages.packageEdges;
    assert.ok(edges.length > 100, `${target}: ${edges.length} edges`);
    assert.deepEqual(edges.filter(edge => !edge.declared || !edge.satisfied), [], target);
    assert.deepEqual(build.packages.unsupported, [], target);
    assert.equal(build.map.scopes, undefined, 'This installation has one version per package, so no scope is needed');
  }
  const peer = builds['browser.production'].packages.packageEdges
    .find(edge => edge.from.startsWith('@headlessui/vue@') && edge.specifier === 'vue');
  assert.equal(peer.declared, 'peerDependencies');
});

test('E6: subpaths that share unpublished files are split natively; published siblings are references', () => {
  const svelte = builds['browser.production'].packages.artifacts.filter(candidate => candidate.package === 'svelte');
  assert.ok(svelte.every(candidate => candidate.splitting), 'Every Svelte subpath comes from one split build');
  const internal = artifact('browser.production', 'svelte/internal/client').chunks;
  assert.ok(artifact('browser.production', 'svelte').chunks.some(chunk => internal.includes(chunk)),
    'The runtime state shared by `svelte` and `svelte/internal/client` lives in a common chunk');
  const shoelace = builds['browser.production'].packages.artifacts
    .filter(candidate => candidate.package === '@shoelace-style/shoelace' && candidate.chunks);
  assert.ok(shoelace.length >= 3, 'Shoelace components share their unpublished chunks');
  const directive = artifact('browser.production', 'lit-html/directives/class-map.js');
  assert.ok(Object.keys(directive.references).includes('lit-html'), 'A relative import of the published core became a public reference');
  assert.equal(directive.splitting, undefined);
});

test('E7: production artifacts are minified and smaller than development ones', () => {
  const bytes = target => builds[target].packages.artifacts.reduce((total, candidate) => total + candidate.bytes, 0);
  assert.ok(bytes('browser.production') * 2 < bytes('browser.development'),
    `${bytes('browser.production')} production bytes against ${bytes('browser.development')}`);
});
