import { Boundary } from './boundary.mjs';

/**
 * Several public subpaths of one package compiled together with the compiler's native code
 * splitting. Files the package does not publish but shares between subpaths become private
 * chunks that are evaluated once, instead of one copy of their state per artifact. Splitting is
 * native esbuild output and exists for ESM only.
 */
export class Cohesive {
  #toolchain;
  #entries;
  #root;
  #target;
  #published;

  /** `entries` are `{ path, out }`: the resolved file and its artifact name without extension. */
  constructor(toolchain, { entries, root, target, published }) {
    this.#toolchain = toolchain;
    this.#entries = entries;
    this.#root = root;
    this.#target = target;
    this.#published = published;
  }

  /** `{ files: [{ file, text }], artifacts: Map(out → { exports, references, chunks }) }` */
  async build() {
    const boundary = new Boundary({ published: this.#published });
    const built = await this.#toolchain.api.build({ ...this.#target.options, absWorkingDir: this.#root, bundle: true,
      write: false, metafile: true, format: 'esm', splitting: true, outdir: 'cohesive', sourcemap: 'external',
      sourcesContent: true, minify: this.#target.production, legalComments: 'none', logLevel: 'silent', target: 'es2022',
      entryPoints: this.#entries.map(({ path, out }) => ({ in: path, out })), outExtension: { '.js': '.mjs' },
      chunkNames: 'chunks/[name]-[hash]', plugins: [boundary] });

    const outputs = built.metafile.outputs;
    const artifacts = new Map();
    for (const { out } of this.#entries) {
      const reached = new Set();
      const queue = [`cohesive/${out}.mjs`];
      while (queue.length) {
        const name = queue.pop();
        if (reached.has(name) || !outputs[name]) continue;
        reached.add(name);
        outputs[name].imports.filter(edge => !edge.external).forEach(edge => queue.push(edge.path));
      }
      const external = [...reached].flatMap(name => outputs[name].imports.filter(edge => edge.external).map(edge => edge.path));
      artifacts.set(out, { exports: [...outputs[`cohesive/${out}.mjs`].exports].sort(), references: [...new Set(external)].sort(),
        chunks: [...reached].filter(name => name.includes('/chunks/')).map(name => name.slice('cohesive/'.length)).sort() });
    }
    const files = built.outputFiles.map(output => ({ text: output.text,
      file: output.path.split(/[\\/]cohesive[\\/]/).pop().split('\\').join('/') }));
    return { files, artifacts, references: boundary.references };
  }
}
