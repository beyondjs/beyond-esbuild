import { createHash } from 'node:crypto';
import { mkdirSync as mkdir, readFileSync as read, realpathSync as real, writeFileSync as write } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Packaged } from './packaged.mjs';
import { Boundary } from './boundary.mjs';

/**
 * Authored packages in the esbuild packaging mode. A package declares its public modules as
 * `exports` entries that point to source files, the authoring model Packages already reads.
 * Each public module becomes one artifact; nothing in it names an internal file at runtime.
 *
 * In development every artifact is addressed by an identity that covers its own code and the
 * identities of the workspace modules it references. A change therefore gives a new address to
 * the changed module and to every public dependent, which is what lets a consumer that imports
 * again observe it. Delivering that to a running page is not part of this class.
 */
export class Authored {
  #toolchain;
  #target;
  #output;
  #plugins;
  #closure;
  #options;
  #packages = new Map();
  #modules = new Map();

  /** `closure: false` keeps content-only identities; it exists to show why they are not enough. */
  constructor(toolchain, { packages, output, target, plugins = [], closure = true, options = {} }) {
    this.#toolchain = toolchain;
    this.#target = target;
    this.#output = output;
    this.#plugins = plugins;
    this.#closure = closure;
    this.#options = options;
    // The compiler reports real paths, so package directories are compared in that form
    for (const directory of packages.map(path => real(path))) {
      const manifest = JSON.parse(read(join(directory, 'package.json'), 'utf8'));
      this.#packages.set(manifest.name, { directory, manifest });
    }
  }

  get modules() { return [...this.#modules.values()]; }

  /** Compiles every declared public module and writes artifacts, import map and report. */
  async build(format = 'esm') {
    this.#modules.clear();
    const entries = new Map();
    for (const [name, { directory, manifest }] of this.#packages) {
      for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
        if (typeof target !== 'string') continue;
        const specifier = subpath === '.' ? name : `${name}/${subpath.slice(2)}`;
        entries.set(resolve(directory, target), specifier);
        this.#modules.set(specifier, { specifier, package: name, version: manifest.version, subpath,
          entry: resolve(directory, target), directory });
      }
    }
    for (const module of this.#modules.values()) {
      const packaged = await new Packaged(this.#toolchain, { entry: module.entry, root: module.directory, format,
        target: this.#target, plugins: this.#plugins, options: this.#options,
        published: async path => (path === module.entry ? undefined : entries.get(path)) }).build();
      Object.assign(module, { packaged, exports: packaged.exports, stars: packaged.stars, adapters: packaged.adapters,
        files: Object.keys(packaged.inputs), references: packaged.dependencies.map(reference => ({
          specifier: reference.specifier, kinds: reference.kinds, source: this.#source(reference) })) });
    }
    this.#modules.forEach(module => this.#identify(module, new Set()));
    return this.#write(format);
  }

  #source(reference) {
    if (this.#modules.has(reference.specifier)) return 'workspace';
    return reference.builtin || Boundary.builtin(reference.specifier) ? 'builtin' : 'external';
  }

  // The closure identity is order independent and terminates on public cycles.
  #identify(module, visiting) {
    if (module.identity) return module.identity;
    const hash = createHash('sha256').update(module.packaged.code).update(module.packaged.css ?? '');
    if (this.#closure && !visiting.has(module.specifier)) {
      visiting.add(module.specifier);
      module.references.filter(reference => reference.source === 'workspace').map(reference => reference.specifier).sort()
        .forEach(specifier => hash.update(specifier).update(this.#identify(this.#modules.get(specifier), visiting)));
    }
    return (module.identity = hash.digest('hex').slice(0, 12));
  }

  // CommonJS consumers resolve through `node_modules`, so that layout and its manifests are written.
  #write(format) {
    const imports = {};
    const manifests = new Map();
    for (const module of this.#modules.values()) {
      const part = module.subpath === '.' ? 'index' : module.subpath.slice(2);
      const address = this.#target.production ? this.#target.key : `${this.#target.key}.${module.identity}`;
      const base = format === 'esm' ? `${module.package}@${module.version}` : `node_modules/${module.package}`;
      module.file = `${base}/${part}.${address}.${format === 'esm' ? 'mjs' : 'cjs'}`;
      const path = join(this.#output, module.file);
      mkdir(dirname(path), { recursive: true });
      const name = module.file.split('/').pop();
      write(path, `${module.packaged.code}\n//# sourceMappingURL=${name}.map\n`);
      write(`${path}.map`, module.packaged.map);
      if (module.packaged.css) {
        module.style = module.file.replace(/\.[cm]js$/, '.css');
        write(join(this.#output, module.style), module.packaged.css);
      }
      imports[module.specifier] = `./${module.file}`;
      const manifest = manifests.get(base) ?? { name: module.package, version: module.version, exports: {} };
      manifest.exports[module.subpath] = `./${part}.${address}.cjs`;
      manifests.set(base, manifest);
    }
    if (format === 'cjs') manifests.forEach((manifest, base) => write(join(this.#output, base, 'package.json'), JSON.stringify(manifest, null, 2)));
    const report = { compiler: this.#toolchain.api.version, mode: 'esbuild-packaging', format, target: this.#target.key,
      modules: this.modules.map(({ packaged, entry, directory, ...module }) => module) };
    write(join(this.#output, `importmap.${this.#target.key}.json`), JSON.stringify({ imports }, null, 2));
    write(join(this.#output, `report.${this.#target.key}.json`), JSON.stringify(report, null, 2));
    return { imports, report };
  }
}
