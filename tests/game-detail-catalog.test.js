const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGameCatalog } = require('../backend/projects/game-catalog');

(async () => {
  const gamesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-detail-'));
  const root = path.join(gamesRoot, 'demo', 'versions', 'v1.0.0');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'game.json'), JSON.stringify({ id: 'demo', slug: 'demo', name: 'Demo', version: 'v1.0.0' }));
  fs.writeFileSync(path.join(root, 'README.md'), '# معرفی واقعی');
  const catalog = createGameCatalog({ gamesRoot, readJson: async file => JSON.parse(fs.readFileSync(file, 'utf8')), validateMeta: () => null });
  const detail = await catalog.detail('demo');
  assert.equal(detail.meta.name, 'Demo');
  assert.equal(detail.markdown, '# معرفی واقعی');
  assert.equal(detail.version, 'v1.0.0');
  const direct = path.join(gamesRoot, 'direct');
  fs.mkdirSync(path.join(direct, 'versions', 'v1.0.0'), { recursive: true });
  fs.writeFileSync(path.join(direct, 'game.json'), JSON.stringify({ id: 'direct', slug: 'direct', name: 'Direct', version: 'v2', playUrl: 'index.html' }));
  fs.writeFileSync(path.join(direct, 'README.md'), '# Direct project');
  const directVersions = await catalog.versions('direct');
  assert.equal(directVersions[0].root, true, 'root metadata must win over leftover versions');
  const directDetail = await catalog.detail('direct');
  assert.equal(directDetail.markdown, '# Direct project');
  console.log('game detail catalog passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
