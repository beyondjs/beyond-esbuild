import { mkdir, writeFile as write } from 'node:fs/promises';
import { join } from 'node:path';

/** Builds one addressable stylesheet per public module and tracks what each depends on. */
export class Styles {
  #api;
  #root;
  #output;
  #modules;
  #contexts = new Map();
  #graphs = {};

  /** Modules name the entry stylesheets, such as "app" for "app.css", below the root. */
  constructor(api, root, output, modules = ['app', 'shared']) {
    this.#api = api;
    this.#root = root;
    this.#output = output;
    this.#modules = modules;
  }

  /** Input relationships of the last successful build of every module. */
  get graphs() { return this.#graphs; }

  /** Modules whose last successful build read the file: the ones a change invalidates. */
  affected(file) {
    return this.#modules.filter(name => Object.hasOwn(this.#graphs[name]?.inputs || {}, file));
  }

  /**
   * Rebuilds the named modules. An artifact is only replaced by a successful build, so a
   * failure leaves the last good stylesheet addressable and is reported to the caller.
   */
  async build(names = this.#modules) {
    await mkdir(this.#output, { recursive: true });
    const failures = [];
    for (const name of names) {
      try {
        const result = await (await this.#context(name)).rebuild();
        for (const file of result.outputFiles) await write(join(this.#output, file.path.split(/[\\/]/).at(-1)), file.contents);
        this.#graphs[name] = result.metafile;
      } catch (error) {
        failures.push({ module: name, errors: error.errors?.map(item => item.text) || [error.message] });
      }
    }
    await write(join(this.#output, 'styles.graph.json'), JSON.stringify(this.#graphs, null, 2));
    return failures;
  }

  async #context(name) {
    if (!this.#contexts.has(name)) {
      this.#contexts.set(name, await this.#api.context({ absWorkingDir: this.#root,
        entryPoints: [`${name}.css`], bundle: true, write: false, metafile: true,
        outfile: `${name}.css`, sourcemap: 'external', logLevel: 'silent' }));
    }
    return this.#contexts.get(name);
  }

  /** Release the incremental compiler contexts. */
  async dispose() {
    for (const context of this.#contexts.values()) await context.dispose();
    this.#contexts.clear();
  }
}
