import { writeFile as write } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL as url } from 'node:url';
import { Chain } from './maps.mjs';

/** Converts the outer module envelope while preserving each internal creator. */
export class Formats {
  #api;
  #typescript;

  constructor(api, typescript) {
    this.#api = api;
    this.#typescript = typescript;
  }

  /** Writes canonical ESM, native esbuild CommonJS and adapted System.register, with maps. */
  async emit(root, name, code, map) {
    await this.#write(root, `${name}.mjs`, code, map && { ...map, file: `${name}.mjs` });
    // CommonJS has no import.meta; the artifact's actual URL supplies Bundle's URI.
    const source = code.replaceAll('import.meta.url', JSON.stringify(url(join(root, `${name}.cjs`)).href));
    // esbuild composes an inline input map, so the CommonJS map reaches the original sources.
    const inline = map ? `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n` : '';
    const cjs = await this.#api.transform(source + inline, { format: 'cjs', target: 'es2022',
      sourcefile: `${name}.mjs`, sourcemap: map ? 'external' : false });
    await this.#write(root, `${name}.cjs`, cjs.code, map && JSON.parse(cjs.map));
    const ts = this.#typescript;
    const system = ts.transpileModule(code, {
      fileName: `${name}.js`, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2022, allowJs: true, sourceMap: Boolean(map) }
    });
    if (system.diagnostics?.length) throw new Error('System.register envelope conversion failed');
    // TypeScript maps to the envelope only; chain it through the envelope map explicitly.
    const text = system.outputText.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n');
    await this.#write(root, `${name}.system.js`, text,
      map && new Chain(map).through(system.sourceMapText, `${name}.system.js`));
  }

  async #write(root, file, code, map) {
    if (!map) return write(join(root, file), code);
    await write(join(root, `${file}.map`), JSON.stringify(map));
    await write(join(root, file), `${code}//# sourceMappingURL=${file}.map\n`);
  }

  /** Exposes the exact adapter version for provenance. */
  get version() { return this.#typescript.version; }
}
