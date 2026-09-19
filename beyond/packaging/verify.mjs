import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile as read, writeFile as write } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Ecosystem } from './ecosystem.mjs';
import { SystemRegister } from './system.mjs';

/** Serves one packaged target from a loopback port: artifacts, maps and the consumer page. */
class Site {
  static types = { '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.html': 'text/html' };
  #root;
  #page;
  #loader;
  #server;

  constructor(root, page, loader) {
    this.#root = root;
    this.#page = page;
    this.#loader = loader;
  }

  async start() {
    this.#server = createServer(async (request, response) => {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/') return response.writeHead(200, { 'content-type': 'text/html' }).end(this.#page);
      const path = pathname === '/systemjs' ? this.#loader : normalize(join(this.#root, decodeURIComponent(pathname)));
      const body = path === this.#loader || path.startsWith(this.#root) ? await read(path).catch(() => undefined) : undefined;
      if (!body) return response.writeHead(404).end();
      response.writeHead(200, { 'content-type': Site.types[extname(path)] ?? 'application/octet-stream' }).end(body);
    });
    await new Promise(resolve => this.#server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${this.#server.address().port}/`;
  }

  stop() { return new Promise(resolve => this.#server.close(resolve)); }
}

/**
 * Real Chromium consumers of the packaged Vue, Headless UI, Radix and lit artifacts. Svelte source and the
 * Shoelace components are not driven: their packages share private files between public modules, which the
 * distribution reports as unsupported, and this run checks that they are reported and never requested.
 */
class Verification {
  #ecosystem;
  #toolchain;
  #builds = new Map();
  #playwright = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');

  constructor(ecosystem, toolchain) {
    this.#ecosystem = ecosystem;
    this.#toolchain = toolchain;
  }

  #page(build, format) {
    const styles = build.authored.modules.filter(module => module.style).map(module => `./authored/${module.style}`);
    const theme = build.packages.artifacts.find(artifact => artifact.file.endsWith('.css'));
    const links = [...styles, `./packages/${theme.file}`].map(href => `<link rel="stylesheet" href="${href}">`).join('\n');
    const names = ['@fixture/vue-app/main', '@fixture/controls/tabs', 'esm-env', 'lit', 'lit-html/directives/class-map.js'];
    const body = `([vue, tabs, env, lit, directive]) => {
      vue.mount(document.querySelector('#vue'), 'Vue');
      tabs.mount(document.querySelector('#tabs'));
      lit.render(lit.html\`<p id="lit" class=\${directive.classMap({ packaged: true })}>lit</p>\`, document.querySelector('#lit-root'));
      globalThis.__packaged = { ready: true, environment: { DEV: env.DEV, BROWSER: env.BROWSER } };
    }`;
    const load = format === 'system'
      ? `<script type="systemjs-importmap">${JSON.stringify(build.map)}</script><script src="/systemjs"></script>
<script>Promise.all(${JSON.stringify(names)}.map(name => System.import(name))).then(${body});</script>`
      : `<script type="importmap">${JSON.stringify(build.map)}</script>
<script type="module">Promise.all(${JSON.stringify(names)}.map(name => import(name))).then(${body});</script>`;
    return `<!doctype html><html class="sl-theme-light"><head><meta charset="utf-8"><title>${build.target} ${format}</title>
${links}</head><body><div id="vue"></div><div id="tabs"></div><div id="lit-root"></div>
${load}</body></html>`;
  }

  async #target(browser, platform, environment, format = 'esm') {
    // The adapter run converts the artifacts the native run already built and verified
    const key = `${platform}.${environment}`;
    if (!this.#builds.has(key)) this.#builds.set(key, await this.#ecosystem.build(platform, environment));
    const build = this.#builds.get(key);
    const root = format === 'system' ? (await new SystemRegister(this.#toolchain).convert(build)).output : build.output;
    const site = new Site(root, this.#page(build, format), this.#toolchain.require.resolve(join(this.#toolchain.dependencies, 'systemjs/dist/system.min.js')));
    const address = await site.start();
    const page = await browser.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => message.type() === 'error' && errors.push(message.text()));
    page.on('response', response => requests.push({ url: new URL(response.url()).pathname, status: response.status() }));
    try {
      await page.goto(address);
      await page.waitForFunction(() => globalThis.__packaged?.ready, undefined, { timeout: 20000 }).catch(error => {
        throw Error(`${build.target} ${format}: the consumer page never became ready. Page errors: ${JSON.stringify(errors)}`, { cause: error });
      });
      const state = await page.evaluate(() => globalThis.__packaged);
      assert.deepEqual(state.environment, { DEV: environment === 'development', BROWSER: true }, 'Conditional exports follow the target');

      await page.click('#vue-increment');
      await page.click('#vue-switch');
      assert.equal(await page.textContent('#vue-summary'), 'Vue: 1');
      assert.equal(await page.textContent('#vue-enabled'), 'on', 'Headless UI switch drives Vue state across packages');
      await page.waitForSelector('#panel-account');
      await page.click('#tab-password');
      assert.equal(await page.textContent('#panel-password'), 'Password settings', 'Radix tabs switch through packaged React');
      assert.equal(await page.locator('#panel-account').count() && await page.locator('#panel-account').isVisible(), false);

      const observed = await page.evaluate(() => {
        const style = selector => getComputedStyle(document.querySelector(selector));
        return { lit: globalThis.litHtmlVersions, applied: document.querySelector('#lit').classList.contains('packaged'),
          vue: style('#vue .panel').borderLeftColor, token: style('html').getPropertyValue('--sl-color-primary-600').trim() };
      });
      assert.equal(observed.lit.length, 1, 'One lit-html instance: `lit` and its directive artifact refer to the same public module');
      assert.equal(observed.applied, true, 'The directive artifact works against that instance');
      assert.equal(observed.vue, 'rgb(66, 184, 131)', 'Scoped SFC style artifact applies');
      assert.notEqual(observed.token, '', 'The packaged theme stylesheet applies');

      // What the distribution cannot express as public modules is reported, and nothing of it was requested
      assert.deepEqual(build.unsupported.map(item => item.module).sort(),
        ['@fixture/controls/shoelace', '@fixture/svelte-app/main', '@fixture/svelte-app/server']);
      assert.deepEqual(requests.filter(request => /\/(svelte@|@shoelace-style\/shoelace@[^/]+\/dist\/components)/.test(request.url)), []);
      assert.deepEqual(requests.filter(request => request.url.includes('/chunks/')), [], 'No private chunk exists to request');

      const failed = requests.filter(request => request.status >= 400);
      assert.deepEqual(failed, [], 'Every module, style and map request succeeded');
      assert.deepEqual(errors, [], 'No page or console errors');
      await page.screenshot({ path: join(root, 'browser.png'), fullPage: true });
      const modules = requests.filter(request => request.url.endsWith('.mjs')).length;
      const evidence = { target: build.target, format, modules, observed, state, requests };
      await write(join(root, 'browser.json'), JSON.stringify(evidence, null, 2));
      return { target: build.target, format, modules };
    } finally {
      await page.close();
      await site.stop();
    }
  }

  async run() {
    const browser = await this.#playwright.chromium.launch({ headless: true });
    try {
      const results = [];
      for (const environment of ['production', 'development']) results.push(await this.#target(browser, 'browser', environment));
      results.push(await this.#target(browser, 'browser', 'production', 'system'));
      return results;
    } finally {
      await browser.close();
    }
  }
}

const toolchain = await Toolchain.load();
const results = await new Verification(new Ecosystem(toolchain), toolchain).run();
results.forEach(({ target, format, modules }) => console.log(`PASS ${target} ${format === 'system' ? 'System.register adapter + SystemJS' : 'native ESM'}: ` +
  `Vue SFC + Headless UI, Radix tabs and lit in real Chromium (${modules} module requests); Svelte source and Shoelace components reported unsupported, not requested`));
console.log('Evidence: beyond/.cache/packaging/<target>[.system]/browser.json and browser.png');
