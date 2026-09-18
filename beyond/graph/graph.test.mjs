import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Workspace } from '../workspace.mjs';
import { Toolchain } from '../toolchain.mjs';
import { Traversal } from './traversal.mjs';
import { Packages } from './packages.mjs';
import { Graph } from './graph.mjs';

const toolchain = await Toolchain.load();
const semver = createRequire(import.meta.url)(join(toolchain.dependencies, 'semver'));

const manifests = [
  { name: '@fixture/app', version: '1.2.0', exports: { './main': './main.mjs', './settings': './settings.mjs' },
    dependencies: { '@fixture/shared': '^1.0.0', '@fixture/strict': '^2.0.0' } },
  { name: '@fixture/shared', version: '1.4.0', exports: { './message': './message.mjs' } },
  { name: '@fixture/strict', version: '1.9.0', exports: { './main': './main.mjs' } },
  { name: '@fixture/legacy', version: '2.0.0', exports: { './main': './main.mjs' } }
];

/** Writes the authored module used by every assertion below. */
function module(workspace) {
  workspace.set('index.ts', `import { format } from './format';
import type { Shape } from './types';
import { unused } from './unused';
import { gone } from '@fixture/gone/main';
import { greeting } from '@fixture/shared/message';
import { theme } from '@fixture/app/settings';
import { join } from 'node:path';
import React from 'react';
const legacy = require('@fixture/legacy/main');
export const lazy = () => import('@fixture/shared/lazy');
export const strict = () => import('@fixture/strict/main');
export const view = (shape: Shape) => format(greeting() + theme + join('a', 'b') + legacy + React.version);
`);
  workspace.set('format.ts', "import { Decoration } from './nested/decoration';\nexport const format = (value: string) => new Decoration().apply(value);\n");
  workspace.set('nested/decoration.ts', "import { palette } from '@fixture/shared/message';\nexport class Decoration { apply(value: string) { return palette + value; } }\n");
  workspace.set('types.ts', 'export interface Shape { value: number }\n');
  workspace.set('unused.ts', "import '@fixture/shared/message';\nexport const unused = 1;\n");
}

async function graph(workspace) {
  const traversal = await new Traversal(toolchain.api, workspace.root).run();
  return new Graph(traversal, new Packages(semver, manifests), '@fixture/app', '@fixture/app/main');
}

test('F1: file graph records direct, transitive and erased internal edges', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  module(workspace);
  const { files } = await graph(workspace);
  const index = files.nodes.find(node => node.id === 'index.ts');
  assert.deepEqual(index.direct.filter(edge => !edge.erased).map(edge => edge.to), ['format.ts']);
  assert.deepEqual(index.transitive, ['format.ts', 'nested/decoration.ts'],
    'The transitive closure reaches a file the entry never names');
  assert.deepEqual(index.direct.filter(edge => edge.erased).map(edge => edge.to), ['./unused'],
    'An unused value import is an authoring edge that the runtime graph does not contain');
  assert.equal(files.nodes.some(node => node.id === 'unused.ts' || node.id === 'types.ts'), false,
    'Erased and type-only files are not runtime inputs; type edges belong to declaration analysis');
  assert.deepEqual(files.cycles, []);
});

test('F2: public-module graph keeps bare identities, importer and kind without inlining', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  module(workspace);
  const { modules } = await graph(workspace);
  const edge = (to, source) => modules.edges.find(item => item.to === to && item.source === source);
  assert.equal(edge('@fixture/shared/message', 'index.ts').kind, 'import-statement');
  assert.equal(edge('@fixture/shared/message', 'nested/decoration.ts').kind, 'import-statement',
    'A public reference of a transitive internal file belongs to the same public module');
  assert.equal(edge('@fixture/shared/lazy', 'index.ts').lazy, true);
  assert.equal(edge('@fixture/legacy/main', 'index.ts').kind, 'require-call');
  assert.equal(edge('@fixture/app/settings', 'index.ts').kind, 'import-statement',
    'Another public module of the same package stays a bare public edge');
  assert.equal(edge('@fixture/gone/main', 'index.ts').erased, true,
    'The metafile flags an unused bare import as external; it is not a runtime public dependency');
  assert.ok(modules.edges.every(item => item.from === '@fixture/app/main'));
});

test('F3: package graph is joined from manifests and reports unsatisfied references', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  module(workspace);
  const { packages } = await graph(workspace);
  const source = specifier => packages.resolved.find(item => item.specifier === specifier);
  assert.equal(source('node:path').source, 'builtin');
  assert.equal(source('react').source, 'external', 'Not a workspace package: left to the external resolver');
  assert.equal(source('@fixture/gone/main'), undefined, 'Erased references never reach package validation');
  assert.deepEqual(source('@fixture/shared/message'), { specifier: '@fixture/shared/message', source: 'workspace',
    vspecifier: '@fixture/shared@1.4.0/message', package: '@fixture/shared@1.4.0', range: '^1.0.0', own: false });
  assert.equal(source('@fixture/app/settings').own, true, 'Own public modules need no self dependency');
  assert.deepEqual(packages.edges, [{ from: '@fixture/app', to: '@fixture/shared@1.4.0', range: '^1.0.0' }],
    'One package edge regardless of how many files or modules produced it');
  assert.deepEqual(packages.errors.map(error => [error.code, error.specifier]).sort(), [
    ['DEPENDENCY_INCOMPATIBLE', '@fixture/strict/main'],
    ['DEPENDENCY_NOT_DECLARED', '@fixture/legacy/main'],
    ['MODULE_NOT_FOUND', '@fixture/shared/lazy']]);
});

test('F4: cycles between internal files are reported before the runtime rejects them', async t => {
  const workspace = new Workspace();
  t.after(() => workspace.destroy());
  workspace.set('index.ts', "export { a } from './a';\n");
  workspace.set('a.ts', "import { b } from './b';\nexport const a = () => b;\n");
  workspace.set('b.ts', "import { a } from './a';\nexport const b = () => a;\n");
  const { files } = await graph(workspace);
  assert.deepEqual(files.cycles, [['a.ts', 'b.ts', 'a.ts']]);
});
