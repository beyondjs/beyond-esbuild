import { createHash } from 'node:crypto';
import { readFileSync as read } from 'node:fs';
import { relative } from 'node:path';

/**
 * Framework source adapter: compiles `.vue` single-file components with the pinned
 * `@vue/compiler-sfc`. esbuild has no Vue support; published Vue JavaScript needs no adapter.
 * The emitted code imports `vue` by its bare name, so the runtime stays a public reference.
 */
export class VueSource {
  #compiler;
  #server;
  #production;
  #styles = new Map();

  constructor(compiler, { server = false, production = true } = {}) {
    this.#compiler = compiler;
    this.#server = server;
    this.#production = production;
  }

  get name() { return 'beyond-vue-source'; }

  setup = build => {
    const root = build.initialOptions.absWorkingDir ?? process.cwd();
    build.onLoad({ filter: /\.vue$/ }, args => {
      const source = read(args.path, 'utf8');
      const filename = relative(root, args.path).split('\\').join('/');
      const id = createHash('sha256').update(filename).digest('hex').slice(0, 8);
      const { descriptor, errors } = this.#compiler.parse(source, { filename });
      if (errors.length) return { errors: errors.map(error => ({ text: error.message })) };
      const scoped = descriptor.styles.some(style => style.scoped);
      const script = this.#compiler.compileScript(descriptor, { id, inlineTemplate: true, isProd: this.#production,
        templateOptions: { ssr: this.#server, ssrCssVars: [], scoped, compilerOptions: { scopeId: scoped ? `data-v-${id}` : undefined } } });
      let contents = script.content.replace('export default ', 'const __component = ');
      if (scoped) contents += `\n__component.__scopeId = "data-v-${id}";`;
      descriptor.styles.forEach((style, index) => {
        const compiled = this.#compiler.compileStyle({ source: style.content, filename, id: `data-v-${id}`, scoped: style.scoped, isProd: this.#production });
        const key = `${args.path}?style=${index}.css`;
        this.#styles.set(key, compiled.code);
        if (!this.#server) contents = `import ${JSON.stringify(key)};\n${contents}`;
      });
      return { contents: `${contents}\nexport default __component;\n`, loader: script.lang === 'ts' ? 'ts' : 'js' };
    });
    build.onResolve({ filter: /\.vue\?style=\d+\.css$/ }, args => ({ path: args.path, namespace: 'beyond-vue-style' }));
    build.onLoad({ filter: /./, namespace: 'beyond-vue-style' }, args => ({ contents: this.#styles.get(args.path), loader: 'css' }));
  };
}
