const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes and encodes the "mappings" field of a version 3 source map. */
class Mappings {
  /** Returns one array per generated line; a segment is [column, source, line, column, name?]. */
  static decode(text) {
    const lines = [];
    const state = [0, 0, 0, 0, 0];
    for (const line of text.split(';')) {
      const segments = [];
      state[0] = 0;
      for (const encoded of line ? line.split(',') : []) {
        const fields = Mappings.#fields(encoded);
        const segment = fields.map((field, index) => (state[index] += field));
        segments.push(segment);
      }
      lines.push(segments);
    }
    return lines;
  }

  /** Inverse of decode; segments of a line must be ordered by generated column. */
  static encode(lines) {
    const state = [0, 0, 0, 0, 0];
    return lines.map(segments => {
      state[0] = 0;
      return segments.map(segment => segment.map((value, index) => {
        const field = Mappings.#field(value - state[index]);
        state[index] = value;
        return field;
      }).join('')).join(',');
    }).join(';');
  }

  static #fields(encoded) {
    const fields = [];
    let shift = 0, value = 0;
    for (const character of encoded) {
      const digit = ALPHABET.indexOf(character);
      value += (digit & 31) << shift;
      if (digit & 32) { shift += 5; continue; }
      fields.push(value & 1 ? -(value >> 1) : value >> 1);
      shift = value = 0;
    }
    return fields;
  }

  static #field(value) {
    let rest = value < 0 ? (-value << 1) | 1 : value << 1, text = '';
    do {
      const digit = rest & 31;
      rest >>>= 5;
      text += ALPHABET[rest ? digit | 32 : digit];
    } while (rest);
    return text;
  }
}

/** Resolves a generated position of one map to its original source position. */
export class Lookup {
  #map;
  #lines;

  constructor(map) {
    this.#map = typeof map === 'string' ? JSON.parse(map) : map;
    this.#lines = Mappings.decode(this.#map.mappings);
  }

  get map() { return this.#map; }
  get lines() { return this.#lines; }

  /** Lines and columns are zero-based, as they are stored in the map. */
  original(line, column) {
    const segments = (this.#lines[line] || []).filter(segment => segment.length >= 4);
    let found;
    for (const segment of segments) if (segment[0] <= column) found = segment;
    if (!found) return undefined;
    return { source: this.#map.sources[found[1]], line: found[2], column: found[3],
      name: found.length === 5 ? this.#map.names[found[4]] : undefined };
  }
}

/** Concatenates code fragments, keeping the map of every fragment that has one. */
export class Composition {
  #file;
  #code = [];
  #lines = [];
  #sources = [];
  #contents = [];
  #names = [];

  constructor(file) { this.#file = file; }

  /** Appends whole lines; a fragment map is shifted to the fragment's first line. */
  add(code, map) {
    const count = code.split('\n').length;
    this.#code.push(code);
    const decoded = map ? new Lookup(map) : undefined;
    for (let index = 0; index < count; index++) {
      const segments = decoded?.lines[index] || [];
      this.#lines.push(segments.filter(segment => segment.length >= 4).map(segment => {
        const result = [segment[0], this.#source(decoded.map, segment[1]), segment[2], segment[3]];
        if (segment.length === 5) result.push(this.#name(decoded.map.names[segment[4]]));
        return result;
      }));
    }
    return this;
  }

  get code() { return this.#code.join('\n') + '\n'; }

  get map() {
    return { version: 3, file: this.#file, sources: this.#sources, sourcesContent: this.#contents,
      names: this.#names, mappings: Mappings.encode(this.#lines) };
  }

  #source(map, index) {
    const source = map.sources[index];
    let position = this.#sources.indexOf(source);
    if (position < 0) {
      position = this.#sources.push(source) - 1;
      this.#contents.push(map.sourcesContent?.[index] ?? null);
    }
    return position;
  }

  #name(name) {
    const position = this.#names.indexOf(name);
    return position < 0 ? this.#names.push(name) - 1 : position;
  }
}

/** Composes a map of converted code with the map of the code it was converted from. */
export class Chain {
  #inner;

  /** The inner map describes the intermediate code that a later conversion consumed. */
  constructor(inner) { this.#inner = new Lookup(inner); }

  /** Returns a map from the converted code directly to the original sources. */
  through(outer, file) {
    const converted = new Lookup(outer);
    const sources = [...this.#inner.map.sources];
    const names = [];
    const lines = converted.lines.map(segments => {
      const result = [];
      for (const segment of segments) {
        if (segment.length < 4) continue;
        const original = this.#inner.original(segment[2], segment[3]);
        if (!original) continue;
        const mapped = [segment[0], sources.indexOf(original.source), original.line, original.column];
        if (original.name !== undefined) {
          let position = names.indexOf(original.name);
          if (position < 0) position = names.push(original.name) - 1;
          mapped.push(position);
        }
        result.push(mapped);
      }
      return result;
    });
    return { version: 3, file, sources, sourcesContent: this.#inner.map.sourcesContent,
      names, mappings: Mappings.encode(lines) };
  }
}
