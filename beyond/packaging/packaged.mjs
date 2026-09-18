import { readFileSync as read } from 'node:fs';
import { dirname } from 'node:path';
import { Boundary } from './boundary.mjs';
import { Resolution } from './resolution.mjs';

/**
 * One public module in the esbuild packaging mode: its internal files are bundled, its public
 * references stay bare, and the result needs no creator registry or Beyond runtime. ESM and
 * CommonJS are native compiler outputs; the two adapters below are named in the result.
 */
export class Packaged {
  #toolchain;
  #entry;
  #root;
  #target;
  #format;
  #plugins;
  #options;
  #published;

  /**
   * `entry` is an absolute source or published file, `root` anchors portable report paths,
   * `plugins` are framework source adapters and `options` are extra compiler options.
   */
  constructor(toolchain, { entry, root, target, format = 'esm', plugins = [], options = {}, published }) {
    if (!['esm', 'cjs'].includes(format)) throw Error(`Unsupported native format "${format}"`);
    this.#toolchain = toolchain;
    this.#entry = entry;
    this.#root = root;
    this.#target = target;
    this.#format = format;
    this.#plugins = plugins;
    this.#options = options;
    this.#published = published;
  }

  get #style() { return this.#entry.endsWith('.css'); }

  async build() {
    let result = await this.#compile({ entryPoints: [this.#entry] });
    const adapters = [];

    // A CommonJS input has no static ESM names; they are read from its source, as Node does.
    const commonjs = result.inputs[Resolution.portable(this.#root, this.#entry)]?.format === 'cjs';
    if (commonjs && this.#format === 'esm') {
      const names = this.#names(this.#entry, new Set());
      // The `.mjs` importer makes `value` the whole `module.exports`; a transpiled module's own
      // default is then what bundler-era consumers of that package expect to import.
      const contents = `import value from ${JSON.stringify(this.#entry)};\n` +
        `export default value && value.__esModule && 'default' in value ? value.default : value;\n` +
        (names.length ? `export const { ${names.join(', ')} } = value;\n` : '');
      result = await this.#compile({ stdin: { contents, resolveDir: dirname(this.#entry), sourcefile: 'beyond:facade.mjs' } });
      adapters.push('commonjs-names');
    }

    // `export * from './file.cjs'` in an ESM entry has no static names either (Vue's Node entry).
    const starred = !commonjs && this.#format === 'esm' && !this.#style ? this.#starred(result.inputs) : [];
    if (starred.length) {
      const contents = `export * from ${JSON.stringify(this.#entry)};\n` + starred.map(({ file, names }, index) =>
        `import __starred${index} from ${JSON.stringify(file)};\nexport const { ${names.join(', ')} } = __starred${index};\n`).join('');
      result = await this.#compile({ stdin: { contents, resolveDir: dirname(this.#entry), sourcefile: 'beyond:facade.mjs' } });
      adapters.push('commonjs-star-names');
    }

    // ESM output cannot call require(); required public references are bridged to static imports.
    if (this.#format === 'esm' && result.boundary.required.length) {
      result = await this.#compile({ ...result.input, banner: { js: this.#bridge(result.boundary.required) } });
      adapters.push('require-bridge');
    }
    return this.#describe(result, adapters, commonjs);
  }

  async #compile(input) {
    const boundary = new Boundary({ published: this.#published });
    const target = this.#target.options;
    const built = await this.#toolchain.api.build({ ...target, ...this.#options, ...input,
      define: { ...target.define, ...this.#options.define }, absWorkingDir: this.#root, bundle: true, write: false,
      metafile: true, format: this.#format, outfile: this.#style ? 'out.css' : 'out.js', sourcemap: 'external', sourcesContent: true,
      minify: this.#target.production, legalComments: 'none', logLevel: 'silent', target: 'es2022',
      plugins: [boundary, ...this.#plugins] });
    const file = suffix => built.outputFiles.find(output => output.path.endsWith(suffix))?.text;
    return { input, boundary, inputs: built.metafile.inputs, outputs: built.metafile.outputs, warnings: built.warnings,
      code: file(this.#style ? 'out.css' : 'out.js'), map: file(this.#style ? 'out.css.map' : 'out.js.map'),
      css: this.#style ? undefined : file('out.css'), cssmap: this.#style ? undefined : file('out.css.map') };
  }

  // Names assigned on exports. Re-exported requires are followed as Node follows them, including
  // public ones: their names are part of this module's API even though their code stays external.
  #names(file, seen) {
    if (seen.has(file) || !/\.c?js$/.test(file)) return [];
    seen.add(file);
    const { exports, reexports } = this.#toolchain.lexer.parse(read(file, 'utf8'));
    const names = new Set(exports);
    for (const specifier of reexports) {
      let nested;
      try { nested = this.#toolchain.require.resolve(specifier, { paths: [dirname(file)] }); } catch { continue; }
      this.#names(nested, seen).forEach(name => names.add(name));
    }
    return [...names].filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default' && name !== '__esModule').sort();
  }

  // Relative star re-exports of the entry whose target the compiler classified as CommonJS.
  #starred(inputs) {
    const source = read(this.#entry, 'utf8');
    return [...source.matchAll(/export\s*\*\s*from\s*["'](\.[^"']+)["']/g)].map(match => {
      const file = this.#toolchain.require.resolve(match[1], { paths: [dirname(this.#entry)] });
      const names = inputs[Resolution.portable(this.#root, file)]?.format === 'cjs' ? this.#names(file, new Set()) : [];
      return { file, names };
    }).filter(star => star.names.length);
  }

  // A facade whose named exports all live on its default is a CommonJS value: hand back that value.
  // Anything else is an ES module, which a CommonJS caller expects flagged as one.
  #bridge(required) {
    const imports = required.map((specifier, index) => `import * as __required${index} from ${JSON.stringify(specifier)};`);
    const cases = required.map((specifier, index) => `if (id === ${JSON.stringify(specifier)}) return __value(__required${index});`);
    return `${imports.join('\n')}\nconst __value = ns => ('default' in ns && Object.keys(ns).every(key => key === 'default' ` +
      `|| key in Object(ns.default))) ? ns.default : Object.defineProperties({ __esModule: true }, Object.fromEntries(` +
      `Object.keys(ns).map(key => [key, { enumerable: true, get: () => ns[key] }])));\n` +
      `const require = id => { ${cases.join(' ')} throw Error('Public reference "' + id + '" was not declared at build time'); };`;
  }

  #describe(result, adapters, commonjs) {
    const output = result.outputs['out.js'];
    const stars = [...(result.code ?? '').matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)].map(match => match[1]);
    return { format: this.#format, target: this.#target.key, input: commonjs ? 'cjs' : 'esm', adapters,
      code: result.code, map: result.map, css: result.css, cssmap: result.cssmap,
      exports: output ? [...output.exports].sort() : [], stars: [...new Set(stars)].sort(),
      dependencies: result.boundary.references, inputs: result.inputs, bytes: result.code?.length ?? 0,
      warnings: result.warnings.map(warning => warning.text) };
  }
}
