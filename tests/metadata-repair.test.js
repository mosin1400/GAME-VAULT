const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMetadataService } = require('../backend/projects/metadata-service');
const { readJson, validateMeta, readmeMarkdown } = require('../backend/core/project-utils');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-metadata-'));
  const service = createMetadataService({ readJson, validateMeta, readmeMarkdown });
  const result = await service.repair(root, { game: 'demo', version: 'v2.0.0' });
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8'));
  assert.equal(result.created, true);
  assert.equal(meta.slug, 'demo');
  assert.equal(meta.version, 'v2.0.0');
  assert.equal(validateMeta(meta), null);
  assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /نسخه: v2\.0\.0/);
  fs.writeFileSync(path.join(root, 'game.json'), JSON.stringify({ ai: '', image: '', description: '' }));
  const repaired = await service.repair(root, { game: 'demo', version: 'v2.0.0' });
  assert.equal(validateMeta(repaired.meta), null);
  assert.equal(repaired.meta.ai, 'نامشخص');
  console.log('metadata repair passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
