import { readFileSync as read } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** Platform, environment and the export conditions they select, shared by resolving and building. */
export class Target {
  #platform;
  #environment;

  constructor({ platform = 'browser', environment = 'production' } = {}) {
    if (!['browser', 'node'].includes(platform)) throw Error(`Unsupported platform "${platform}"`);
    if (!['production', 'development'].includes(environment)) throw Error(`Unsupported environment "${environment}"`);
    this.#platform = platform;
    this.#environment = environment;
  }

  get platform() { return this.#platform; }
  get environment() { return this.#environment; }
  get key() { return `${this.#platform}.${this.#environment}`; }
  get production() { return this.#environment === 'production'; }

  /** esbuild adds `browser` or `node`, `import`/`require` and `default` itself. */
  get options() {
    return { platform: this.#platform, conditions: ['module', this.#environment],
      mainFields: this.#platform === 'browser' ? ['browser', 'module', 'main'] : ['module', 'main'],
      define: { 'process.env.NODE_ENV': JSON.stringify(this.#environment) } };
  }
}

/**
 * Resolves a public specifier with the compiler's own resolver, so the conditional export
 * that is packaged is the one the compiler would follow, and names the owning package.
 */
export class Resolution {
  #api;
  #target;
  #manifests = new Map();
  #publications = new Map();

  constructor(api, target) {
    this.#api = api;
    this.#target = target;
  }

  /** `{ path, package: { name, version, directory }, subpath }` or a thrown resolution error. */
  async resolve(specifier, from) {
    let resolved;
    await this.#api.build({ ...this.#target.options, stdin: { contents: '', resolveDir: from }, write: false,
      logLevel: 'silent', plugins: [{ name: 'beyond-resolution', setup: build => build.onStart(async () => {
        resolved = await build.resolve(specifier, { resolveDir: from, kind: 'import-statement' });
      }) }] });
    if (resolved.errors.length) throw Error(`Cannot resolve "${specifier}" from ${from}: ${resolved.errors[0].text}`);
    const owner = this.owner(resolved.path);
    const subpath = specifier === owner.name ? '.' : `./${specifier.slice(owner.name.length + 1)}`;
    return { specifier, path: resolved.path, package: owner, subpath: specifier.startsWith(owner.name) ? subpath : undefined };
  }

  /** The nearest manifest with a name: nested `package.json` files that only set `type` are skipped. */
  owner(path) {
    for (let directory = dirname(path); directory !== dirname(directory); directory = dirname(directory)) {
      if (!this.#manifests.has(directory)) {
        let manifest;
        try { manifest = JSON.parse(read(join(directory, 'package.json'), 'utf8')); } catch {}
        this.#manifests.set(directory, manifest);
      }
      const manifest = this.#manifests.get(directory);
      if (manifest?.name && manifest.version) return { name: manifest.name, version: manifest.version, directory, manifest };
    }
    throw Error(`No package owns ${path}`);
  }

  /**
   * The public specifier a file is published as, or undefined. Only packages with an `exports`
   * map have a closed public surface; without one every file is reachable and none is singled
   * out. Explicit keys are resolved with the target's conditions; a pattern key is recognised
   * when the path of the file, used as a subpath, resolves back to the same file.
   */
  async published(path) {
    const owner = this.owner(path);
    const { exports } = owner.manifest;
    if (!exports || typeof exports !== 'object') return undefined;
    if (!this.#publications.has(owner.directory)) {
      const keys = Object.keys(exports).every(key => key.startsWith('.')) ? Object.keys(exports) : ['.'];
      const files = new Map();
      for (const key of keys.filter(key => !key.includes('*'))) {
        const specifier = key === '.' ? owner.name : `${owner.name}/${key.slice(2)}`;
        const resolved = await this.resolve(specifier, owner.directory).catch(() => undefined);
        if (resolved && !files.has(resolved.path)) files.set(resolved.path, specifier);
      }
      this.#publications.set(owner.directory, files);
    }
    const files = this.#publications.get(owner.directory);
    if (files.has(path)) return files.get(path);
    const mirrored = `${owner.name}/${Resolution.portable(owner.directory, path)}`;
    const resolved = await this.resolve(mirrored, owner.directory).catch(() => undefined);
    files.set(path, resolved?.path === path ? mirrored : undefined);
    return files.get(path);
  }

  /** Portable file identity for reports: relative to a base, with forward slashes. */
  static portable(base, path) { return relative(base, path).split(sep).join('/'); }
}
