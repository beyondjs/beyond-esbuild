import { mkdtempSync as temporary, mkdirSync as mkdir, writeFileSync as write, readFileSync as read,
  cpSync as copy, rmSync as remove } from 'node:fs';
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

  /**
   * Copy a checked-in source fixture (a file or a directory) into the workspace at `path`, so a
   * test edits only its temporary copy; the checked-in sources are never written.
   */
  copy(source, path = '.') {
    const target = join(this.#root, path);
    copy(source, target, { recursive: true });
    return target;
  }

  /** Current contents of a workspace file, to derive a narrow edit from the copied source. */
  read(path) { return read(join(this.#root, path), 'utf8'); }

  /** Remove one fixture to probe missing-input recovery. */
  delete(path) { remove(join(this.#root, path)); }

  /** Release all temporary files after the owning test completes. */
  destroy() { remove(this.#root, { recursive: true, force: true }); }
}
