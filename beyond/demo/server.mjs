import { createServer as create } from 'node:http';
import { readFile as read } from 'node:fs/promises';
import { fileURLToPath as filename } from 'node:url';
import { resolve, join, extname, sep } from 'node:path';

/** Serves only fixture artifacts over loopback, providing a local CDN-format proof. */
export class Server {
  #root = filename(new URL('./', import.meta.url));
  #cache = resolve(filename(new URL('../.cache/', import.meta.url)));
  #server;

  /** Start the local fixture server; zero selects an ephemeral port for browser tests. */
  async start(port = 4178) {
    this.#server = create((request, response) => this.#respond(request, response));
    await new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(port, '127.0.0.1', resolve);
    });
    return `http://127.0.0.1:${this.#server.address().port}`;
  }

  /** Release the listener after an automated verification run. */
  async close() { await new Promise(resolve => this.#server.close(resolve)); }

  async #respond(request, response) {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/') return this.#send(response, await read(join(this.#root, 'index.html')), 'text/html');
      if (url.pathname === '/view') return this.#send(response, this.#view(url.searchParams.get('format')), 'text/html');
      let path;
      if (url.pathname === '/site.css') path = join(this.#root, 'site.css');
      else if (url.pathname.startsWith('/artifacts/')) {
        path = resolve(this.#cache, url.pathname.slice('/artifacts/'.length));
        if (!path.startsWith(this.#cache + sep)) throw new Error('Invalid artifact path');
      } else {
        const route = /^\/cdn\/(esm|system)\/(app|shared|patch)\.(js|css)$/.exec(url.pathname);
        if (!route) { response.writeHead(404); response.end('Not found'); return; }
        const [, format, name, extension] = route;
        if (extension === 'css') path = join(this.#cache, 'demo', `${name}.css`);
        else {
          const suffix = format === 'esm' ? 'mjs' : 'system.js';
          path = name === 'patch' ? join(this.#cache, 'example', `patch.${suffix}`)
            : join(this.#cache, 'example/node_modules/@fixture', name === 'app' ? `app/main.${suffix}` : `shared/message.${suffix}`);
        }
      }
      const types = { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.map': 'application/json' };
      this.#send(response, await read(path), types[extname(path)] || 'application/octet-stream');
    } catch (error) { response.writeHead(500); response.end(error.message); }
  }

  #send(response, body, type) {
    response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
    response.end(body);
  }

  #view(mode) {
    const system = mode === 'system';
    const format = system ? 'system' : 'esm';
    const suffix = system ? 'system.js' : 'mjs';
    const kernel = system ? 'sjs.js' : 'browser.mjs';
    const imports = {
      react: `/artifacts/react/react.${suffix}`,
      'react-dom': `/artifacts/react/react-dom.${suffix}`,
      'react-dom/client': `/artifacts/react/react-dom-client.${suffix}`,
      '@fixture/app/main': `/cdn/${format}/app.js`,
      '@fixture/shared/message': `/cdn/${format}/shared.js`,
      '@fixture/demo/config': `/artifacts/demo/config.${suffix}`
    };
    for (const name of ['bundle', 'core', 'styles']) {
      imports[`@beyond-js/kernel/${name}`] = `/artifacts/runtime/node_modules/@beyond-js/kernel/${name}/${name}.${kernel}`;
    }
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${system ? 'SystemJS' : 'ESM'} · Beyond ESBuild</title><link rel="stylesheet" href="/site.css">
      <script>globalThis.__app_package = {specifier:'@fixture/demo', dependencies:[]};</script>
      <script type="${system ? 'systemjs-importmap' : 'importmap'}">${JSON.stringify({ imports })}</script>
      ${system ? '<script src="/artifacts/runtime/node_modules/systemjs/dist/system.min.js"></script>' : ''}
      </head><body class="frame"><div class="frame-heading"><span>${system ? 'SystemJS' : 'ESM'}</span><span id="status">Loading artifacts…</span></div>
      <main id="app"></main><aside id="shared"></aside><p class="probe outside">Document scope remains unchanged.</p>
      ${system ? '<script>System.import("/artifacts/demo/component.system.js").catch(error => {console.error(error); document.querySelector("#status").textContent=error.message;});</script>'
        : '<script type="module" src="/artifacts/demo/component.mjs"></script>'}</body></html>`;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === filename(import.meta.url)) {
  console.log(await new Server().start(Number(process.env.PORT || 4178)));
}
