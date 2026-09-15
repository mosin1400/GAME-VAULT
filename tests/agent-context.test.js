const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAgentContext } = require('../backend/ai/agent-context');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-agent-context-'));
  fs.writeFileSync(path.join(root, 'game.json'), '{"name":"Demo"}');
  fs.writeFileSync(path.join(root, 'README.md'), '# Demo');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'game.js'), 'const score = 0;');
  fs.writeFileSync(path.join(root, 'cover.png'), 'not-text');
  const context = await buildAgentContext(root, { activeFile: 'src/game.js' });
  assert.equal(context.activeFile.path, 'src/game.js');
  assert.equal(context.activeFile.content, 'const score = 0;');
  assert.equal(context.files['game.json'], '{"name":"Demo"}', 'protected metadata is readable context, even though it is never writable by AI');
  assert.equal(context.files['README.md'], '# Demo');
  assert.ok(context.paths.includes('src/game.js'));
  assert.ok(!context.paths.includes('cover.png'), 'binary files must not be sent to the model');
  fs.rmSync(root, { recursive: true, force: true });
  console.log('agent context passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
