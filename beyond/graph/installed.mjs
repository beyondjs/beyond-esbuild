import { builtinModules, createRequire } from 'node:module';
import { readFileSync as read } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Package and version edges of an installed dependency tree, joined from real manifests. */
export class Installed {
  #semver;
  #root;
  #manifests = new Map();

  /** File package records carry sources relative to the root, as the build reports do. */
  constructor(semver, root) {
    this.#semver = semver;
    this.#root = root;
  }

  /**
   * One edge per pair of packages that a traversed file crosses, with the range the
   * importer declares and whether the installed version satisfies it. Nothing is selected
   * here: the versions are the ones the installation already resolved.
   */
  edges(files) {
    const owners = new Map(files.map(file => [file.id, file.package]));
    const edges = new Map();
    for (const file of files.filter(file => file.package?.name)) {
      for (const edge of file.imports) {
        const target = edge.external ? this.#external(file, edge.path) : owners.get(edge.path);
        if (!target?.name || target.name === file.package.name) continue;
        const key = `${file.package.name}@${file.package.version}>${target.name}@${target.version}`;
        if (!edges.has(key)) edges.set(key, this.#edge(file.package, target, edge.external));
      }
    }
    return [...edges.values()].sort((one, another) => (one.from + one.to < another.from + another.to ? -1 : 1));
  }

  #edge(from, to, external) {
    const manifest = this.#manifest(join(this.#root, from.source));
    const fields = ['dependencies', 'peerDependencies', 'optionalDependencies'];
    const field = fields.find(name => typeof manifest[name]?.[to.name] === 'string');
    const range = field ? manifest[field][to.name] : undefined;
    return { from: `${from.name}@${from.version}`, to: `${to.name}@${to.version}`, declared: field, range,
      satisfied: range ? this.#semver.satisfies(to.version, range, { includePrerelease: true }) : false,
      boundary: external ? 'public' : 'bundled' };
  }

  // An external reference was not traversed; its installed manifest is found from the importer.
  #external(file, specifier) {
    if (specifier.startsWith('.') || specifier.startsWith('node:') || builtinModules.includes(specifier)) return undefined;
    const parts = specifier.split('/');
    const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    try {
      const entry = createRequire(resolve(this.#root, file.id)).resolve(`${name}/package.json`);
      const manifest = this.#manifest(dirname(entry));
      return { name: manifest.name, version: manifest.version };
    } catch { return undefined; }
  }

  #manifest(directory) {
    if (!this.#manifests.has(directory)) this.#manifests.set(directory, JSON.parse(read(join(directory, 'package.json'), 'utf8')));
    return this.#manifests.get(directory);
  }
}
