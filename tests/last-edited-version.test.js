const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createGameCatalog } = require('../backend/projects/game-catalog');
const { createMetadataService } = require('../backend/projects/metadata-service');
const { readJson, validateMeta, readmeMarkdown } = require('../backend/core/project-utils');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-last-edited-'));
  try {
    const metadata = createMetadataService({ readJson, validateMeta, readmeMarkdown });
    for (const version of ['v1', 'v9']) { const directory = path.join(root, 'demo', 'versions', version); await metadata.repair(directory, { game: 'demo', version }); await fs.writeFile(path.join(directory, 'game.html'), version); }
    const chosen = path.join(root, 'demo', 'versions', 'v1');
    await fs.writeFile(path.join(chosen, 'README.md'), '## Custom\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
    const before = await fs.stat(path.join(chosen, 'game.json'));
    await metadata.repair(chosen, { game: 'demo', version: 'v1', preserveReadme: true });
    assert.equal((await fs.stat(path.join(chosen, 'game.json'))).mtimeMs, before.mtimeMs);
    assert.match(await fs.readFile(path.join(chosen, 'README.md'), 'utf8'), /Custom/);
    await fs.utimes(path.join(chosen, 'game.html'), new Date(), new Date(Date.now() + 10000));
    const catalog = createGameCatalog({ gamesRoot: root, readJson, validateMeta });
    assert.equal((await catalog.listGames())[0].version, 'v1');
    assert.equal((await catalog.detail('demo')).version, 'v1');
    assert.equal((await catalog.detail('demo', 'v9')).version, 'v9');
    console.log('Last edited version selection and non-destructive startup metadata sync passed');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
