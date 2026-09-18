import { createRequire as require } from 'node:module';
import { fileURLToPath as filename } from 'node:url';
import { join } from 'node:path';
import { mkdir, readFile as read, writeFile as write } from 'node:fs/promises';

/** Compiles the visible React consumer and separate CSS artifacts using this fork. */
class Build {
  #root = filename(new URL('./', import.meta.url));
  #cache = filename(new URL('../.cache/', import.meta.url));

  /** Emit browser formats and separately addressable module CSS with input graphs. */
  async run() {
    process.env.ESBUILD_BINARY_PATH = join(this.#cache, process.platform === 'win32' ? 'esbuild.exe' : 'esbuild');
    const api = require(import.meta.url)(join(this.#cache, 'api.cjs'));
    const ts = require(import.meta.url)(join(this.#cache, 'runtime/node_modules/typescript'));
    const output = join(this.#cache, 'demo');
    await mkdir(output, { recursive: true });
    for (const name of ['component', 'config']) {
      const source = await read(join(this.#root, 'fixtures', `${name}.${name === 'component' ? 'jsx' : 'js'}`), 'utf8');
      const esm = await api.transform(source, { loader: 'jsx', format: 'esm', target: 'es2022' });
      await write(join(output, `${name}.mjs`), esm.code);
      const system = ts.transpileModule(esm.code, {
        compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2022 }
      });
      await write(join(output, `${name}.system.js`), system.outputText);
    }
    const graphs = {};
    for (const name of ['app', 'shared']) {
      const result = await api.build({ absWorkingDir: join(this.#root, 'fixtures'),
        entryPoints: [`${name}.css`], bundle: true, write: false, metafile: true,
        outfile: `${name}.css`, sourcemap: 'external' });
      for (const file of result.outputFiles) await write(join(output, file.path.split('/').at(-1)), file.contents);
      graphs[name] = result.metafile;
    }
    await write(join(output, 'styles.graph.json'), JSON.stringify(graphs, null, 2));
    console.log(`Demo compiled with fork ${api.version}; SystemJS envelope adapter TypeScript ${ts.version}`);
  }
}

await new Build().run();
