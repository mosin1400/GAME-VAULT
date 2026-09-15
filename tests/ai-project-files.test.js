const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectProjectFiles, protectedMetadataFiles } = require('../backend/ai/project-files');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-ai-'));
  fs.writeFileSync(path.join(root, 'game.html'), '<h1>Game</h1>');
  fs.writeFileSync(path.join(root, 'game.json'), '{"name":"Game"}');
  fs.writeFileSync(path.join(root, 'README.md'), '# Game');
  const files = await collectProjectFiles(root);
  assert.equal(files['game.html'], '<h1>Game</h1>');
  assert.equal(Object.hasOwn(files, 'game.json'), false);
  assert.equal(Object.hasOwn(files, 'README.md'), false);
  assert.deepEqual(protectedMetadataFiles, ['game.json', 'README.md']);
  console.log('AI project files passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
