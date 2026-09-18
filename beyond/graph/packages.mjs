import { builtinModules } from 'node:module';

const KERNEL = '@beyond-js/kernel/bundle';

/**
 * Bounded mirror of the dependency validation Beyond Packages applies to an artifact. It
 * selects nothing: the workspace is the explicit set of manifests it is given.
 */
export class Packages {
  #semver;
  #manifests = new Map();

  constructor(semver, manifests) {
    this.#semver = semver;
    for (const manifest of manifests) this.#manifests.set(manifest.name, manifest);
  }

  /** Splits a bare specifier into its workspace package and public subpath. */
  resolve(specifier) {
    const parts = specifier.split('/');
    const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const manifest = this.#manifests.get(name);
    if (!manifest) return undefined;
    const rest = specifier.slice(name.length + 1);
    return { manifest, subpath: rest ? `./${rest}` : '.' };
  }

  /** Classifies public references of a package and reports the ones it cannot satisfy. */
  validate(name, specifiers) {
    const owner = this.#manifests.get(name);
    const resolved = [];
    const errors = [];
    for (const specifier of [...new Set(specifiers)].sort()) {
      if (specifier === KERNEL) { resolved.push({ specifier, source: 'runtime' }); continue; }
      if (specifier.startsWith('node:') || builtinModules.includes(specifier)) {
        resolved.push({ specifier, source: 'builtin' });
        continue;
      }
      const resolution = this.resolve(specifier);
      if (!resolution) { resolved.push({ specifier, source: 'external' }); continue; }
      const { manifest, subpath } = resolution;
      // A package composing its own public modules declares no dependency on itself.
      const own = manifest === owner;
      const range = own ? undefined : this.#range(owner, manifest, specifier, errors);
      if (!own && !range) continue;
      if (!Object.hasOwn(manifest.exports || {}, subpath)) {
        errors.push({ code: 'MODULE_NOT_FOUND', specifier, message: `Package "${owner.name}" imports "${specifier}" ` +
          `but the package "${manifest.name}" does not declare the public module "${subpath}"` });
        continue;
      }
      const path = subpath.replace(/^\.\/?/, '');
      const versioned = `${manifest.name}@${manifest.version}`;
      resolved.push({ specifier, source: 'workspace', vspecifier: path ? `${versioned}/${path}` : versioned,
        package: versioned, range, own });
    }
    return { resolved, errors };
  }

  #range(owner, dependency, specifier, errors) {
    const declared = { ...owner.dependencies, ...owner.peerDependencies, ...owner.devDependencies };
    const range = declared[dependency.name];
    if (typeof range !== 'string') {
      errors.push({ code: 'DEPENDENCY_NOT_DECLARED', specifier, message: `Package "${owner.name}" imports ` +
        `"${specifier}" but does not declare "${dependency.name}" in its package.json dependencies` });
      return undefined;
    }
    const any = range === '*' || range.startsWith('workspace:');
    const { valid, satisfies } = this.#semver;
    if (!any && !(valid(dependency.version) && satisfies(dependency.version, range, { includePrerelease: true }))) {
      errors.push({ code: 'DEPENDENCY_INCOMPATIBLE', specifier, message: `Package "${owner.name}" requires ` +
        `"${dependency.name}@${range}" but the workspace package "${dependency.name}" is version "${dependency.version}"` });
      return undefined;
    }
    return range;
  }
}
