/**
 * Finds the packages whose public modules bundled the same private file.
 *
 * Beyond divides code by public module and nothing else: every artifact bundles the private files its
 * entry reaches. Two public modules of one package that reach the same private file therefore each hold
 * a copy of it, and of any state or identity it defines. Where the shared file is itself published, the
 * boundary already keeps it as a public reference and it never appears here. What remains has no public
 * module to refer to, so the package is reported instead of being divided in a second, private way.
 */
export class SharedFiles {
  #artifacts;

  constructor(artifacts) {
    this.#artifacts = artifacts.filter(artifact => !artifact.file.endsWith('.css'));
  }

  /** `[{ package, artifacts: [file], shared: [input] }]`, one item per package that shares private files. */
  get groups() {
    const packages = new Map();
    this.#artifacts.forEach(artifact => {
      const key = `${artifact.package}@${artifact.version}`;
      packages.set(key, [...(packages.get(key) ?? []), artifact]);
    });

    const groups = [];
    for (const [key, artifacts] of packages) {
      const owners = new Map();
      artifacts.forEach(artifact => artifact.inputs.forEach(input => owners.set(input, [...(owners.get(input) ?? []), artifact.file])));
      const shared = [...owners].filter(([, files]) => files.length > 1);
      if (!shared.length) continue;
      groups.push({ package: key, shared: shared.map(([input]) => input).sort(),
        artifacts: [...new Set(shared.flatMap(([, files]) => files))].sort() });
    }
    return groups;
  }
}
