import { createRequire as require } from 'node:module';
import { fileURLToPath as filename } from 'node:url';
import { join } from 'node:path';
import { mkdir, readFile as read, writeFile as write } from 'node:fs/promises';
import { Styles } from './styles.mjs';

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
      // The automatic runtime makes the page consume the packaged "react/jsx-runtime" subpath.
      const esm = await api.transform(source, { loader: 'jsx', jsx: 'automatic', format: 'esm', target: 'es2022' });
      await write(join(output, `${name}.mjs`), esm.code);
      const system = ts.transpileModule(esm.code, {
        compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2022 }
      });
      await write(join(output, `${name}.system.js`), system.outputText);
    }
    const styles = new Styles(api, join(this.#root, 'fixtures'), output);
    const failures = await styles.build();
    await styles.dispose();
    if (failures.length) throw new Error(`Module CSS failed: ${JSON.stringify(failures)}`);
    console.log(`Demo compiled with fork ${api.version}; SystemJS envelope adapter TypeScript ${ts.version}`);
  }
}

await new Build().run();
