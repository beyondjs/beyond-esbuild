import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cp, readFile as read, readdir, rm, writeFile as write } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Ecosystem } from './ecosystem.mjs';

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

/** Real Chromium consumers of the packaged Vue, Svelte, Radix and Shoelace artifacts. */
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
    const names = ['@fixture/vue-app/main', '@fixture/svelte-app/main', '@fixture/controls/tabs', '@fixture/controls/shoelace', 'esm-env'];
    const body = `([vue, svelte, tabs, shoelace, env]) => {
      vue.mount(document.querySelector('#vue'), 'Vue');
      svelte.start(document.querySelector('#svelte'), 'Svelte');
      tabs.mount(document.querySelector('#tabs'));
      globalThis.__packaged = { ready: true, defined: shoelace.configure('/packages/shoelace'), environment: { DEV: env.DEV, BROWSER: env.BROWSER } };
    }`;
    const load = format === 'system'
      ? `<script type="systemjs-importmap">${JSON.stringify(build.map)}</script><script src="/systemjs"></script>
<script>Promise.all(${JSON.stringify(names)}.map(name => System.import(name))).then(${body});</script>`
      : `<script type="importmap">${JSON.stringify(build.map)}</script>
<script type="module">Promise.all(${JSON.stringify(names)}.map(name => import(name))).then(${body});</script>`;
    return `<!doctype html><html class="sl-theme-light"><head><meta charset="utf-8"><title>${build.target} ${format}</title>
${links}</head><body><div id="vue"></div><div id="svelte"></div><div id="tabs"></div>
<sl-button id="shoelace-button" variant="primary">Shoelace</sl-button><sl-switch id="shoelace-switch">Switch</sl-switch>
${load}</body></html>`;
  }

  // The existing adapter: TypeScript converts each native ESM artifact to System.register, in a parallel tree.
  async #system(build) {
    const output = `${build.output}.system`;
    await rm(output, { recursive: true, force: true });
    await cp(build.output, output, { recursive: true });
    const { typescript } = this.#toolchain;
    for (const entry of await readdir(output, { recursive: true })) {
      if (!entry.endsWith('.mjs')) continue;
      const converted = typescript.transpileModule(await read(join(output, entry), 'utf8'), { compilerOptions: {
        target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.System } });
      await write(join(output, entry), converted.outputText);
    }
    return output;
  }

  async #target(browser, platform, environment, format = 'esm') {
    // The adapter run converts the artifacts the native run already built and verified
    const key = `${platform}.${environment}`;
    if (!this.#builds.has(key)) this.#builds.set(key, await this.#ecosystem.build(platform, environment, { cohesion: process.env.BEYOND_COHESION !== 'off' }));
    const build = this.#builds.get(key);
    const root = format === 'system' ? await this.#system(build) : build.output;
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
      assert.deepEqual(state.defined, [true, true], 'Shoelace custom elements are defined');
      assert.deepEqual(state.environment, { DEV: environment === 'development', BROWSER: true }, 'Conditional exports follow the target');

      await page.click('#vue-increment');
      await page.click('#vue-switch');
      assert.equal(await page.textContent('#vue-summary'), 'Vue: 1');
      assert.equal(await page.textContent('#vue-enabled'), 'on', 'Headless UI switch drives Vue state across packages');
      await page.click('#svelte-increment');
      await page.click('#svelte-increment');
      assert.equal(await page.textContent('#svelte-summary'), 'Svelte: 2');
      assert.equal(await page.textContent('#svelte-history'), '1,2', 'svelte/store and the component runtime share one state');
      await page.waitForSelector('#panel-account');
      await page.click('#tab-password');
      assert.equal(await page.textContent('#panel-password'), 'Password settings', 'Radix tabs switch through packaged React');
      assert.equal(await page.locator('#panel-account').count() && await page.locator('#panel-account').isVisible(), false);

      const observed = await page.evaluate(async () => {
        await customElements.whenDefined('sl-switch');
        const toggle = document.querySelector('#shoelace-switch');
        toggle.click();
        await toggle.updateComplete;
        await new Promise(resolve => setTimeout(resolve, 400));
        const style = selector => getComputedStyle(document.querySelector(selector));
        const button = document.querySelector('#shoelace-button').shadowRoot.querySelector('[part="base"]');
        return { checked: toggle.checked, lit: globalThis.litHtmlVersions, reactive: globalThis.reactiveElementVersions,
          vue: style('#vue .panel').borderLeftColor, svelte: style('#svelte .panel').borderLeftColor,
          button: getComputedStyle(button).backgroundColor,
          control: getComputedStyle(toggle.shadowRoot.querySelector('[part="control"]')).backgroundColor };
      });
      assert.equal(observed.checked, true, 'Shoelace switch toggles');
      assert.equal(observed.lit.length, 1, 'One lit-html instance across every subpath artifact');
      assert.equal(observed.reactive.length, 1, 'One reactive-element instance');
      assert.equal(observed.vue, 'rgb(66, 184, 131)', 'Scoped SFC style artifact applies');
      assert.equal(observed.svelte, 'rgb(255, 62, 0)', 'Svelte component style artifact applies');
      assert.notEqual(observed.button, 'rgba(0, 0, 0, 0)', 'The packaged theme stylesheet styles the control');
      assert.equal(observed.control, observed.button, 'The checked switch takes the same theme token as the primary button');

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
  `Vue SFC + Headless UI, Svelte, Radix tabs, Shoelace in real Chromium (${modules} module requests)`));
console.log('Evidence: beyond/.cache/packaging/<target>[.system]/browser.json and browser.png');
