import { writeFile as write } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL as url } from 'node:url';

/** Converts the outer module envelope while preserving each internal creator. */
export class Formats {
  #api;
  #typescript;

  constructor(api, typescript) {
    this.#api = api;
    this.#typescript = typescript;
  }

  /** Writes native esbuild CommonJS, canonical ESM and adapted System.register. */
  async emit(root, name, code) {
    await write(join(root, `${name}.mjs`), code);
    // CommonJS has no import.meta; the artifact's actual URL supplies Bundle's URI.
    const source = code.replaceAll('import.meta.url', JSON.stringify(url(join(root, `${name}.cjs`)).href));
    const cjs = await this.#api.transform(source, { format: 'cjs', target: 'es2022' });
    await write(join(root, `${name}.cjs`), cjs.code);
    const ts = this.#typescript;
    const system = ts.transpileModule(code, {
      fileName: `${name}.js`, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2022, allowJs: true }
    });
    if (system.diagnostics?.length) throw new Error('System.register envelope conversion failed');
    await write(join(root, `${name}.system.js`), system.outputText);
  }

  /** Exposes the exact adapter version for provenance. */
  get version() { return this.#typescript.version; }
}
