import { readFile as read } from 'node:fs/promises';
import { createHash as hash } from 'node:crypto';
import { join } from 'node:path';

/** Keeps esbuild transformation separate from Beyond assembly and runtime policy. */
export class Compiler {
  #api;
  #lexer;

  /** The lexer is the analyzer Beyond Packages already applies to emitted creators. */
  constructor(api, lexer) {
    this.#api = api;
    this.#lexer = lexer;
  }

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
    for (const file of files) internals.push(await this.internal(file, await read(join(root, file), 'utf8'), root));
    return internals;
  }

  /**
   * Compiles one source into the body of "creator(require, exports)". The fork writes the
   * exports as assignments on that "exports" object, so the body needs no bridge and the
   * lexer reads its names, as it does for the TypeScript output Packages compiles today.
   */
  async internal(file, source, root) {
    const loader = file.endsWith('x') ? 'tsx' : 'ts';
    const result = await this.#api.transform(source, { sourcefile: file, loader, format: 'cjs',
      cjsExports: 'assign', target: 'es2022', sourcemap: 'external', sourcesContent: true });
    // Import kinds come from esbuild metadata; a text scan cannot tell lazy from eager edges.
    const analysis = await this.#api.build({
      stdin: { contents: source, loader, sourcefile: file, resolveDir: root },
      format: 'esm', bundle: false, write: false, metafile: true,
      platform: 'neutral', target: 'es2022', logLevel: 'silent'
    });
    const metadata = Object.values(analysis.metafile.outputs)[0];
    const parsed = this.#lexer.parse(result.code);
    return {
      id: './' + file.replace(/\.tsx?$/, ''), file, code: result.code, map: result.map,
      hash: hash('sha256').update(result.code).digest().readUInt32LE(0),
      exports: parsed.exports.filter(name => name !== '__esModule'),
      reexports: parsed.reexports.filter(path => path.startsWith('.')),
      metadata: metadata.exports, imports: metadata.imports
    };
  }
}
