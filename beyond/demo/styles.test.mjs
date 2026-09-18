import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync as read } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '../workspace.mjs';
import { Toolchain } from '../toolchain.mjs';
import { Styles } from './styles.mjs';

const { api } = await Toolchain.load();

test('Y1: a stylesheet dependency invalidates only the modules that read it, and failures keep the last artifact', async t => {
  const workspace = new Workspace();
  const output = join(workspace.root, 'out');
  const styles = new Styles(api, workspace.root, output);
  t.after(async () => { await styles.dispose(); workspace.destroy(); });
  workspace.set('app.css', "@import './palette.css';\n.probe { color: var(--module-accent); }\n");
  workspace.set('palette.css', ':host { --module-accent: #245b75; }\n');
  workspace.set('shared.css', '.probe { color: #b65324; }\n');
  assert.deepEqual(await styles.build(), []);
  const initial = { app: read(join(output, 'app.css'), 'utf8'), shared: read(join(output, 'shared.css'), 'utf8') };
  assert.match(initial.app, /#245b75/, 'The imported palette is part of the app module artifact');
  assert.equal(initial.shared.includes('module-accent'), false, 'Module stylesheets stay independent artifacts');

  workspace.set('palette.css', ':host { --module-accent: #7a1f5c; }\n');
  assert.deepEqual(styles.affected('palette.css'), ['app'], 'Only the importing module is invalidated');
  assert.deepEqual(styles.affected('shared.css'), ['shared']);
  assert.deepEqual(await styles.build(styles.affected('palette.css')), []);
  assert.match(read(join(output, 'app.css'), 'utf8'), /#7a1f5c/);
  assert.equal(read(join(output, 'shared.css'), 'utf8'), initial.shared);

  workspace.set('app.css', "@import './missing.css';\n.probe { color: red; }\n");
  const failures = await styles.build(styles.affected('app.css'));
  assert.equal(failures.length, 1);
  assert.match(failures[0].errors.join('\n'), /missing\.css/);
  assert.match(read(join(output, 'app.css'), 'utf8'), /#7a1f5c/, 'The last good artifact is still served');
  assert.deepEqual(styles.affected('palette.css'), ['app'], 'The last good graph still drives invalidation');

  workspace.set('app.css', "@import './palette.css';\n.probe { color: var(--module-accent); font-weight: 700; }\n");
  assert.deepEqual(await styles.build(['app']), []);
  assert.match(read(join(output, 'app.css'), 'utf8'), /font-weight: 700/, 'A corrected source recovers');
});
