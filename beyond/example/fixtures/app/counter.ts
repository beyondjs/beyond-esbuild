export class Counter {
  static #value = 0;
  /** Tracks calls across entry patches while this internal module stays loaded. */
  next() { return ++Counter.#value; }
}
