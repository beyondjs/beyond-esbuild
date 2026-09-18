import { createRequire } from 'node:module';
import { mkdirSync as mkdir, rmSync as remove, writeFileSync as write } from 'node:fs';
import { fileURLToPath as filename } from 'node:url';
import { join } from 'node:path';
import { Toolchain } from '../toolchain.mjs';
import { Authored } from './authored.mjs';
import { Distribution } from './distribution.mjs';
import { Target } from './resolution.mjs';
import { VueSource } from './adapters/vue.mjs';
import { SvelteSource } from './adapters/svelte.mjs';

/**
 * Packages the pinned Vue, Svelte and UI control cases for one target: the authored fixture
 * modules (framework source, through adapters) and the closure of published packages they
 * reference (published JavaScript, no framework adapter). Both keep bare public references; a
 * merged import map is what a browser page or the Node loader resolves them with.
 */
export class Ecosystem {
  static targets = [['browser', 'production'], ['browser', 'development'], ['node', 'production']];
  static assets = ['@shoelace-style/shoelace/dist/themes/light.css'];
  #toolchain;
  #fixtures = filename(new URL('./fixtures/', import.meta.url));

  constructor(toolchain) { this.#toolchain = toolchain; }

  get output() { return join(this.#toolchain.cache, 'packaging'); }

  async build(platform, environment, { cohesion = true } = {}) {
    const target = new Target({ platform, environment });
    const require = createRequire(join(this.#toolchain.ecosystem, 'package.json'));
    const server = platform === 'node';
    const plugins = [new VueSource(require('@vue/compiler-sfc'), { server, production: target.production }),
      new SvelteSource(require('svelte/compiler'), { server, production: target.production })];
    const output = join(this.output, target.key);
    remove(output, { recursive: true, force: true });

    const authored = await new Authored(this.#toolchain, { target, plugins, output: join(output, 'authored'),
      packages: ['vue-app', 'svelte-app', 'controls'].map(name => join(this.#fixtures, name)),
      options: { jsx: 'automatic' } }).build();
    const distribution = new Distribution(this.#toolchain, { root: this.#toolchain.ecosystem, target, cohesion,
      output: join(output, 'packages') });
    const externals = new Set(authored.report.modules.flatMap(module => module.references
      .filter(reference => reference.source === 'external').map(reference => reference.specifier)));
    for (const specifier of [...externals, ...(server ? [] : Ecosystem.assets)]) await distribution.add(specifier);
    const report = await distribution.finish({ adapters: { framework: ['@vue/compiler-sfc', 'svelte/compiler'] } });

    const imports = {};
    Object.entries(authored.imports).forEach(([specifier, file]) => (imports[specifier] = `./authored/${file.slice(2)}`));
    const packaged = distribution.importmap('./packages/');
    const map = { imports: { ...packaged.imports, ...imports }, ...(packaged.scopes ? { scopes: packaged.scopes } : {}) };
    mkdir(output, { recursive: true });
    write(join(output, 'importmap.json'), JSON.stringify(map, null, 2));
    return { target: target.key, output, map, authored: authored.report, packages: report };
  }
}

if (process.argv[1] === filename(import.meta.url)) {
  const ecosystem = new Ecosystem(await Toolchain.load());
  for (const [platform, environment] of Ecosystem.targets) {
    const { target, packages, authored } = await ecosystem.build(platform, environment);
    console.log(`${target}: ${authored.modules.length} authored modules, ${packages.artifacts.length} package artifacts, ` +
      `${packages.packages.length} packages, ${packages.unsupported.length} unsupported`);
    packages.unsupported.forEach(entry => console.log('  unsupported:', JSON.stringify(entry)));
  }
  console.log(`Artifacts: beyond/.cache/packaging`);
}
