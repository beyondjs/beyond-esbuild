import { readFile as read } from 'node:fs/promises';
import { join } from 'node:path';

const LOADERS = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx' };

/** Source-file graph of one public module, traced by esbuild from its entry point. */
export class Traversal {
  #api;
  #root;
  #entry;
  #files = new Map();

  constructor(api, root, entry = 'index.ts') {
    this.#api = api;
    this.#root = root;
    this.#entry = entry;
  }

  /** Files keyed by module-relative path; each holds its direct edges in source order. */
  get files() { return this.#files; }
  get entry() { return this.#entry; }

  /**
   * The bundled pass follows internal files transitively and keeps every bare reference
   * external. Its metafile also lists imports that TypeScript semantics erase because they
   * are unused, flagged "external" with the written specifier, so that flag alone is not a
   * runtime public dependency. Each file is therefore transformed alone as well: only the
   * specifiers that survive there are runtime edges. "import type" reaches neither pass.
   */
  async run() {
    const result = await this.#api.build({ absWorkingDir: this.#root, entryPoints: [this.#entry],
      bundle: true, packages: 'external', format: 'esm', platform: 'neutral', write: false,
      metafile: true, target: 'es2022', logLevel: 'silent' });
    this.#files.clear();
    for (const [path, input] of Object.entries(result.metafile.inputs)) {
      const runtime = await this.#runtime(path);
      this.#files.set(path, { path, imports: input.imports.map(edge => {
        if (!edge.external) return { path: edge.path, kind: edge.kind, boundary: 'file', erased: false };
        return { path: edge.path, kind: edge.kind, boundary: edge.path.startsWith('.') ? 'file' : 'public',
          erased: !runtime.has(`${edge.kind}:${edge.path}`) };
      }) });
    }
    return this;
  }

  async #runtime(path) {
    const loader = LOADERS[path.slice(path.lastIndexOf('.'))];
    if (!loader) return new Set();
    const contents = await read(join(this.#root, path), 'utf8');
    const result = await this.#api.build({ stdin: { contents, loader, sourcefile: path, resolveDir: this.#root },
      bundle: false, write: false, metafile: true, format: 'esm', logLevel: 'silent' });
    return new Set(Object.values(result.metafile.outputs)[0].imports.map(edge => `${edge.kind}:${edge.path}`));
  }

  /** Every internal file reachable from a file through runtime edges, excluding itself. */
  transitive(path) {
    const reached = new Set();
    const queue = [path];
    while (queue.length) {
      for (const edge of this.#files.get(queue.pop())?.imports || []) {
        if (edge.boundary !== 'file' || edge.erased || reached.has(edge.path)) continue;
        reached.add(edge.path);
        queue.push(edge.path);
      }
    }
    reached.delete(path);
    return [...reached].sort();
  }

  /** Runtime cycles between internal files; the Kernel refuses to evaluate them. */
  get cycles() {
    const cycles = [];
    const state = new Map();
    const visit = (path, trail) => {
      state.set(path, 'open');
      for (const edge of this.#files.get(path)?.imports || []) {
        if (edge.boundary !== 'file' || edge.erased || edge.kind === 'dynamic-import') continue;
        if (state.get(edge.path) === 'open') cycles.push([...trail.slice(trail.indexOf(edge.path)), edge.path]);
        else if (!state.has(edge.path)) visit(edge.path, [...trail, edge.path]);
      }
      state.set(path, 'done');
    };
    visit(this.#entry, [this.#entry]);
    return cycles;
  }
}
