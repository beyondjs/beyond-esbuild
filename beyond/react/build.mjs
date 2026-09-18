import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cache = resolve(root, 'beyond/.cache');
process.env.ESBUILD_BINARY_PATH = resolve(cache, 'esbuild');
const require = createRequire(resolve(cache, 'runtime/package.json'));
const compiler = require(resolve(cache, 'api.cjs'));
const typescript = require('typescript');
const { Installed } = await import('../graph/installed.mjs');
const installed = new Installed(require('semver'), root);

/** Packages a fixed trusted React dependency into independently addressable modules. */
export class ReactBuild {
  #output = resolve(cache, 'react');
  #records = [];

  async run() {
    for (const name of ['react', 'react-dom']) {
      if (this.#package(require.resolve(name)).version !== '19.2.0') throw Error(`Expected ${name}@19.2.0`);
    }
    mkdirSync(this.#output, { recursive: true });
    for (const [name, specifier] of [['react', 'react'], ['react-dom', 'react-dom'],
      ['react-dom-client', 'react-dom/client'], ['react-dom-server', 'react-dom/server'],
      ['react-jsx-runtime', 'react/jsx-runtime']]) {
      await this.#build(name, specifier);
    }
    writeFileSync(resolve(this.#output, 'report.json'), JSON.stringify({ compiler: compiler.version,
      provenance: JSON.parse(readFileSync(resolve(cache, 'provenance.json'))),
      packages: ['react', 'react-dom', 'scheduler'].map(name => this.#package(require.resolve(name))),
      artifacts: this.#records }, null, 2));
    return this.#output;
  }

  #package(path) {
    let directory = dirname(path);
    while (directory !== dirname(directory)) {
      try {
        const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
        if (manifest.name) return { name: manifest.name, version: manifest.version,
          source: relative(root, directory) };
      } catch {}
      directory = dirname(directory);
    }
    return { name: null, source: relative(root, path) };
  }

  #graph(result, name) {
    const inputs = result.metafile.inputs;
    const files = Object.entries(inputs).map(([path, value]) => ({ id: path,
      package: this.#package(resolve(root, path)), imports: value.imports.map(edge => ({
        ...edge, boundary: edge.external ? 'public' : 'file' })) }));
    const packages = [...new Map(files.filter(file => file.package.name)
      .map(file => [file.package.name, file.package])).values()];
    const entries = new Map(files.map(file => [file.id, file]));
    const reachable = new Set();
    const publics = new Set();
    const queue = ['<stdin>'];
    while (queue.length) {
      const id = queue.pop();
      if (reachable.has(id) || !entries.has(id)) continue;
      reachable.add(id);
      for (const edge of entries.get(id).imports) {
        if (edge.external) publics.add(edge.path);
        else queue.push(edge.path);
      }
    }
    const graph = { files, packages, packageEdges: installed.edges(files),
      traversal: { entry: '<stdin>', files: [...reachable].sort(), public: [...publics].sort() },
      outputs: result.metafile.outputs,
      note: 'File edges and installed package identities are separate. External public specifiers remain unresolved by this build; no Beyond version selection is inferred.' };
    writeFileSync(resolve(this.#output, `${name}.graph.json`), JSON.stringify(graph, null, 2));
  }

  async #build(name, specifier) {
    const source = require.resolve(specifier);
    const namespace = require(specifier);
    const names = Object.keys(namespace).filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default' && name !== '__esModule');
    const server = name === 'react-dom-server';
    const externals = specifier === 'react' ? [] : ['react', ...(specifier.startsWith('react-dom/') ? ['react-dom'] : [])];
    const options = { absWorkingDir: root, bundle: true, write: false, metafile: true,
      logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
      external: externals, target: 'es2022', legalComments: 'inline' };
    const directory = resolve(this.#output, 'node_modules', specifier.startsWith('react-dom') ? 'react-dom' : 'react');
    mkdirSync(directory, { recursive: true });
    const part = specifier.split('/')[1] || 'index';
    const cjs = await compiler.build({ ...options, platform: 'node', format: 'cjs',
      stdin: { contents: `module.exports = require(${JSON.stringify(source)});`, resolveDir: root },
      outfile: resolve(directory, `${part}.cjs`) });
    writeFileSync(resolve(directory, `${part}.cjs`), cjs.outputFiles[0].contents);
    writeFileSync(resolve(this.#output, `${name}.cjs`), `module.exports = require('./node_modules/${specifier.startsWith('react-dom') ? 'react-dom' : 'react'}/${part}.cjs');\n`);
    writeFileSync(resolve(directory, 'package.json'), JSON.stringify({ name: specifier.startsWith('react-dom') ? 'react-dom' : 'react',
      version: '19.2.0', main: './index.cjs', exports: specifier.startsWith('react-dom')
        ? { '.': './index.cjs', './client': './client.cjs', './server': './server.cjs' }
        : { '.': './index.cjs', './jsx-runtime': './jsx-runtime.cjs' } }, null, 2));
    this.#graph(cjs, `${name}.cjs`);
    if (server) {
      this.#records.push({ name, source: relative(root, source), names, formats: ['cjs'], platform: 'node' });
      return;
    }
    const banner = externals.map((specifier, index) => `import * as external${index} from ${JSON.stringify(specifier)};`).join('\n') +
      (externals.length ? `\nconst require = name => {${externals.map((specifier, index) => `if (name === ${JSON.stringify(specifier)}) return external${index}.default ?? external${index};`).join('')}throw Error('Unexpected external '+name);};` : '');
    const contents = `import value from ${JSON.stringify(source)};\nexport default value;\nexport const {${names.join(',')}} = value;`;
    const esm = await compiler.build({ ...options, platform: 'browser', format: 'esm', banner: { js: banner },
      stdin: { contents, resolveDir: root }, outfile: resolve(this.#output, `${name}.mjs`) });
    const code = esm.outputFiles[0].text;
    writeFileSync(resolve(this.#output, `${name}.mjs`), code);
    const system = typescript.transpileModule(code, { compilerOptions: {
      target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.System,
      removeComments: false } }).outputText;
    writeFileSync(resolve(this.#output, `${name}.system.js`), system);
    this.#graph(esm, `${name}.esm`);
    this.#records.push({ name, source: relative(root, source), names, formats: ['esm', 'system', 'cjs'],
      adapter: 'Explicit static named facade; external CJS requires bridge to imported namespace; TypeScript System.register conversion.' });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await new ReactBuild().run());
