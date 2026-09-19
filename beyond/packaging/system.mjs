import { existsSync } from 'node:fs';
import { cp, readFile as read, readdir, rm, writeFile as write } from 'node:fs/promises';
import { join } from 'node:path';
import { Chain } from '../example/maps.mjs';

/**
 * The existing System.register adapter: TypeScript converts each native ESM artifact of a build, in a
 * parallel tree. It converts module by module and adds none, so the converted tree has the public modules
 * of the native one and each of them declares the dependencies its ES module imported. TypeScript maps the
 * converted code to the artifact it read; that map is chained through the artifact's own map, so the map of
 * a converted module reaches the original sources as the native one does.
 */
export class SystemRegister {
  #typescript;

  constructor(toolchain) {
    this.#typescript = toolchain.typescript;
  }

  /** `{ output, modules: Map(file → [dependency specifier]) }`, with files relative to the converted tree. */
  async convert(build) {
    const output = `${build.output}.system`;
    await rm(output, { recursive: true, force: true });
    await cp(build.output, output, { recursive: true });

    const typescript = this.#typescript;
    const modules = new Map();
    for (const entry of await readdir(output, { recursive: true })) {
      if (!entry.endsWith('.mjs')) continue;
      const mapped = existsSync(join(output, `${entry}.map`));
      const converted = typescript.transpileModule(await read(join(output, entry), 'utf8'), { compilerOptions: {
        target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.System, sourceMap: mapped } });

      const name = entry.split(/[\\/]/).pop();
      const code = converted.outputText.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n');
      if (mapped) {
        const inner = JSON.parse(await read(join(output, `${entry}.map`), 'utf8'));
        await write(join(output, `${entry}.map`), JSON.stringify(new Chain(inner).through(converted.sourceMapText, name)));
      }
      await write(join(output, entry), mapped ? `${code}//# sourceMappingURL=${name}.map\n` : code);

      // What the converted module asks its loader for, read from the registration itself
      const declared = /System\.register\(\s*(\[[^\]]*\])/.exec(converted.outputText);
      modules.set(entry.split('\\').join('/'), declared ? JSON.parse(declared[1]) : []);
    }
    return { output, modules };
  }
}
