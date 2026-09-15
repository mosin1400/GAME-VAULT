const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentTools } = require('../backend/ai/agent-tools');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-agent-tools-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'main.js'), 'const player = "tank";\nconsole.log(player);');
  fs.writeFileSync(path.join(root, 'game.json'), '{"name":"Demo"}');
  const tools = createAgentTools({ root });
  assert.deepEqual((await tools.listFiles()).paths, ['game.json', 'src/main.js']);
  assert.equal((await tools.readFile('src/main.js')).content.includes('player'), true);
  assert.deepEqual((await tools.searchText('player')).matches.map(item => item.line), [1, 2]);
  await assert.rejects(() => tools.readFile('../outside.txt'), /معتبر نیست/);
  fs.rmSync(root, { recursive: true, force: true });
  console.log('agent tools passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
