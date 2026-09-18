import { createRequire } from 'node:module';
import { fileURLToPath as filename } from 'node:url';
import { join, resolve } from 'node:path';

/** Loads the compiler built from this checkout and the pinned isolated dependencies. */
export class Toolchain {
  static #loaded;
  #cache = filename(new URL('./.cache/', import.meta.url));
  #require = createRequire(import.meta.url);

  /** One shared instance per process; the esbuild service is reused by every fixture. */
  static async load() {
    if (!Toolchain.#loaded) {
      Toolchain.#loaded = new Toolchain();
      await Toolchain.#loaded.lexer.init();
    }
    return Toolchain.#loaded;
  }

  constructor() {
    process.env.ESBUILD_BINARY_PATH = join(this.#cache, process.platform === 'win32' ? 'esbuild.exe' : 'esbuild');
  }

  get cache() { return this.#cache; }
  get dependencies() { return resolve(process.env.BEYOND_DEPENDENCIES || join(this.#cache, 'runtime/node_modules')); }
  /** The pinned third-party packages of the packaging cases; see docs/setup.md. */
  get ecosystem() { return resolve(process.env.BEYOND_ECOSYSTEM || join(this.#cache, 'ecosystem')); }
  get require() { return this.#require; }
  get api() { return this.#require(join(this.#cache, 'api.cjs')); }
  get lexer() { return this.#require(join(this.dependencies, 'cjs-module-lexer')); }
  get semver() { return this.#require(join(this.dependencies, 'semver')); }
  get provenance() { return this.#require(join(this.#cache, 'provenance.json')); }
  get typescript() { return this.#require(join(this.dependencies, 'typescript')); }
  get kernel() { return join(this.dependencies, '@beyond-js/kernel'); }
}
