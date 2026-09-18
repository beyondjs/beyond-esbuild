import { readFile as read } from 'node:fs/promises';
import { createHash as hash } from 'node:crypto';
import { join } from 'node:path';

/** Keeps esbuild transformation separate from Beyond assembly and runtime policy. */
export class Compiler {
  #api;

  constructor(api) { this.#api = api; }

  /** Traverses real files with esbuild, preserving public bare imports as external. */
  async graph(root) {
    const result = await this.#api.build({ absWorkingDir: root, entryPoints: ['index.ts'],
      bundle: true, packages: 'external', format: 'esm', platform: 'neutral',
      write: false, metafile: true, target: 'es2022', logLevel: 'silent' });
    return result.metafile;
  }

  /** Transforms the explicit fixture source list without flattening its internal modules. */
  async compile(root, files) {
    const internals = [];
    for (const file of files) {
      const source = await read(join(root, file), 'utf8');
      // Native ESM metadata supplies public export names that the CJS lexer cannot infer.
      const analysis = await this.#api.build({
        stdin: { contents: source, loader: 'ts', sourcefile: file, resolveDir: root },
        format: 'esm', bundle: false, write: false, metafile: true,
        platform: 'neutral', target: 'es2022', logLevel: 'silent'
      });
      const metadata = Object.values(analysis.metafile.outputs)[0];
      if (/\bexport\s+(?:\*|\{[^}]*\}\s+from)/.test(source)) {
        throw new Error('Re-export composition requires a separate adapter contract');
      }
      const result = await this.#api.transform(source, {
        sourcefile: file, loader: 'ts', format: 'cjs', target: 'es2022'
      });
      // Esbuild writes module.exports with getter descriptors. Kernel needs its existing
      // exports proxy filled with configurable assignment properties instead.
      const code = 'const module = { exports: {} };\n' + result.code +
        '\nfor (const key of Object.keys(module.exports)) exports[key] = module.exports[key];';
      internals.push({
        id: './' + file.replace(/\.ts$/, ''), code, original: result.code,
        hash: hash('sha256').update(code).digest().readUInt32LE(0),
        exports: metadata.exports, imports: metadata.imports
      });
    }
    return internals;
  }
}
