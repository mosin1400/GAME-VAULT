const fs = require('node:fs');
const path = require('node:path');

function createGameCatalog({ gamesRoot, readJson, validateMeta }) {
  const fsp = fs.promises;
  async function lastModified(directory) {
    let latest = (await fsp.stat(directory)).mtimeMs;
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
      const target = path.join(directory, entry.name);
      latest = Math.max(latest, entry.isDirectory() ? await lastModified(target) : (await fsp.stat(target)).mtimeMs);
    }
    return latest;
  }

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
      const list = await Promise.all(names.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(async entry => {
        const root = path.join(base, entry.name);
        const meta = await readJson(path.join(root, 'game.json'), null);
        return { name: entry.name, valid: !!meta, meta, updatedAt: await lastModified(root), error: meta ? validateMeta(meta) : 'game.json پیدا نشد' };
      }));
      return list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    } catch {
      // Projects that were added directly under games/ are exposed as their
      // first version until they are migrated into versions/<id>.
      const root = path.join(gamesRoot, game);
      const meta = await readJson(path.join(root, 'game.json'), null);
      if (!meta) return [];
      return [{ name: meta.version || 'v1.0.0', valid: true, meta: { ...meta, version: meta.version || 'v1.0.0' }, updatedAt: await lastModified(root), error: validateMeta(meta) }];
    }
  }

  async function listGames() {
    const list = [];
    for (const entry of await fsp.readdir(gamesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const allVersions = await versions(entry.name);
      const activeVersion = allVersions.filter(version => version.valid).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (activeVersion?.meta) list.push({ ...activeVersion.meta, version: activeVersion.name, versionCount: allVersions.length, versions: allVersions.filter(version => version.valid && version.meta).map(version => ({ name: version.name, meta: version.meta })) });
    }
    return list.sort((a, b) => Number(a.Order) - Number(b.Order));
  }

  async function detail(game, requestedVersion) {
    const list = await versions(game);
    const selected = requestedVersion ? list.find(item => item.valid && item.name === requestedVersion) : list.filter(item => item.valid).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!selected?.meta) return null;
    const hasVersions = await fsp.stat(path.join(gamesRoot, game, 'versions')).then(() => true).catch(() => false);
    const root = path.join(gamesRoot, game, hasVersions ? 'versions' : '', hasVersions ? selected.name : '');
    const markdown = await fsp.readFile(path.join(root, 'README.md'), 'utf8').catch(() => '');
    return { meta: selected.meta, version: selected.name, markdown };
  }

  return { walk, versions, listGames, detail };
}

module.exports = { createGameCatalog };
