import assert from 'node:assert/strict';
import { createRequire as require } from 'node:module';
import { fileURLToPath as filename, pathToFileURL as url } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdir, readFile as read, writeFile as write, cp, rm } from 'node:fs/promises';
import { createHash as hash } from 'node:crypto';
import { Compiler } from './compiler.mjs';
import { Assembler } from './assembler.mjs';
import { Formats } from './formats.mjs';

/** Builds inspectable artifacts and verifies them against the actual installed Kernel. */
class Example {
  #root = filename(new URL('./', import.meta.url));
  #cache = filename(new URL('../.cache/', import.meta.url));
  #output = join(this.#cache, 'example');
  #compiler;
  #lexer;
  #runtime;
  #formats;
  #graph;

  /** Executes the bounded vertical fixture and retains generated output for inspection. */
  async run() {
    process.env.ESBUILD_BINARY_PATH = join(this.#cache, process.platform === 'win32' ? 'esbuild.exe' : 'esbuild');
    const api = require(import.meta.url)(join(this.#cache, 'api.cjs'));
    this.#compiler = new Compiler(api);
    const dependencies = resolve(process.env.BEYOND_DEPENDENCIES || join(this.#cache, 'runtime/node_modules'));
    this.#formats = new Formats(api, require(import.meta.url)(join(dependencies, 'typescript')));
    this.#lexer = require(import.meta.url)(join(dependencies, 'cjs-module-lexer'));
    await this.#lexer.init();
    this.#runtime = join(dependencies, '@beyond-js/kernel');
    const manifest = JSON.parse(await read(join(this.#runtime, 'package.json'), 'utf8'));
    assert.equal(manifest.version, '0.1.12', 'This compatibility probe pins the real Kernel 0.1.12');
    await mkdir(this.#output, { recursive: true });
    await cp(join(this.#root, 'fixtures'), join(this.#output, 'sources'), { recursive: true });
    await mkdir(join(this.#output, 'node_modules/@beyond-js'), { recursive: true });
    const link = join(this.#output, 'node_modules/@beyond-js/kernel');
    await rm(link, { recursive: true, force: true });
    await cp(this.#runtime, link, { recursive: true });
    const shared = await this.#compiler.compile(join(this.#output, 'sources/shared'), ['index.ts']);
    await this.#package('shared', 'message', new Assembler('@fixture/shared@1.0.0/message', shared).emit());
    const initial = await this.#build();
    this.#graph = await this.#compiler.graph(join(this.#output, 'sources/app'));
    assert.deepEqual(Object.keys(this.#graph.inputs).sort(), ['counter.ts', 'decoration.ts', 'format.ts', 'index.ts']);
    assert.ok(this.#graph.inputs['index.ts'].imports.some(edge => edge.path === 'format.ts'));
    assert.ok(this.#graph.inputs['format.ts'].imports.some(edge => edge.path === 'decoration.ts'),
      'Native esbuild traversal follows transitive internal relationships');
    assert.ok(this.#graph.inputs['index.ts'].imports.some(edge => edge.path === '@fixture/shared/message' && edge.external));
    assert.deepEqual(initial[0].imports.filter(edge => edge.path.startsWith('.')).map(edge => edge.path).sort(),
      ['./counter', './format'], 'Relative relationships remain internal-source edges');
    assert.deepEqual(initial[0].imports.filter(edge => !edge.path.startsWith('.')).map(edge => edge.path),
      ['@fixture/shared/message'], 'Public dependency stays separate from internal-source edges');
    assert.deepEqual((await this.#build()).map(item => item.hash), initial.map(item => item.hash),
      'Repeated unchanged compilation produces stable hashes');
    const emitted = new Assembler('@fixture/app@1.0.0/main', initial).emit();
    await this.#package('app', 'main', emitted);
    assert.match(emitted, /import \* as dependency_0 from "@fixture\/shared\/message"/);
    assert.equal((emitted.match(/creator: function\(require, exports\)/g) || []).length, 4);
    assert.equal(emitted.includes('Hello Beyond'), false, 'Shared implementation is not flattened into app');
    await write(join(this.#output, 'consumer.mjs'),
      "import { main, answer, runs, __beyond_pkg } from '@fixture/app/main';\n" +
      'export const read = () => ({text: main(), answer, runs, package: __beyond_pkg});\n');
    const consumer = await import(url(join(this.#output, 'consumer.mjs')));
    const before = consumer.read();
    assert.equal(before.text, '[app] Hello Beyond');
    assert.equal(before.answer, 42);
    assert.equal(before.runs, 1);
    const cjs = require(join(this.#output, 'consumer.cjs'))('@fixture/app/main');
    assert.equal(cjs.main(), before.text, 'Actual Node require executes CommonJS creators');
    assert.equal(cjs.answer, 42);
    assert.equal(cjs.runs, 1);
    const identity = cjs.__beyond_pkg;
    const app = await import(url(join(this.#output, 'node_modules/@fixture/app/main.mjs')));
    assert.deepEqual(Object.keys(app).sort(), ['__beyond_pkg', 'answer', 'hmr', 'main', 'runs']);
    assert.deepEqual(this.#lexer.parse(initial[0].original).exports, [],
      'Current esbuild helper-based exports are not recognized by cjs-module-lexer');
    const entry = join(this.#output, 'sources/app/index.ts');
    await write(entry, (await read(entry, 'utf8')).replace('answer = 42', 'answer = 43'));
    const changed = await this.#build();
    assert.notEqual(initial[0].hash, changed[0].hash);
    assert.deepEqual(initial.slice(1).map(item => item.hash), changed.slice(1).map(item => item.hash));
    await this.#formats.emit(this.#output, 'patch', new Assembler('@fixture/app@1.0.0/main', changed).emit(true));
    await import(url(join(this.#output, 'patch.mjs')));
    assert.equal(consumer.read().answer, 43, 'Original consumer receives updated live public binding');
    assert.equal(consumer.read().package, before.package, 'Runtime package identity is retained');
    assert.equal(consumer.read().text, before.text);
    assert.equal(consumer.read().runs, 2, 'Unchanged counter creator retains its static state');
    require(import.meta.url)(join(this.#output, 'patch.cjs'));
    assert.equal(cjs.answer, 43, 'Original CommonJS namespace observes the patch');
    assert.equal(cjs.runs, 2);
    assert.equal(cjs.__beyond_pkg, identity);
    await this.#findings(initial, api.version, dependencies);
    console.log('PASS: CJS + ESM creator composition, native graph traversal, real Kernel execution, live patches; System.register emitted');
    console.log(`Artifacts: ${this.#output}`);
  }

  #build() {
    return this.#compiler.compile(join(this.#output, 'sources/app'), ['index.ts', 'format.ts', 'counter.ts', 'decoration.ts']);
  }

  async #package(name, subpath, code) {
    const root = join(this.#output, `node_modules/@fixture/${name}`);
    await mkdir(root, { recursive: true });
    await write(join(root, 'package.json'), JSON.stringify({ name: `@fixture/${name}`, version: '1.0.0',
      type: 'module', exports: { [`./${subpath}`]: { import: `./${subpath}.mjs`, require: `./${subpath}.cjs` } },
      ...(name === 'app' ? { dependencies: { '@fixture/shared': '1.0.0' } } : {}) }, null, 2));
    await this.#formats.emit(root, subpath, code);
  }

  async #findings(internals, version, dependencies) {
    const binary = await read(join(this.#runtime, 'bundle/bundle.mjs'));
    const lexer = JSON.parse(await read(join(dependencies, 'cjs-module-lexer/package.json'), 'utf8'));
    await write(join(this.#output, 'report.json'), JSON.stringify({
      esbuild: version, kernel: '0.1.12', kernelPath: this.#runtime,
      kernelSha256: hash('sha256').update(binary).digest('hex'), lexer: lexer.version,
      adapters: { commonjs: 'esbuild transform of composed envelope', systemjs: `TypeScript ${this.#formats.version} System.register` },
      traversal: this.#graph,
      emittedMetadata: internals.map(({ id, exports, imports, hash }) => ({ id, exports, imports, hash })),
      internalEdges: Object.entries(this.#graph.inputs).flatMap(([file, input]) => input.imports.filter(edge => !edge.external)
        .map(edge => ({ from: './' + file.replace(/\.ts$/, ''), to: './' + edge.path.replace(/\.ts$/, ''), kind: edge.kind }))),
      publicEdges: Object.entries(this.#graph.inputs).flatMap(([file, input]) => input.imports.filter(edge => edge.external)
        .map(edge => ({ from: '@fixture/app/main', source: './' + file.replace(/\.ts$/, ''), to: edge.path, kind: edge.kind }))),
      packageEdges: [{ from: '@fixture/app@1.0.0', to: '@fixture/shared@1.0.0',
        evidence: 'Fixture package manifests; no general version solver is implemented' }],
      lexerExports: this.#lexer.parse(internals[0].original).exports,
      metadataExports: internals[0].exports,
      checks: ['four creators', 'bare shared reference', 'entry-only exports', 'real Kernel execution',
        'same package identity after patch', 'original consumer live binding', 'unchanged internal hashes',
        'unchanged internal static state retained', 'deterministic repeated hashes',
        'internal edges separated from bare public dependency', 'native transitive esbuild file traversal',
        'actual Node CommonJS require', 'CommonJS live patch with retained identity'],
      systemjs: 'Emitted for browser integration; this runner alone does not execute a browser'
    }, null, 2) + '\n');
  }
}

await new Example().run();
