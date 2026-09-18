import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';

/**
 * A long-lived consumer process. It keeps every namespace it loaded under a handle, so a test
 * can ask an already loaded module again after a rebuild and tell it from a new import.
 */
class Consumer {
  #handles = new Map();
  #require = createRequire(`${process.cwd()}/`);

  async load({ handle, specifier, format = 'esm' }) {
    this.#handles.set(handle, format === 'cjs' ? this.#require(specifier) : await import(specifier));
    return Object.keys(this.#handles.get(handle)).sort();
  }

  same({ handle, other, name }) { return this.#handles.get(handle)[name] === this.#handles.get(other)[name]; }

  read({ handle, name }) { return this.#handles.get(handle)[name]; }

  async call({ handle, name, args = [] }) { return this.#handles.get(handle)[name](...args); }
}

const consumer = new Consumer();
for await (const line of createInterface({ input: process.stdin })) {
  const { id, op, ...request } = JSON.parse(line);
  try {
    const value = await consumer[op](request);
    process.stdout.write(`${JSON.stringify({ id, value })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ id, error: error.stack })}\n`);
  }
}
