import { builtinModules } from 'node:module';

/**
 * The public boundary of one packaged module. Relative files and package-private `#imports`
 * are compilation inputs and are bundled; every other bare specifier is a public reference
 * that stays in the output as written. Nothing is resolved to a version here.
 */
export class Boundary {
  #references = new Map();
  #inline;
  #published;

  /**
   * `inline` names specifiers an adapter deliberately bundles. `published` answers which public
   * specifier, if any, a file of the entry's package is published as: a relative import of such
   * a file is a reference to that public module, not a second private copy of its state.
   */
  constructor({ inline = [], published } = {}) {
    this.#inline = new Set(inline);
    this.#published = published;
  }

  get name() { return 'beyond-public-boundary'; }

  /** Public references in first-seen order, with every kind and importer that used them. */
  get references() {
    return [...this.#references.values()].map(reference => ({ ...reference,
      kinds: [...reference.kinds].sort(), importers: [...reference.importers].sort() }));
  }

  /** Specifiers reached through `require()`: ESM output needs a bridge for these. */
  get required() {
    return this.references.filter(reference => reference.kinds.includes('require-call'))
      .map(reference => reference.specifier);
  }

  static builtin(specifier) {
    return specifier.startsWith('node:') || builtinModules.includes(specifier);
  }

  // esbuild calls setup detached from the plugin object
  setup = build => {
    build.onResolve({ filter: /^\.\.?\// }, async args => {
      if (!this.#published || args.kind === 'entry-point' || args.pluginData?.boundary) return undefined;
      const resolved = await build.resolve(args.path, { resolveDir: args.resolveDir, kind: args.kind,
        importer: args.importer, pluginData: { boundary: true } });
      const specifier = !resolved.errors.length && await this.#published(resolved.path);
      return specifier ? this.#external(specifier, args, true) : undefined;
    });
    build.onResolve({ filter: /^[^./#]/ }, args => {
      if (args.kind === 'entry-point' || /^[A-Za-z]:[\\/]/.test(args.path)) return undefined;
      if (this.#inline.has(args.path) || args.namespace === 'beyond-inline') return undefined;
      return this.#external(args.path, args, false);
    });
  };

  #external(specifier, args, relative) {
    const reference = this.#references.get(specifier) ??
      { specifier, builtin: Boundary.builtin(specifier), kinds: new Set(), importers: new Set() };
    reference.kinds.add(args.kind);
    reference.importers.add(args.importer);
    if (relative) reference.published = true;
    this.#references.set(specifier, reference);
    return { path: specifier, external: true };
  }
}
