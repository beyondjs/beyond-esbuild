import { execFileSync as execute } from 'node:child_process';
import { mkdirSync as mkdir, readFileSync as read, writeFileSync as write } from 'node:fs';
import { fileURLToPath as filename } from 'node:url';
import { resolve } from 'node:path';

/** Builds the checked-out compiler and JS API without modifying upstream files. */
class Preparation {
  #root = filename(new URL('../', import.meta.url));
  #cache = resolve(this.#root, 'beyond/.cache');

  /** Regenerate both artifacts from source; GO may select an explicit toolchain. */
  run() {
    mkdir(this.#cache, { recursive: true });
    const binary = resolve(this.#cache, process.platform === 'win32' ? 'esbuild.exe' : 'esbuild');
    execute(process.env.GO || 'go', ['build', '-o', binary, './cmd/esbuild'], {
      cwd: this.#root, stdio: 'inherit'
    });
    const version = read(resolve(this.#root, 'version.txt'), 'utf8').trim();
    execute(binary, ['lib/npm/node.ts', '--bundle', '--platform=node', '--target=node18',
      '--define:WASM=false', `--define:ESBUILD_VERSION=${JSON.stringify(version)}`,
      '--external:esbuild', `--outfile=${resolve(this.#cache, 'api.cjs')}`], {
      cwd: this.#root, stdio: 'inherit'
    });
    const revision = execute('git', ['rev-parse', 'HEAD'], { cwd: this.#root, encoding: 'utf8' }).trim();
    write(resolve(this.#cache, 'provenance.json'), JSON.stringify({ revision, version,
      node: process.version, go: execute(process.env.GO || 'go', ['version'], { encoding: 'utf8' }).trim()
    }, null, 2) + '\n');
  }
}

new Preparation().run();
