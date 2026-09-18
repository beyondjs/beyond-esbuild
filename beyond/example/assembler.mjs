import { posix } from 'node:path';
import { Composition } from './maps.mjs';

const RESERVED = /^(hmr|__beyond_pkg|_default|__pkg|__ims|dependency_\d+)$/;

/** Emits the actual Bundle/Package creator contract used by Beyond's Kernel. */
export class Assembler {
  #identity;
  #internals;
  #entry;
  #exports;

  constructor(identity, internals, entry = './index') {
    this.#identity = identity;
    this.#entry = entry;
    // Ordering by identity keeps the artifact independent of discovery order.
    this.#internals = [...internals].sort((one, another) => (one.id < another.id ? -1 : one.id > another.id ? 1 : 0));
    this.#exports = this.#resolve();
  }

  /** The public API: entry names plus the names of internals it re-exports with a star. */
  get exports() { return this.#exports; }

  /** The bare public specifiers required by any internal module, in a stable order. */
  get dependencies() {
    return [...new Set(this.#internals.flatMap(item => item.imports)
      .filter(item => !item.path.startsWith('.')).map(item => item.path))].sort();
  }

  #resolve() {
    const internals = new Map(this.#internals.map(item => [item.id, item]));
    const names = new Set();
    const visited = new Set();
    const collect = (item, star) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);
      // ES module semantics: a star re-export never contributes "default".
      for (const name of item.exports) if (!star || name !== 'default') names.add(name);
      for (const specifier of item.reexports) {
        const resolved = './' + posix.normalize(posix.join(posix.dirname(item.id), specifier));
        const target = internals.get(resolved) ?? internals.get(`${resolved}/index`);
        if (!target) throw new Error(`Internal module "${item.id}" re-exports "${specifier}", which is not an internal module`);
        collect(target, true);
      }
    };
    collect(internals.get(this.#entry), false);
    const reserved = [...names].filter(name => RESERVED.test(name) || !/^[A-Za-z_$][\w$]*$/.test(name));
    if (reserved.length) throw new Error(`Unsupported public export names: ${reserved.join(', ')}`);
    return [...names].sort();
  }

  /** Creates an initial public module, or a patch targeting its loaded package, with its map. */
  assemble(patch = false) {
    const quote = JSON.stringify;
    const output = new Composition(`${this.#identity}${patch ? '.hmr' : ''}.js`);
    const dependencies = this.dependencies;
    output.add("import { Bundle, instances } from '@beyond-js/kernel/bundle';");
    dependencies.forEach((id, index) => output.add(`import * as dependency_${index} from ${quote(id)};`));
    output.add(patch
      ? `const __pkg = instances.get(${quote(this.#identity)}).package();`
      : `const __pkg = new Bundle({module: {vspecifier: ${quote(this.#identity)}}, type: 'ts'}, import.meta.url).package();`);
    output.add(`__pkg.dependencies.update([${dependencies.map((id, index) =>
      `[${quote(id)}, dependency_${index}]`).join(',')}]);`).add('const __ims = new Map();');
    for (const item of this.#internals) {
      output.add(`__ims.set(${quote(item.id)}, {hash: ${item.hash}, creator: function(require, exports) {`);
      // The creator body starts on its own line, so its map only needs a line offset.
      output.add(item.code.replace(/\n$/, ''), item.map).add('}});');
    }
    output.add(`__pkg.exports.descriptor = ${quote(this.#exports.map(name => ({ im: this.#entry, from: name, name })))};`);
    if (!patch) {
      const named = this.#exports.filter(name => name !== 'default');
      if (named.length) output.add(`export let ${named.join(', ')};`);
      // "default" cannot name a binding; a live alias keeps it assignable by the runtime.
      if (this.#exports.includes('default')) output.add('let _default;\nexport { _default as default };');
      output.add('__pkg.exports.process = function() {');
      for (const name of this.#exports) {
        const binding = name === 'default' ? '_default' : name;
        output.add(`  (arguments[0].require || arguments[0].prop === ${quote(name)}) && (${binding} = arguments[0].require ` +
          `? arguments[0].require(${quote(this.#entry)})[${quote(name)}] : arguments[0].value);`);
      }
      output.add('};').add('export const __beyond_pkg = __pkg;')
        .add('export const hmr = {on: (event, listener) => __pkg.hmr.on(event, listener), off: (event, listener) => __pkg.hmr.off(event, listener)};');
    }
    output.add(`__pkg.${patch ? 'update' : 'initialise'}(__ims);`);
    return { code: output.code, map: output.map };
  }

  /** Code-only form retained for callers that do not publish a map. */
  emit(patch = false) { return this.assemble(patch).code; }
}
