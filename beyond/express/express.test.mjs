import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ExpressBuild } from './build.mjs';

const directory = await new ExpressBuild().run();
// The checked-in consumer is evaluated in the output directory, where './express.mjs' resolves.
const consumer = readFileSync(new URL('./fixtures/consumer.mjs', import.meta.url), 'utf8');
const esm = "(await import('./express.mjs')).default";
assert.ok(consumer.includes(esm), 'The consumer loads the ESM artifact through the substituted expression');

for (const format of ['cjs', 'esm']) {
  test(`Express ${format} serves real HTTP using only the built artifact`, () => {
    // The CommonJS probe replaces only the expression that loads the artifact.
    const source = format === 'esm' ? consumer : consumer.replace(esm, "require('./express.cjs')");
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source],
      { cwd: directory, encoding: 'utf8', timeout: 15000 }));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { name: 'Beyond', value: 42 });
    assert.ok(result.files.every(path => path.startsWith(directory + '/')));
  });
}

test('Express graph records transitive installed packages separately from files', () => {
  const graph = JSON.parse(readFileSync(`${directory}/esm.graph.json`, 'utf8'));
  assert.ok(graph.traversal.files.length > 10);
  assert.ok(graph.traversal.external.length > 0);
  assert.ok(graph.packages.some(item => item.name === 'express' && item.version === '5.1.0'));
  assert.ok(graph.packages.some(item => item.name === 'router'));
  assert.ok(graph.files.flatMap(file => file.imports).some(edge => edge.external));
  const router = graph.packageEdges.find(edge => edge.from === 'express@5.1.0' && edge.to.startsWith('router@'));
  assert.deepEqual([router.declared, router.satisfied, router.boundary], ['dependencies', true, 'bundled']);
  assert.ok(graph.packageEdges.length > 20, 'Transitive package edges are recorded, not only the root');
  assert.deepEqual(graph.packageEdges.filter(edge => !edge.satisfied), [],
    'Every crossed package boundary is declared and satisfied by the installed version');
});
