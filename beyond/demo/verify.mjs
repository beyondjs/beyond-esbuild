import assert from 'node:assert/strict';
import { createRequire as require } from 'node:module';
import { fileURLToPath as filename } from 'node:url';
import { mkdir, readFile as read, writeFile as write } from 'node:fs/promises';
import { join } from 'node:path';
import { Server } from './server.mjs';
import { Styles } from './styles.mjs';
import { Workspace } from '../workspace.mjs';
import { Toolchain } from '../toolchain.mjs';

/** Verifies real Chromium rendering, interaction, creator updates and module CSS. */
class Verification {
  #server = new Server();
  #browser;
  #output = filename(new URL('../.cache/demo/', import.meta.url));
  #errors = [];
  #requests = [];

  /** Assert both real-browser paths and retain inspectable diagnostic evidence. */
  async run() {
    const playwright = require(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
    const address = await this.#server.start(0);
    await mkdir(this.#output, { recursive: true });
    try {
      this.#browser = await playwright.chromium.launch({ headless: true });
      const page = await this.#browser.newPage({ viewport: { width: 1440, height: 1080 } });
      page.on('pageerror', error => this.#errors.push(error.message));
      page.on('response', response => {
        const { pathname, search } = new URL(response.url());
        this.#requests.push({ url: pathname, search, status: response.status() });
      });
      await page.goto(address);
      const results = [];
      for (const format of ['esm', 'system']) {
        const frame = page.frames().find(frame => frame.url().includes(`format=${format}`));
        assert.ok(frame, `Missing ${format} iframe`);
        await frame.waitForFunction(() => globalThis.__demo, undefined, { timeout: 15000 });
        const state = await frame.evaluate(() => globalThis.__demo);
        assert.equal(state.ready, true, JSON.stringify(state));
        assert.equal(state.react, '19.2.0');
        assert.match(await frame.locator('#app h2').innerText(), /\[app\] Hello Beyond/);
        assert.equal(await frame.getByTestId('answer').innerText(), 'Beyond answer: 42');
        const colors = {};
        for (const [name, selector] of Object.entries({ app: '#app .probe', shared: '#shared .probe', document: '.outside' })) {
          colors[name] = await frame.locator(selector).evaluate(element => getComputedStyle(element).color);
        }
        assert.deepEqual(colors, { app: 'rgb(36, 91, 117)', shared: 'rgb(182, 83, 36)', document: 'rgb(40, 84, 52)' });
        assert.deepEqual(state.css.map(href => new URL(href).pathname), [`/cdn/${format}/app.css`, `/cdn/${format}/shared.css`]);
        await frame.getByTestId('react').click();
        await frame.getByTestId('clicks').filter({ hasText: 'React updates: 1' }).waitFor();
        await frame.getByTestId('patch').click();
        await frame.getByTestId('answer').filter({ hasText: 'Beyond answer: 43' }).waitFor();
        assert.equal(await frame.getByTestId('runs').innerText(), 'Internal counter: 2');
        results.push({ format, react: state.react, identity: state.identity, colors,
          checks: ['React rendered', 'React state updated', 'original Beyond consumer patched',
            'unchanged internal state retained', 'real Kernel CSS registry', 'two shadow roots isolated from document'] });
      }
      await this.#restyle(page, results);
      assert.deepEqual(this.#errors, [], 'No browser runtime errors');
      assert.ok(this.#requests.every(request => request.status < 400), JSON.stringify(this.#requests.filter(request => request.status >= 400)));
      for (const suffix of ['mjs', 'system.js']) {
        for (const name of ['react', 'react-jsx-runtime', 'react-dom', 'react-dom-client']) {
          assert.ok(this.#requests.some(request => request.url === `/artifacts/react/${name}.${suffix}`));
        }
      }
      await page.screenshot({ path: join(this.#output, 'browser.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const frame of page.frames().filter(frame => frame.url().includes('/view?'))) {
        assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.screenshot({ path: join(this.#output, 'mobile.png'), fullPage: true });
      await write(join(this.#output, 'browser.json'), JSON.stringify({ browser: await this.#browser.version(),
        results, mobile: { width: 390, horizontalOverflow: false },
        requests: this.#requests, errors: this.#errors }, null, 2) + '\n');
      console.log('PASS: real Chromium ESM + SystemJS, React interaction, Beyond creator patch, modular CSS isolation and replacement');
      console.log(`Evidence: ${this.#output}`);
    } catch (error) {
      console.error('Browser errors:', this.#errors);
      throw error;
    } finally {
      await this.#browser?.close();
      await this.#server.close();
    }
  }

  /** Rebuilds the invalidated module CSS, then replaces it through the Kernel change contract. */
  async #restyle(page, results) {
    const { api } = await Toolchain.load();
    const fixtures = filename(new URL('./fixtures/', import.meta.url));
    const workspace = new Workspace();
    try {
      for (const name of ['app.css', 'shared.css']) workspace.set(name, await read(join(fixtures, name), 'utf8'));
      workspace.set('palette.css', ':host { --module-accent: #7a1f5c; }\n');
      const changed = new Styles(api, workspace.root, this.#output);
      await changed.build();
      assert.deepEqual(changed.affected('palette.css'), ['app']);
      await changed.dispose();
      for (const result of results) {
        const frame = page.frames().find(frame => frame.url().includes(`format=${result.format}`));
        await frame.getByTestId('restyle').click();
        await frame.waitForFunction(() => getComputedStyle(document.querySelector('#app').shadowRoot
          .querySelector('.probe')).color === 'rgb(122, 31, 92)', undefined, { timeout: 15000 });
        assert.equal(await frame.locator('#shared .probe').evaluate(element => getComputedStyle(element).color), result.colors.shared);
        assert.equal(await frame.locator('.outside').evaluate(element => getComputedStyle(element).color), result.colors.document);
        assert.equal(await frame.locator('#app').evaluate(element => element.shadowRoot.querySelectorAll('link').length), 1,
          'The replaced stylesheet was removed after its successor loaded');
        assert.ok(this.#requests.some(request => request.url === `/cdn/${result.format}/app.css` && request.search === '?version=1'));
        result.checks.push('module CSS replaced through Kernel change() and versioned href');
      }
    } finally {
      workspace.destroy();
      const pristine = new Styles(api, fixtures, this.#output);
      await pristine.build();
      await pristine.dispose();
    }
  }
}

await new Verification().run();
