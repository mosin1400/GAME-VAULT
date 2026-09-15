const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isProtectedEnvironmentPath } = require('../../backend/core/protected-paths');

async function assertNoLinkAncestors(input) {
  if (!path.isAbsolute(input)) throw Error('ABSOLUTE_PATH_REQUIRED');
  let current = path.resolve(input);
  for (;;) {
    const stat = await fs.lstat(current).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw Error('LINK_ANCESTOR_REJECTED');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

async function openRegularFile(file) {
  if (isProtectedEnvironmentPath(file)) throw Error('PROTECTED_PATH_REJECTED');
  await assertNoLinkAncestors(file);
  const before = await fs.lstat(file);
  if (!before.isFile() || before.nlink > 1) throw Error('UNRESOLVED_SPECIAL_ENTRY');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    await assertNoLinkAncestors(file);
    const opened = await handle.stat();
    if (!opened.isFile() || !sameFile(before, opened)) throw Error('SOURCE_CHANGED_DURING_SCAN');
    return { handle, before };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function hashFile(file) {
  const { handle, before } = await openRegularFile(file);
  try {
    const sum = crypto.createHash('sha256');
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      sum.update(chunk); bytes += chunk.length;
    }
    if (!sameFile(before, await handle.stat()) || !sameFile(before, await fs.lstat(file))) throw Error('SOURCE_CHANGED_DURING_SCAN');
    return { bytes, sha256: sum.digest('hex') };
  } finally { await handle.close(); }
}

async function createInventory(input) {
  if (isProtectedEnvironmentPath(input)) throw Error('PROTECTED_PATH_REJECTED');
  await assertNoLinkAncestors(input);
  const sourceRoot = path.resolve(input), entries = [];
  if (!(await fs.lstat(sourceRoot)).isDirectory()) throw Error('DIRECTORY_REQUIRED');
  async function scan(directory, base = '') {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const child of children) {
      const relative = base ? base + '/' + child.name : child.name;
      // Deliberately before lstat/open/hash/traversal of the protected entry.
      if (isProtectedEnvironmentPath(relative)) {
        entries.push({ path: relative, kind: 'excluded', migrationClass: 'protected', reason: 'environment-file' });
        continue;
      }
      const full = path.join(directory, child.name), stat = await fs.lstat(full);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) {
        entries.push({ path: relative, kind: 'link', migrationClass: 'quarantine' });
      } else if (stat.isDirectory()) {
        const generated = ['node_modules', '.git'].includes(child.name.toLowerCase());
        entries.push({ path: relative, kind: 'directory', mode: stat.mode & 0o777, migrationClass: generated ? 'generated' : 'preserve' });
        if (!generated) await scan(full, relative);
      } else if (stat.isFile()) {
        entries.push({ path: relative, kind: 'file', ...await hashFile(full), mode: stat.mode & 0o777, migrationClass: 'preserve' });
      } else entries.push({ path: relative, kind: 'special', migrationClass: 'quarantine' });
    }
  }
  await scan(sourceRoot);
  return { schemaVersion: 1, sourceRoot, entries };
}

function digestEntries(entries) {
  return crypto.createHash('sha256').update(JSON.stringify(entries.filter(e => e.migrationClass === 'preserve'))).digest('hex');
}

module.exports = { createInventory, digestEntries, assertNoLinkAncestors, openRegularFile, sameFile };
