const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectHistory } = require('../backend/projects/history');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-history-'));
  const vault = path.join(root, '.vault');
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'game.html'), '<h1>ok</h1>');
  const history = createProjectHistory({ vaultRoot: vault });
  const snapshot = await history.snapshot(project);
  assert.equal(snapshot['game.html'], '<h1>ok</h1>');
  await history.add('demo', 'v1.0.0', { message: 'test', files: ['game.html'], before: snapshot });
  const entries = await history.list('demo', 'v1.0.0');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].message, 'test');
  console.log('project history passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
