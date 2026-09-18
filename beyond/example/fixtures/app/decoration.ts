export class Decoration {
  #prefix = '[app]';
  /** Adds the application's private presentation prefix. */
  format(value: string) { return `${this.#prefix} ${value}`; }
}
