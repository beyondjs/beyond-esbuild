import { readFileSync as read } from 'node:fs';
import { relative } from 'node:path';

/**
 * Framework source adapter: compiles `.svelte` components with the pinned `svelte/compiler`.
 * The emitted code imports `svelte/internal/client` or `svelte/internal/server` by bare name;
 * component CSS becomes a style output of the public module instead of injected script.
 */
export class SvelteSource {
  #compiler;
  #server;
  #production;
  #styles = new Map();

  constructor(compiler, { server = false, production = true } = {}) {
    this.#compiler = compiler;
    this.#server = server;
    this.#production = production;
  }

  get name() { return 'beyond-svelte-source'; }

  setup = build => {
    const root = build.initialOptions.absWorkingDir ?? process.cwd();
    build.onLoad({ filter: /\.svelte$/ }, args => {
      const filename = relative(root, args.path).split('\\').join('/');
      let compiled;
      try {
        compiled = this.#compiler.compile(read(args.path, 'utf8'), { filename, css: 'external', dev: !this.#production,
          generate: this.#server ? 'server' : 'client' });
      } catch (error) {
        return { errors: [{ text: error.message }] };
      }
      let contents = compiled.js.code;
      if (compiled.css?.code && !this.#server) {
        const key = `${args.path}?style.css`;
        this.#styles.set(key, compiled.css.code);
        contents = `import ${JSON.stringify(key)};\n${contents}`;
      }
      return { contents, loader: 'js', warnings: compiled.warnings.map(warning => ({ text: warning.message })) };
    });
    build.onResolve({ filter: /\.svelte\?style\.css$/ }, args => ({ path: args.path, namespace: 'beyond-svelte-style' }));
    build.onLoad({ filter: /./, namespace: 'beyond-svelte-style' }, args => ({ contents: this.#styles.get(args.path), loader: 'css' }));
  };
}
