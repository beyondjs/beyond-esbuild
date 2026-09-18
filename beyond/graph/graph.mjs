/** Joins one traversal with package manifests into three graphs that stay separate. */
export class Graph {
  #traversal;
  #packages;
  #owner;
  #module;

  /** The module is the public identity being built, such as "@fixture/app/main". */
  constructor(traversal, packages, owner, module) {
    this.#traversal = traversal;
    this.#packages = packages;
    this.#owner = owner;
    this.#module = module;
  }

  /** Internal source files: direct edges, transitive closure, erased edges and cycles. */
  get files() {
    const nodes = [...this.#traversal.files.values()].map(file => ({ id: file.path,
      direct: file.imports.filter(edge => edge.boundary === 'file')
        .map(({ path, kind, erased }) => ({ to: path, kind, erased })),
      transitive: this.#traversal.transitive(file.path) }));
    return { entry: this.#traversal.entry, nodes, cycles: this.#traversal.cycles };
  }

  /** Public-module edges keep the bare specifier, the importing file and the import kind. */
  get modules() {
    const edges = [];
    for (const file of this.#traversal.files.values()) {
      for (const edge of file.imports.filter(edge => edge.boundary === 'public')) {
        edges.push({ from: this.#module, source: file.path, to: edge.path, kind: edge.kind,
          lazy: edge.kind === 'dynamic-import', erased: edge.erased });
      }
    }
    return { module: this.#module, edges };
  }

  /** Package and version edges come from manifests only, never from file paths. */
  get packages() {
    const runtime = this.modules.edges.filter(edge => !edge.erased).map(edge => edge.to);
    const { resolved, errors } = this.#packages.validate(this.#owner, runtime);
    const edges = [...new Map(resolved.filter(item => item.source === 'workspace' && !item.own)
      .map(item => [item.package, { from: this.#owner, to: item.package, range: item.range }])).values()];
    return { owner: this.#owner, resolved, edges, errors };
  }

  get report() { return { files: this.files, modules: this.modules, packages: this.packages }; }
}
