import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const express = (await import('./express.mjs')).default;
const app = express();
app.use(express.json());
app.post('/probe/:name', (request, response) => response.json({name: request.params.name, value: request.body.value}));
const server = await new Promise((resolve, reject) => {const server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));});
try {
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/probe/Beyond', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({value: 42})});
  console.log(JSON.stringify({status: response.status, body: await response.json(), files: Object.keys(require.cache)}));
} finally {await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));}
