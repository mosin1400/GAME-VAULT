const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const path = require('node:path');
const { createInventory, digestEntries, assertNoLinkAncestors, openRegularFile, sameFile } = require('./inventory.cjs');
const { verifyInventory } = require('./verify.cjs');
const { validateInventory } = require('./manifest.cjs');
const { isWithin, isProtectedEnvironmentPath } = require('../../backend/core/protected-paths');

async function prepare(source, target) {
  if (isProtectedEnvironmentPath(source) || isProtectedEnvironmentPath(target)) throw Error('PROTECTED_PATH_REJECTED');
  await assertNoLinkAncestors(source); await assertNoLinkAncestors(target);
  const a = path.resolve(source), b = path.resolve(target);
  if (isWithin(a, b) || isWithin(b, a)) throw Error('OVERLAPPING_ROOTS');
  if (await fs.lstat(b).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) throw Error('TARGET_EXISTS');
  return { a, b };
}

async function copyEntries(inventory, source, target) {
  const directories = [];
  for (const entry of inventory.entries) {
    if (entry.migrationClass === 'protected' || entry.migrationClass === 'generated') continue;
    if (entry.migrationClass !== 'preserve') throw Error('UNRESOLVED_SPECIAL_ENTRY');
    const from = path.resolve(source, entry.path), to = path.resolve(target, entry.path);
    if (!isWithin(source, from) || !isWithin(target, to)) throw Error('INVALID_MANIFEST_PATH');
    if (isProtectedEnvironmentPath(from) || isProtectedEnvironmentPath(to)) throw Error('PROTECTED_PATH_REJECTED');
    await assertNoLinkAncestors(to);
    if (entry.kind === 'directory') {
      await fs.mkdir(to, { recursive: true, mode: 0o700 }); directories.push({ to, mode: entry.mode });
    } else {
      await fs.mkdir(path.dirname(to), { recursive: true });
      const { handle, before } = await openRegularFile(from);
      try {
        await pipeline(handle.createReadStream({ autoClose: false }), createWriteStream(to, { flags: 'wx', mode: entry.mode }));
        if (!sameFile(before, await handle.stat()) || !sameFile(before, await fs.lstat(from))) throw Error('SOURCE_CHANGED');
      } finally { await handle.close(); }
      await fs.chmod(to, entry.mode);
    }
  }
  for (const directory of directories.reverse()) await fs.chmod(directory.to, directory.mode);
}

async function backupInventory(inventory, destination) {
  validateInventory(inventory);
  const { a, b } = await prepare(inventory.sourceRoot, destination);
  if (inventory.entries.some(e => e.migrationClass === 'quarantine')) throw Error('UNRESOLVED_SPECIAL_ENTRY');
  if (digestEntries((await createInventory(a)).entries) !== digestEntries(inventory.entries)) throw Error('SOURCE_CHANGED');
  await fs.mkdir(b); const data = path.join(b, 'data'); await fs.mkdir(data);
  await copyEntries(inventory, a, data);
  const verification = await verifyInventory(inventory, data);
  if (digestEntries((await createInventory(a)).entries) !== digestEntries(inventory.entries)) throw Error('SOURCE_CHANGED');
  const receipt = { ...verification, protectedPathsExcluded: inventory.entries.filter(e => e.migrationClass === 'protected').length, secretsIncluded: false, createdAt: new Date().toISOString(), runtimeVerified: false };
  await fs.writeFile(path.join(b, 'inventory.json'), JSON.stringify(inventory, null, 2), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(b, 'receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
  return { backupRoot: b, ...receipt };
}

async function restoreBackup(backupRoot, newTarget) {
  await prepare(backupRoot, newTarget);
  const inventory = JSON.parse(await fs.readFile(path.join(backupRoot, 'inventory.json'), 'utf8'));
  validateInventory(inventory);
  const receipt = JSON.parse(await fs.readFile(path.join(backupRoot, 'receipt.json'), 'utf8'));
  if (receipt.inventoryHash !== digestEntries(inventory.entries)) throw Error('MANIFEST_MISMATCH');
  const source = path.join(path.resolve(backupRoot), 'data'); await verifyInventory(inventory, source);
  const target = path.resolve(newTarget); await fs.mkdir(target);
  await copyEntries(inventory, source, target);
  return verifyInventory(inventory, target);
}

module.exports = { backupInventory, restoreBackup };
