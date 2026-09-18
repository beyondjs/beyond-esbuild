/** Emits the actual Bundle/Package creator contract used by Beyond's Kernel. */
export class Assembler {
  #identity;
  #internals;

  constructor(identity, internals) {
    this.#identity = identity;
    this.#internals = internals;
  }

  /** Creates an initial public module or a patch targeting its existing package. */
  emit(patch = false) {
    const quote = JSON.stringify;
    const entry = this.#internals.find(item => item.id === './index');
    const names = entry.exports;
    if (names.some(name => !/^[A-Za-z_$][\w$]*$/.test(name) ||
      ['default', 'hmr', '__beyond_pkg'].includes(name))) {
      throw new Error('Example supports ordinary named entry exports only');
    }
    const dependencies = [...new Set(this.#internals.flatMap(item => item.imports)
      .filter(item => !item.path.startsWith('.')).map(item => item.path))].sort();
    const lines = ["import { Bundle, instances } from '@beyond-js/kernel/bundle';"];
    dependencies.forEach((id, index) => lines.push(`import * as dependency_${index} from ${quote(id)};`));
    lines.push(patch
      ? `const __pkg = instances.get(${quote(this.#identity)}).package();`
      : `const __pkg = new Bundle({module: {vspecifier: ${quote(this.#identity)}}, type: 'ts'}, import.meta.url).package();`);
    lines.push(`__pkg.dependencies.update([${dependencies.map((id, index) =>
      `[${quote(id)}, dependency_${index}]`).join(',')}]);`, 'const ims = new Map();');
    for (const item of this.#internals) {
      lines.push(`ims.set(${quote(item.id)}, {hash: ${item.hash}, creator: function(require, exports) {`,
        item.code, '}});');
    }
    lines.push(`__pkg.exports.descriptor = ${quote(names.map(name => ({ im: './index', from: name, name })))};`);
    if (!patch) {
      lines.push(`export let ${names.join(', ')};`, '__pkg.exports.process = function() {');
      for (const name of names) {
        lines.push(`if (arguments[0].require || arguments[0].prop === ${quote(name)}) ` +
          `${name} = arguments[0].require ? arguments[0].require('./index')[${quote(name)}] : arguments[0].value;`);
      }
      lines.push('};', 'export const __beyond_pkg = __pkg;',
        "export const hmr = {on: (event, listener) => __pkg.hmr.on(event, listener), off: (event, listener) => __pkg.hmr.off(event, listener)};");
    }
    lines.push(`__pkg.${patch ? 'update' : 'initialise'}(ims);`);
    return lines.join('\n') + '\n';
  }
}
