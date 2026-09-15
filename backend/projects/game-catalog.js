const fs = require('node:fs');
const path = require('node:path');

function createGameCatalog({ gamesRoot, readJson, validateMeta }) {
  const fsp = fs.promises;

  async function walk(directory, base = directory) {
    const items = [];
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(directory, entry.name);
      const relative = path.relative(base, full).replaceAll('\\', '/');
      if (entry.isDirectory()) items.push({ type: 'folder', path: relative, children: await walk(full, base) });
      else {
        const stat = await fsp.stat(full);
        items.push({ type: 'file', path: relative, size: stat.size, editable: /\.(html?|css|js|json|md|txt|svg|xml)$/i.test(entry.name) });
      }
    }
    return items.sort((a, b) => a.type.localeCompare(b.type) || a.path.localeCompare(b.path));
  }

  async function versions(game) {
    const base = path.join(gamesRoot, game, 'versions');
    try {
      const names = await fsp.readdir(base, { withFileTypes: true });
      const list = await Promise.all(names.filter(entry => entry.isDirectory()).map(async entry => {
        const root = path.join(base, entry.name);
        const meta = await readJson(path.join(root, 'game.json'), null);
        return { name: entry.name, valid: !!meta, meta, error: meta ? validateMeta(meta) : 'game.json پیدا نشد' };
      }));
      return list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    } catch { return []; }
  }

  async function listGames() {
    const list = [];
    for (const entry of await fsp.readdir(gamesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const allVersions = await versions(entry.name);
      const activeVersion = allVersions.find(version => version.valid);
      if (activeVersion?.meta) list.push({ ...activeVersion.meta, version: activeVersion.name, versionCount: allVersions.length, versions: allVersions.filter(version => version.valid && version.meta).map(version => ({ name: version.name, meta: version.meta })) });
    }
    return list.sort((a, b) => Number(a.Order) - Number(b.Order));
  }

  async function detail(game, requestedVersion) {
    const list = await versions(game);
    const selected = requestedVersion ? list.find(item => item.valid && item.name === requestedVersion) : (list.find(item => item.valid) || list[0]);
    if (!selected?.meta) return null;
    const root = path.join(gamesRoot, game, 'versions', selected.name);
    const markdown = await fsp.readFile(path.join(root, 'README.md'), 'utf8').catch(() => '');
    return { meta: selected.meta, version: selected.name, markdown };
  }

  return { walk, versions, listGames, detail };
}

module.exports = { createGameCatalog };
