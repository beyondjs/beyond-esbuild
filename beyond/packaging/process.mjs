import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath as filename } from 'node:url';
import { delimiter } from 'node:path';

/** Drives `consumer.mjs` in a separate Node process that resolves only through the given maps. */
export class ConsumerProcess {
  #child;
  #pending = new Map();
  #sequence = 0;

  /** `cwd` is where CommonJS consumers resolve `node_modules`; it holds no Beyond runtime. */
  constructor({ maps = [], cwd, flags = [] }) {
    this.#child = spawn(process.execPath, [...flags, '--import', filename(new URL('./register.mjs', import.meta.url)),
      filename(new URL('./consumer.mjs', import.meta.url))], { cwd, stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, BEYOND_IMPORT_MAPS: maps.join(delimiter) } });
    createInterface({ input: this.#child.stdout }).on('line', line => {
      const { id, value, error } = JSON.parse(line);
      const { resolve, reject } = this.#pending.get(id);
      this.#pending.delete(id);
      error ? reject(Error(error)) : resolve(value);
    });
  }

  #send(op, request) {
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#child.stdin.write(`${JSON.stringify({ id, op, ...request })}\n`);
    });
  }

  load(handle, specifier, format) { return this.#send('load', { handle, specifier, format }); }
  same(handle, other, name) { return this.#send('same', { handle, other, name }); }
  read(handle, name) { return this.#send('read', { handle, name }); }
  call(handle, name, ...args) { return this.#send('call', { handle, name, args }); }

  stop() {
    this.#child.stdin.end();
    return new Promise(resolve => this.#child.once('exit', resolve));
  }
}
