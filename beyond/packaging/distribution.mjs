import { mkdirSync as mkdir, rmSync as remove, writeFileSync as write } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Packaged } from './packaged.mjs';
import { Resolution } from './resolution.mjs';
import { SharedFiles } from './shared.mjs';

/**
 * Packages published packages as independently addressable public modules: one artifact per
 * package, version and public subpath, following public references transitively. Every
 * reference is resolved from the importing package, so nested versions stay separate and are
 * expressed as import-map scopes. Versions are read from the installation, never selected.
 *
 * The public module is the only unit of division. Each artifact is compiled on its own, whoever
 * else is packaged with it, and every reference to another public module stays a bare reference.
 * Public subpaths that resolve to one file are one module with several names, as they are for
 * Node. A package whose public modules share private files cannot be expressed that way: it is
 * reported as unsupported and withdrawn, never divided into private chunks.
 */
export class Distribution {
  #toolchain;
  #target;
  #root;
  #output;
  #resolution;
  #artifacts = new Map();
  #roots = new Map();
  #unsupported = [];
  #entries = new Map();
  #withdrawn = new Set();

  /** `root` holds the installed `node_modules`; `output` receives artifacts, import map and report. */
  constructor(toolchain, { root, output, target }) {
    this.#toolchain = toolchain;
    this.#target = target;
    this.#root = root;
    this.#output = output;
    this.#resolution = new Resolution(toolchain.api, target);
  }

