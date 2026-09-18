import { mkdtempSync as temporary, mkdirSync as mkdir, writeFileSync as write,
  rmSync as remove } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Owns disposable fixture files; no installed consumer or upstream source is edited. */
export class Workspace {
  #root = temporary(join(tmpdir(), 'beyond-esbuild-probe-'));

  /** Absolute fixture directory, used as esbuild's working directory. */
  get root() { return this.#root; }

  /** Write a fixture relative to the workspace and return its absolute path. */
  set(path, contents) {
    const target = join(this.#root, path);
    mkdir(dirname(target), { recursive: true });
    write(target, contents);
    return target;
  }

  /** Remove one fixture to probe missing-input recovery. */
  delete(path) { remove(join(this.#root, path)); }

  /** Release all temporary files after the owning test completes. */
  destroy() { remove(this.#root, { recursive: true, force: true }); }
}
