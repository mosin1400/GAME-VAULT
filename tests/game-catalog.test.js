const assert = require('node:assert/strict');
const path = require('node:path');
const { createGameCatalog } = require('../backend/projects/game-catalog');
const { readJson, validateMeta } = require('../backend/core/project-utils');

(async () => {
  const gamesRoot = path.join(__dirname, '..', 'games');
  const catalog = createGameCatalog({ gamesRoot, readJson, validateMeta });
  const games = await catalog.listGames();
  assert.ok(games.length > 0);
  assert.ok(games.every(game => game.versionCount > 0));
  assert.ok(games.every(game => Array.isArray(game.versions)), 'catalog must expose selectable versions');
  const game = games[0];
  const versions = await catalog.versions(game.slug);
  assert.ok(versions.some(version => version.valid));
  const selected = versions.find(version => version.valid);
  const detail = await catalog.detail(game.slug, selected.name);
  assert.equal(detail.version, selected.name, 'detail must return the requested version');
  assert.equal(detail.meta.version, selected.name, 'metadata must match the requested folder version');
  const tree = await catalog.walk(path.join(gamesRoot, game.slug, 'versions', versions[0].name));
  assert.ok(Array.isArray(tree));
  console.log('game catalog passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
