import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Ecosystem } from './ecosystem.mjs';
import { ConsumerProcess } from './process.mjs';
import { SystemRegister } from './system.mjs';
import { Lookup } from '../example/maps.mjs';

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

test('E2: Svelte source is reported as unsupported on Node too, and its modules are not offered to a consumer', async t => {
  const build = builds['node.production'];
  assert.deepEqual(build.unsupported.filter(item => item.module.startsWith('@fixture/svelte-app/')).map(item => item.module).sort(),
    ['@fixture/svelte-app/main', '@fixture/svelte-app/server']);
  assert.equal(build.map.imports['@fixture/svelte-app/server'], undefined);
  const node = consumer(t, 'node.production');
  // Nothing resolves a module whose graph is incomplete: the failure is the resolution, not a half-loaded graph
  await assert.rejects(node.load('svelte', '@fixture/svelte-app/server'), /ERR_MODULE_NOT_FOUND.*@fixture\/svelte-app/);
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
    const shared = build.packages.unsupported.filter(item => item.reason === 'shared-private-files').map(item => item.package);
    assert.deepEqual(shared.sort(), ['@shoelace-style/shoelace@2.20.1', 'svelte@5.57.0'], `${target}: exactly these are unsupported`);
    assert.equal(build.map.scopes, undefined, 'This installation has one version per package, so no scope is needed');
  }
  const peer = builds['browser.production'].packages.packageEdges
    .find(edge => edge.from.startsWith('@headlessui/vue@') && edge.specifier === 'vue');
  assert.equal(peer.declared, 'peerDependencies');
});

test('E6: the public module is the only division: shared identity goes through public references, never private chunks', () => {
  const build = builds['browser.production'];
  const { artifacts, unsupported } = build.packages;

  // A relative import of a file the package publishes is a reference to that public module
  const directive = artifact('browser.production', 'lit-html/directives/class-map.js');
  assert.ok(Object.keys(directive.references).includes('lit-html'), 'The published core is referenced, not copied');

  // Two public names of one file are one module: both resolve to the same URL, which is what identity is in ESM
  const env = artifacts.find(candidate => candidate.package === 'esm-env' && candidate.names.length > 1);
  assert.deepEqual(env.names, ['esm-env/development', 'esm-env/node']);
  assert.equal(build.map.imports['esm-env/development'], build.map.imports['esm-env/node']);

  // Nothing executable exists besides public modules: no split build, no chunk, no file without an artifact
  assert.ok(artifacts.every(candidate => !('splitting' in candidate) && !('chunks' in candidate)));
  const published = new Set(artifacts.filter(candidate => !candidate.unsupported).map(candidate => candidate.file));
  const emitted = readdirSync(join(build.output, 'packages'), { recursive: true }).map(String)
    .map(name => name.split('\\').join('/')).filter(name => name.endsWith('.mjs'));
  assert.deepEqual(emitted.filter(name => !published.has(name)), [], 'Every emitted module is a public module');
  assert.equal(emitted.length, [...published].filter(name => name.endsWith('.mjs')).length);

  // Packages whose public modules share private files are reported and withdrawn, not divided a second way
  const svelte = unsupported.find(item => item.package === 'svelte@5.57.0');
  assert.ok(svelte.shared.includes('node_modules/svelte/src/internal/client/runtime.js'), 'The reactive runtime state is among the shared files');
  assert.ok(svelte.artifacts.some(file => file.endsWith('/index.browser.production.mjs')) && svelte.artifacts.some(file => file.includes('internal/client')));
  const shoelace = unsupported.find(item => item.package === '@shoelace-style/shoelace@2.20.1');
  assert.ok(shoelace.shared.every(file => file.includes('/dist/chunks/')), 'Its own build shares chunks that its exports do not publish');
  for (const file of [...svelte.artifacts, ...shoelace.artifacts]) {
    assert.equal(existsSync(join(build.output, 'packages', file)), false, `${file} is not written`);
    assert.ok(!Object.values(build.map.imports).some(target => target.endsWith(file)), `${file} is not in the import map`);
  }
  assert.deepEqual(build.unsupported.map(item => item.module).sort(),
    ['@fixture/controls/shoelace', '@fixture/svelte-app/main', '@fixture/svelte-app/server']);
});

test('E7: production artifacts are minified and smaller than development ones', () => {
  const bytes = target => builds[target].packages.artifacts.reduce((total, candidate) => total + candidate.bytes, 0);
  assert.ok(bytes('browser.production') * 2 < bytes('browser.development'),
    `${bytes('browser.production')} production bytes against ${bytes('browser.development')}`);
});

test('E8: the System.register adapter keeps the module graph and the source maps of the native ESM output', async () => {
  const build = builds['browser.production'];
  const { output, modules } = await new SystemRegister(toolchain).convert(build);
  const published = build.packages.artifacts.filter(candidate => !candidate.unsupported && candidate.file.endsWith('.mjs'));
  assert.equal([...modules.keys()].filter(file => file.startsWith('packages/')).length, published.length, 'Same modules, none added');
  for (const candidate of published) {
    const declared = modules.get(`packages/${candidate.file}`);
    assert.deepEqual([...declared].sort(), Object.keys(candidate.references).sort(), `${candidate.file}: same public references`);
    assert.ok(declared.every(specifier => !/^[./]/.test(specifier)), `${candidate.file}: every dependency is a bare public reference`);
  }

  // The map of a converted module reaches the original source, through the map of the artifact it was converted from
  const core = join(output, 'packages', artifact('browser.production', 'lit-html').file);
  const lines = readFileSync(core, 'utf8').split('\n');
  const line = lines.findIndex(text => text.includes('litHtmlVersions'));
  const original = new Lookup(readFileSync(`${core}.map`, 'utf8')).original(line, lines[line].indexOf('litHtmlVersions'));
  // The published JavaScript of lit-html maps to its TypeScript source, and the chain keeps that too
  assert.match(original.source, /lit-html\/(src\/lit-html\.ts|lit-html\.js)$/);
  const map = JSON.parse(readFileSync(`${core}.map`, 'utf8'));
  const source = map.sourcesContent[map.sources.indexOf(original.source)].split('\n')[original.line];
  assert.ok(source.includes('litHtmlVersions'), `The converted position maps to the original line: ${source.trim().slice(0, 80)}`);
});
