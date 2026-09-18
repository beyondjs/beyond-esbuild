import { execFileSync as execute } from 'node:child_process';
import { chmodSync as chmod, copyFileSync as copy, mkdirSync as mkdir, readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath as filename } from 'node:url';
import { join, resolve } from 'node:path';

/**
 * Lays the compiler built by `prepare.mjs` out as a self-contained, unpublished package under
 * `beyond/.cache/npm`: the JavaScript API next to the native binary of this platform, found the
 * way the published package finds it. A consumer selects it by path or `file:` URL; nothing is
 * installed into the consumer and no registry identity is claimed.
 */
class CompilerPackage {
  #root = filename(new URL('../', import.meta.url));
  #cache = resolve(this.#root, 'beyond/.cache');

  get #platform() {
    const { platform, arch } = process;
    if (!['darwin', 'linux', 'win32'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
      throw Error(`No platform package layout is defined here for ${platform}-${arch}`);
    }
    return { name: `@esbuild/${platform}-${arch}`, binary: platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild' };
  }

  run() {
    const version = read(resolve(this.#root, 'version.txt'), 'utf8').trim();
    const provenance = JSON.parse(read(join(this.#cache, 'provenance.json'), 'utf8'));
    const built = join(this.#cache, process.platform === 'win32' ? 'esbuild.exe' : 'esbuild');
    const modules = join(this.#cache, 'npm/node_modules');
    const api = join(modules, 'esbuild');
    const native = join(modules, this.#platform.name);

    mkdir(join(api, 'lib'), { recursive: true });
    mkdir(join(native, 'bin'), { recursive: true });
    const target = join(native, this.#platform.binary);
    copy(built, target);
    chmod(target, 0o755);
    write(join(native, 'package.json'), JSON.stringify({ name: this.#platform.name, version, license: 'MIT', private: true }, null, 2));

    // Same bundle as `api.cjs`, without the environment override: the binary is resolved as a sibling package.
    execute(built, ['lib/npm/node.ts', '--bundle', '--platform=node', '--target=node18', '--define:WASM=false',
      `--define:ESBUILD_VERSION=${JSON.stringify(version)}`, '--external:esbuild', `--outfile=${join(api, 'lib/main.js')}`,
      '--log-level=warning'], { cwd: this.#root, stdio: 'inherit' });
    copy(resolve(this.#root, 'lib/shared/types.ts'), join(api, 'lib/main.d.ts'));
    copy(resolve(this.#root, 'LICENSE.md'), join(api, 'LICENSE.md'));
    const digest = createHash('sha256').update(read(target)).digest('hex');
    const fork = { ...provenance, binary: { package: this.#platform.name, sha256: digest },
      capabilities: ['cjsExports'], note: 'Unpublished build of the Beyond ESBuild fork; upstream esbuild is MIT licensed by Evan Wallace.' };
    write(join(api, 'beyond.json'), JSON.stringify(fork, null, 2));
    write(join(api, 'package.json'), JSON.stringify({ name: 'esbuild', version, license: 'MIT', private: true,
      main: 'lib/main.js', types: 'lib/main.d.ts', beyond: './beyond.json' }, null, 2));
    return api;
  }
}

console.log(new CompilerPackage().run());
