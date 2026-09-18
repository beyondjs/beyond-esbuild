import { readFileSync as read, statSync as stat } from 'node:fs';
import { pathToFileURL as url } from 'node:url';

/**
 * Node resolution hook for the packaged artifacts: Node has no import maps, so this applies the
 * ones the builds write, including scopes. `BEYOND_IMPORT_MAPS` lists them, separated by the
 * platform path delimiter; later maps do not override earlier ones. A map is read again when it
 * is rewritten, which is how a development rebuild becomes visible to the next import.
 */
class Maps {
  #files;
  #stamp = '';
  #imports = new Map();
  #scopes = [];

  constructor(files) { this.#files = files; }

  #load() {
    const stamp = this.#files.map(file => stat(file).mtimeMs).join();
    if (stamp === this.#stamp) return;
    this.#stamp = stamp;
    this.#imports.clear();
    this.#scopes = [];
    for (const file of this.#files) {
      const base = url(file);
      const { imports = {}, scopes = {} } = JSON.parse(read(file, 'utf8'));
      for (const [specifier, target] of Object.entries(imports)) {
        if (!this.#imports.has(specifier)) this.#imports.set(specifier, new URL(target, base).href);
      }
      for (const [scope, entries] of Object.entries(scopes)) {
        this.#scopes.push({ prefix: new URL(scope, base).href, entries: new Map(Object.entries(entries)
          .map(([specifier, target]) => [specifier, new URL(target, base).href])) });
      }
    }
  }

  resolve(specifier, parent) {
    this.#load();
    const scope = parent && this.#scopes.find(candidate => parent.startsWith(candidate.prefix) && candidate.entries.has(specifier));
    return scope ? scope.entries.get(specifier) : this.#imports.get(specifier);
  }
}

const maps = new Maps((process.env.BEYOND_IMPORT_MAPS ?? '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean));

export function resolve(specifier, context, next) {
  const mapped = maps.resolve(specifier, context.parentURL);
  return mapped ? { url: mapped, shortCircuit: true } : next(specifier, context);
}
