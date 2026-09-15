const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createProjectHistory({ vaultRoot }) {
  const fsp = fs.promises;
  function fileFor(game, version) { return path.join(vaultRoot, game, version, 'history.json'); }

  async function list(game, version) { return readJson(fileFor(game, version), []); }
  async function add(game, version, entry) {
    const file = fileFor(game, version);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const entries = await list(game, version);
    entries.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
    await fsp.writeFile(file, JSON.stringify(entries, null, 2));
  }
  async function snapshot(root) {
    const files = {};
    async function scan(directory, relative = '') {
      for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        const next = path.join(relative, entry.name);
        if (entry.isDirectory()) await scan(full, next);
        else if ((await fsp.stat(full)).size < 1000000) files[next.replaceAll('\\', '/')] = await fsp.readFile(full, 'utf8');
      }
    }
    await scan(root);
    return files;
  }
  async function readJson(file, fallback) {
    try { return JSON.parse(await fsp.readFile(file, 'utf8')); }
    catch { return fallback; }
  }

  return { fileFor, list, add, snapshot };
}

module.exports = { createProjectHistory };
