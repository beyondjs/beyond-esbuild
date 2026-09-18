import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cache = resolve(root, 'beyond/.cache');
process.env.ESBUILD_BINARY_PATH = resolve(cache, 'esbuild');
const require = createRequire(resolve(cache, 'runtime/package.json'));
const compiler = require(resolve(cache, 'api.cjs'));

/** Packages Express for Node; browser emulation is outside its server contract. */
export class ExpressBuild {
  #output = resolve(cache, 'express');

  #package(path) {
    let directory = dirname(resolve(root, path));
    while (directory !== dirname(directory)) {
      try {
        const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
        if (manifest.name) return { name: manifest.name, version: manifest.version,
          source: relative(root, directory) };
      } catch {}
      directory = dirname(directory);
    }
    return null;
  }

  async run() {
    mkdirSync(this.#output, { recursive: true });
    const source = require.resolve('express');
    if (this.#package(source).version !== '5.1.0') throw Error('Expected express@5.1.0');
    const names = Object.keys(require('express')).filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default');
    for (const format of ['cjs', 'esm']) {
      const contents = format === 'cjs' ? `module.exports = require(${JSON.stringify(source)});` :
        `import value from ${JSON.stringify(source)}; export default value; ${names.map((name, index) => `const member${index} = value[${JSON.stringify(name)}]; export {member${index} as ${name}};`).join("\n")}`;
      const result = await compiler.build({ absWorkingDir: root, platform: 'node', format,
        target: 'node22', bundle: true, write: false, metafile: true, logLevel: 'silent',
        define: { 'process.env.NODE_ENV': '"production"' },
        banner: format === 'esm' ? { js: 'import {createRequire} from "node:module"; const require = createRequire(import.meta.url);' } : {},
        stdin: { contents, resolveDir: root }, outfile: resolve(this.#output, format === 'esm' ? 'express.mjs' : 'express.cjs') });
      writeFileSync(result.outputFiles[0].path, result.outputFiles[0].contents);
      const files = Object.entries(result.metafile.inputs).map(([id, input]) => ({ id, package: this.#package(id),
        imports: input.imports.map(edge => ({ ...edge, boundary: edge.external ? 'external' : 'file' })) }));
      const packages = [...new Map(files.filter(file => file.package).map(file => [file.package.name, file.package])).values()];
      const entries = new Map(files.map(file => [file.id, file]));
      const reachable = new Set();
      const externals = new Set();
      const queue = ['<stdin>'];
      while (queue.length) {
        const id = queue.pop();
        if (reachable.has(id) || !entries.has(id)) continue;
        reachable.add(id);
        for (const edge of entries.get(id).imports) {
          if (edge.external) externals.add(edge.path);
          else queue.push(edge.path);
        }
      }
      writeFileSync(resolve(this.#output, `${format}.graph.json`), JSON.stringify({ files, packages,
        traversal: { entry: '<stdin>', files: [...reachable].sort(), external: [...externals].sort() },
        outputs: result.metafile.outputs, warnings: result.warnings,
        note: 'Node builtins remain external. Installed dependency package versions are recorded separately from file edges. Computed view-engine requires are not statically resolved.' }, null, 2));
    }
    writeFileSync(resolve(this.#output, 'report.json'), JSON.stringify({ source: relative(root, source),
      package: this.#package(source), compiler: compiler.version,
      provenance: JSON.parse(readFileSync(resolve(cache, 'provenance.json'))), names,
      formats: ['esm', 'cjs'], applicability: 'Node HTTP server. SystemJS/browser is not a supported Express server target.' }, null, 2));
    return this.#output;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await new ExpressBuild().run());
