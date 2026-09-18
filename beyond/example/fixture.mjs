import { createRequire } from 'node:module';
import { pathToFileURL as url } from 'node:url';
import { join } from 'node:path';
import { mkdirSync as mkdir, symlinkSync as link, writeFileSync as write } from 'node:fs';
import { Workspace } from '../workspace.mjs';
import { Toolchain } from '../toolchain.mjs';
import { Compiler } from './compiler.mjs';
import { Assembler } from './assembler.mjs';
import { Formats } from './formats.mjs';

/** Builds one disposable Beyond public module and applies updates to its loaded package. */
export class Fixture {
  static #count = 0;
  #workspace = new Workspace();
  #name = `case${++Fixture.#count}`;
  #sources;
  #toolchain;
  #patches = 0;

  /** Sources map internal file names, such as "index.ts", to their contents. */
  constructor(sources) { this.#sources = new Map(Object.entries(sources)); }

  get root() { return this.#workspace.root; }
  get package() { return join(this.root, `node_modules/@fixture/${this.#name}`); }
  get identity() { return `@fixture/${this.#name}@1.0.0/main`; }
  get specifier() { return `@fixture/${this.#name}/main`; }

  /** Compiles every internal module with the fork and assembles the public module. */
  async assembler() {
    this.#toolchain = await Toolchain.load();
    const compiler = new Compiler(this.#toolchain.api, this.#toolchain.lexer);
    const internals = [];
    for (const [file, source] of this.#sources) internals.push(await compiler.internal(file, source, this.root));
    return new Assembler(this.identity, internals);
  }

  /** Writes the package in every format next to the actual Kernel. */
  async build() {
    const { code, map } = (await this.assembler()).assemble();
    mkdir(join(this.root, 'node_modules/@beyond-js'), { recursive: true });
    link(this.#toolchain.kernel, join(this.root, 'node_modules/@beyond-js/kernel'), 'dir');
    mkdir(this.package, { recursive: true });
    write(join(this.package, 'package.json'), JSON.stringify({ name: `@fixture/${this.#name}`, version: '1.0.0',
      type: 'module', exports: { './main': { import: './main.mjs', require: './main.cjs' } } }));
    await this.#formats.emit(this.package, 'main', code, map);
    return this;
  }

  /** The ES module namespace is live, so tests observe later runtime assignments through it. */
  import() { return import(url(join(this.package, 'main.mjs')).href); }

  require() { return createRequire(join(this.root, 'consumer.cjs'))(this.specifier); }

  /** Replaces, adds or removes (null) sources, then applies the update in both module systems. */
  async patch(changes) {
    for (const [file, source] of Object.entries(changes)) {
      source === null ? this.#sources.delete(file) : this.#sources.set(file, source);
    }
    const { code, map } = (await this.assembler()).assemble(true);
    const name = `patch${++this.#patches}`;
    await this.#formats.emit(this.package, name, code, map);
    return { esm: () => import(url(join(this.package, `${name}.mjs`)).href),
      cjs: () => createRequire(join(this.root, 'consumer.cjs'))(join(this.package, `${name}.cjs`)) };
  }

  destroy() { this.#workspace.destroy(); }

  get #formats() { return new Formats(this.#toolchain.api, this.#toolchain.typescript); }
}
