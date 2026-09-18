# Beyond capability workspace instructions

This directory owns isolated capability probes and adapters for Beyond ESBuild. Read `README.md`, `../docs/requirements.md` and the relevant example guide before extending a case.

- Preserve upstream package identities, MIT license and attribution. Necessary compiler changes to meet the confirmed Beyond cases are authorized; motivate each bounded change with an executable failing case and regression checks. This does not authorize a general rewrite or consumer migration.
- Preserve the distinction between internal source files, public modules and package/version resolution. A conventional bundle belongs to the esbuild packaging mode; creator composition belongs to the unified-runtime mode. Test each mode's HMR separately; see `../docs/execution-modes.md`.
- Use English for first-party documentation and explanatory code. Source files target 300 lines and must not exceed 400. Model stateful responsibilities as classes with private state and simply named members; preserve external API names. Stateless fixture functions are intentional source-language inputs, not a production design pattern.
- Keep tests independent of sibling checkout locations. Select external dependencies explicitly, pin versions and record the resolved files used. Build esbuild from this checkout with `prepare.mjs`.
- Store generated output under ignored `.cache/`; never commit toolchains or dependency installations. Leave working changes uncommitted unless explicitly authorized.
- Record executed checks separately from source observations and proposals. Expected-limitation tests do not establish a fulfilled runtime contract. Include exact source revision, local changes, toolchain and command with results.