  get artifacts() { return [...this.#artifacts.values()]; }
  get unsupported() { return this.#unsupported; }

  /** Packages a public specifier requested by the application, and everything it references. */
  async add(specifier) {
    const artifact = await this.#module(specifier, this.#root);
    this.#roots.set(specifier, artifact.file);
    return artifact;
  }

  async #module(specifier, from) {
    const resolved = await this.#resolution.resolve(specifier, from);
    const { name, version } = resolved.package;
    const style = resolved.path.endsWith('.css');
    const subpath = resolved.subpath ?? `./${specifier}`;
    const part = subpath === '.' ? 'index' : subpath.slice(2).replace(/\.(m?js|css)$/, '');
    const file = `${name}@${version}/${part}.${this.#target.key}.${style ? 'css' : 'mjs'}`;
    if (this.#artifacts.has(file)) return this.#artifacts.get(file);

    // Another public subpath of this package version already resolved to the same file: one module, two names
    const identity = `${name}@${version}:${resolved.path}`;
    if (this.#entries.has(identity)) {
      const existing = this.#entries.get(identity);
      !existing.names.includes(specifier) && existing.names.push(specifier);
      return existing;
    }

    const artifact = { specifier, names: [specifier], file, package: name, version, subpath: resolved.subpath,
      source: Resolution.portable(this.#root, resolved.path), references: {} };
    this.#artifacts.set(file, artifact);
    this.#entries.set(identity, artifact);

    const packaged = await new Packaged(this.#toolchain, { entry: resolved.path, root: this.#root, target: this.#target,
      published: async path => (path === resolved.path ? undefined : this.#resolution.published(path)),
      options: style ? { loader: { '.woff2': 'dataurl', '.svg': 'dataurl' } } : {} }).build().catch(error => {
      this.#artifacts.delete(file);
      this.#entries.delete(identity);
      throw error;
    });
    Object.assign(artifact, { input: packaged.input, adapters: packaged.adapters, exports: packaged.exports,
      stars: packaged.stars, bytes: packaged.bytes, warnings: packaged.warnings, entry: resolved.path,
      inputs: Object.keys(packaged.inputs).filter(input => !input.includes('beyond:')) });
    this.#write(file, packaged.code, packaged.map);
    if (packaged.css) this.#write(artifact.style = file.replace(/\.mjs$/, '.css'), packaged.css, packaged.cssmap);

    for (const reference of packaged.dependencies) {
      if (reference.builtin) { artifact.references[reference.specifier] = { builtin: true }; continue; }
      try {
        const importer = reference.importers.find(path => path && !path.startsWith('beyond:')) ?? artifact.source;
        const target = await this.#module(reference.specifier, dirname(resolve(this.#root, importer)));
        artifact.references[reference.specifier] = { file: target.file, kinds: reference.kinds,
          ...this.#declared(resolved.package.manifest, target) };
      } catch (error) {
        artifact.references[reference.specifier] = { unresolved: error.message };
        this.#unsupported.push({ artifact: file, specifier: reference.specifier, reason: error.message });
      }
    }
    return artifact;
  }

  #declared(manifest, target) {
    if (manifest.name === target.package) return { declared: 'self' };
    const field = ['dependencies', 'peerDependencies', 'optionalDependencies']
      .find(name => typeof manifest[name]?.[target.package] === 'string');
    const range = field && manifest[field][target.package];
    return { declared: field ?? null, range, satisfied: range
      ? this.#toolchain.semver.satisfies(target.version, range, { includePrerelease: true }) : false };
  }

  #write(file, code, map) {
    const path = join(this.#output, file);
    mkdir(dirname(path), { recursive: true });
    const name = file.split('/').pop();
    const comment = file.endsWith('.css') ? `/*# sourceMappingURL=${name}.map */` : `//# sourceMappingURL=${name}.map`;
    write(path, map ? `${code}\n${comment}\n` : code);
    if (map) write(`${path}.map`, map);
  }

  /**
   * The import map a browser or a loader needs: application-level specifiers at the top, and a
   * scope for every package whose reference resolves to a different artifact than the top one.
   */
  importmap(prefix = './') {
    const imports = {};
    const scopes = {};
    for (const [specifier, file] of this.#roots) !this.#withdrawn.has(file) && (imports[specifier] = prefix + file);
    for (const artifact of this.artifacts) {
      for (const [specifier, reference] of Object.entries(artifact.references)) {
        if (!reference.file || this.#withdrawn.has(reference.file)) continue;
        if (!(specifier in imports)) imports[specifier] = prefix + reference.file;
        if (imports[specifier] === prefix + reference.file) continue;
        const scope = `${prefix}${artifact.package}@${artifact.version}/`;
        (scopes[scope] ??= {})[specifier] = prefix + reference.file;
      }
    }
    return Object.keys(scopes).length ? { imports, scopes } : { imports };
  }

  /**
   * Withdraws the public modules of a package that share private files: their artifacts are removed and
   * left out of the import map, and whoever references them is reported, so nothing loads two copies of
   * one state without being told.
   */
  #withdraw() {
    for (const group of new SharedFiles(this.artifacts).groups) {
      this.#unsupported.push({ ...group, reason: 'shared-private-files',
        detail: 'Public modules of this package bundle the same private files, so each artifact would hold its own copy ' +
          'of their state. No public module publishes those files, and Beyond divides code by public module only.' });
      group.artifacts.forEach(file => {
        this.#withdrawn.add(file);
        [file, `${file}.map`].forEach(name => remove(join(this.#output, name), { force: true }));
        this.#artifacts.get(file).unsupported = 'shared-private-files';
      });
    }
    for (const artifact of this.artifacts) {
      for (const [specifier, reference] of Object.entries(artifact.references)) {
        if (!this.#withdrawn.has(reference.file) || this.#withdrawn.has(artifact.file)) continue;
        this.#unsupported.push({ artifact: artifact.file, specifier, reason: 'references an unsupported module' });
      }
    }
  }

  /** Writes `importmap.json` and `report.json`; returns the report. */
  async finish(extra = {}) {
    this.#withdraw();
    const packages = new Map(this.artifacts.map(artifact => [`${artifact.package}@${artifact.version}`,
      { name: artifact.package, version: artifact.version }]));
    const edges = this.artifacts.flatMap(artifact => Object.entries(artifact.references)
      .filter(([, reference]) => reference.file && reference.declared !== 'self')
      .map(([specifier, reference]) => ({ from: `${artifact.package}@${artifact.version}`, specifier,
        to: reference.file.split('/').slice(0, reference.file.startsWith('@') ? 2 : 1).join('/'),
        declared: reference.declared, range: reference.range, satisfied: reference.satisfied })));
    const report = { compiler: this.#toolchain.api.version, provenance: this.#toolchain.provenance,
      target: this.#target.key, output: 'Native esbuild ESM. Adapters are named per artifact.', ...extra,
      packages: [...packages.values()], packageEdges: edges, unsupported: this.#unsupported,
      artifacts: this.artifacts.map(({ entry, inputs, ...artifact }) => ({ ...artifact, files: inputs.length })) };
    mkdir(this.#output, { recursive: true });
    write(join(this.#output, `importmap.${this.#target.key}.json`), JSON.stringify(this.importmap(), null, 2));
    write(join(this.#output, `report.${this.#target.key}.json`), JSON.stringify(report, null, 2));
    return report;
  }
}
