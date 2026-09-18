import { mkdirSync as mkdir, writeFileSync as write } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Cohesive } from './cohesive.mjs';
import { Packaged } from './packaged.mjs';
import { Resolution } from './resolution.mjs';

/**
 * Packages published packages as independently addressable public modules: one artifact per
 * package, version and public subpath, following public references transitively. Every
 * reference is resolved from the importing package, so nested versions stay separate and are
 * expressed as import-map scopes. Versions are read from the installation, never selected.
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
  #cohesion;

  /**
   * `root` holds the installed `node_modules`; `output` receives artifacts, import map and report.
   * `cohesion: false` skips the split build; it exists as the negative control of that pass.
   */
  constructor(toolchain, { root, output, target, cohesion = true }) {
    this.#toolchain = toolchain;
    this.#target = target;
    this.#root = root;
    this.#output = output;
    this.#cohesion = cohesion;
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

    const artifact = { specifier, file, package: name, version, subpath: resolved.subpath,
      source: Resolution.portable(this.#root, resolved.path), references: {} };
    this.#artifacts.set(file, artifact);

    const packaged = await new Packaged(this.#toolchain, { entry: resolved.path, root: this.#root, target: this.#target,
      published: async path => (path === resolved.path ? undefined : this.#resolution.published(path)),
      options: style ? { loader: { '.woff2': 'dataurl', '.svg': 'dataurl' } } : {} }).build().catch(error => {
      this.#artifacts.delete(file);
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
    for (const [specifier, file] of this.#roots) imports[specifier] = prefix + file;
    for (const artifact of this.artifacts) {
      for (const [specifier, reference] of Object.entries(artifact.references)) {
        if (!reference.file) continue;
        if (!(specifier in imports)) imports[specifier] = prefix + reference.file;
        if (imports[specifier] === prefix + reference.file) continue;
        const scope = `${prefix}${artifact.package}@${artifact.version}/`;
        (scopes[scope] ??= {})[specifier] = prefix + reference.file;
      }
    }
    return Object.keys(scopes).length ? { imports, scopes } : { imports };
  }

  /**
   * Artifacts of one package that bundled the same unpublished file would each own a copy of its
   * state. Those packages are compiled again as one split build; a package with CommonJS inputs
   * cannot be split and is reported instead.
   */
  async #cohere() {
    const groups = new Map();
    this.artifacts.filter(artifact => !artifact.file.endsWith('.css')).forEach(artifact => {
      const key = `${artifact.package}@${artifact.version}`;
      groups.set(key, [...(groups.get(key) ?? []), artifact]);
    });
    for (const [key, artifacts] of groups) {
      const counts = new Map();
      artifacts.forEach(artifact => artifact.inputs.forEach(input => counts.set(input, (counts.get(input) ?? 0) + 1)));
      const shared = [...counts].filter(([, count]) => count > 1).map(([input]) => input).sort();
      if (!shared.length) continue;
      if (artifacts.some(artifact => artifact.input === 'cjs' || artifact.adapters.length)) {
        this.#unsupported.push({ package: key, reason: 'duplicated-state', shared,
          detail: 'Subpaths share unpublished CommonJS files; native splitting is ESM only, so each artifact keeps a copy' });
        continue;
      }
      const entries = artifacts.map(artifact => ({ path: artifact.entry, out: artifact.file.slice(key.length + 1, -'.mjs'.length) }));
      const cohesive = await new Cohesive(this.#toolchain, { entries, root: this.#root, target: this.#target,
        published: async path => (entries.some(entry => entry.path === path) ? undefined : this.#resolution.published(path)) }).build();
      cohesive.files.forEach(({ file, text }) => {
        mkdir(dirname(join(this.#output, key, file)), { recursive: true });
        write(join(this.#output, key, file), text);
      });
      artifacts.forEach((artifact, index) => Object.assign(artifact, { splitting: true, shared: shared.length,
        chunks: cohesive.artifacts.get(entries[index].out).chunks, exports: cohesive.artifacts.get(entries[index].out).exports }));
    }
  }

  /** Writes `importmap.json` and `report.json`; returns the report. */
  async finish(extra = {}) {
    if (this.#cohesion) await this.#cohere();
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
