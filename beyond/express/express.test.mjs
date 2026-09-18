import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ExpressBuild } from './build.mjs';

const directory = await new ExpressBuild().run();

for (const format of ['cjs', 'esm']) {
  test(`Express ${format} serves real HTTP using only the built artifact`, () => {
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
      import {createRequire} from 'node:module';
      const require = createRequire(import.meta.url);
      const express = ${format === 'esm' ? "(await import('./express.mjs')).default" : "require('./express.cjs')"};
      const app = express();
      app.use(express.json());
      app.post('/probe/:name', (request, response) => response.json({name: request.params.name, value: request.body.value}));
      const server = await new Promise((resolve, reject) => {const server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));});
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/probe/Beyond', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({value: 42})});
        console.log(JSON.stringify({status: response.status, body: await response.json(), files: Object.keys(require.cache)}));
      } finally {await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));}
    `], { cwd: directory, encoding: 'utf8', timeout: 15000 }));
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
});
