import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ReactBuild } from './build.mjs';

const directory = await new ReactBuild().run();

test('React and ReactDOM SSR execute through only the built isolated package map', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['-e', `
    const React = require('./react.cjs');
    const server = require('./react-dom-server.cjs');
    const Component = () => {
      const [value] = React.useState('Beyond ESBuild');
      return React.createElement('section', { 'data-build': 'fork' }, value);
    };
    console.log(JSON.stringify({version: React.version, same: React === require('react'),
      html: server.renderToString(React.createElement(Component)), files: Object.keys(require.cache)}));
  `], { cwd: directory, encoding: 'utf8' }));
  assert.equal(result.version, '19.2.0');
  assert.equal(result.same, true);
  assert.equal(result.html, '<section data-build="fork">Beyond ESBuild</section>');
  assert.ok(result.files.every(path => path.startsWith(directory + '/')),
    'Fresh SSR process must load only built files, not installed React sources');
});

test('React outputs retain separate file/package/public graph evidence and System adapters', () => {
  const graph = JSON.parse(readFileSync(`${directory}/react-dom-client.esm.graph.json`, 'utf8'));
  assert.ok(graph.traversal.files.length > 3);
  assert.ok(graph.traversal.public.includes('react'));
  assert.ok(graph.packages.some(item => item.name === 'scheduler' && item.version));
  assert.ok(graph.files.flatMap(file => file.imports).some(edge => edge.path === 'react' && edge.boundary === 'public'));
  assert.ok(graph.files.flatMap(file => file.imports).some(edge => edge.boundary === 'file'));
  for (const name of ['react', 'react-dom', 'react-dom-client']) {
    assert.match(readFileSync(`${directory}/${name}.system.js`, 'utf8'), /System\.register/);
  }
});
