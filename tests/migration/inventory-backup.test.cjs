const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createInventory, digestEntries } = require('../../scripts/migration/inventory.cjs');
const { backupInventory, restoreBackup } = require('../../scripts/migration/backup.cjs');
const { verifyInventory } = require('../../scripts/migration/verify.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-backup-test-'));
  t.after(async () => {
    const absolute = path.resolve(root);
    if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith('gv-backup-test-')) throw Error('Unsafe fixture cleanup');
    await fs.rm(absolute, { recursive: true, force: true });
  });
  return root;
}

test('inventory hashes Unicode binary paths without decoding bytes', async t => {
  const root = await fixture(t);
  const bytes = Buffer.from([0x89, 0xff, 0, 0xc3, 0x28]);
  await fs.writeFile(path.join(root, 'تصویر (1).png'), bytes);
  const inventory = await createInventory(root);
  const entry = inventory.entries.find(e => e.path === 'تصویر (1).png');
  assert.equal(entry.bytes, 5);
  assert.equal(entry.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(digestEntries(inventory.entries), digestEntries((await createInventory(root)).entries));
});

test('protected environment paths are excluded before traversal or hashing', async t => {
  const root = await fixture(t);
  // A protected path is a directory here: traversing it would reveal this trap.
  await fs.mkdir(path.join(root, '.ENV'));
  await fs.writeFile(path.join(root, '.ENV', 'trap.txt'), 'fixture only');
  await fs.mkdir(path.join(root, 'api'));
  await fs.mkdir(path.join(root, 'api', '.env.local'));
  const inventory = await createInventory(root);
  const entries = inventory.entries.filter(e => e.migrationClass === 'protected');
  assert.deepEqual(entries.map(e => e.path), ['.ENV', 'api/.env.local']);
  assert.ok(entries.every(e => !Object.hasOwn(e, 'sha256') && !Object.hasOwn(e, 'bytes')));
  assert.equal(inventory.entries.some(e => e.path.includes('trap.txt')), false);
  const backup = path.join(await fixture(t), 'backup');
  const receipt = await backupInventory(inventory, backup);
  assert.equal(receipt.protectedPathsExcluded, 2);
  assert.equal(await fs.lstat(path.join(backup, 'data', '.ENV')).then(() => true, () => false), false);
});

test('backups reject forged manifests requesting protected files', async t => {
  const root = await fixture(t), source = path.join(root, 'source');
  await fs.mkdir(source);
  const forged = { schemaVersion: 1, sourceRoot: source, entries: [{ path: '.env', kind: 'file', migrationClass: 'preserve', bytes: 0, sha256: 'fake', mode: 0o600 }] };
  await assert.rejects(backupInventory(forged, path.join(root, 'backup')), /PROTECTED_PATH_REJECTED/);
});

test('inventory does not descend into generated dependencies or external junctions', async t => {
  const root = await fixture(t), source = path.join(root, 'source'), outside = path.join(root, 'outside');
  await fs.mkdir(source); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'sentinel.txt'), 'fixture only');
  await fs.mkdir(path.join(source, 'node_modules'));
  await fs.writeFile(path.join(source, 'node_modules', 'generated.txt'), 'generated');
  await fs.symlink(outside, path.join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const inventory = await createInventory(source);
  assert.equal(inventory.entries.find(e => e.path === 'linked').kind, 'link');
  assert.equal(inventory.entries.some(e => e.path.endsWith('sentinel.txt') || e.path.endsWith('generated.txt')), false);
  await assert.rejects(backupInventory(inventory, path.join(root, 'backup')), /UNRESOLVED_SPECIAL_ENTRY/);
});

test('backup and fresh restore preserve binary bytes and reject tampering', async t => {
  const root = await fixture(t), source = path.join(root, 'source'), backup = path.join(root, 'backup'), restore = path.join(root, 'restore');
  await fs.mkdir(source);
  const bytes = Buffer.alloc(1024 * 1024 + 13, 0xff);
  await fs.writeFile(path.join(source, 'big.bin'), bytes);
  const inventory = await createInventory(source);
  await backupInventory(inventory, backup);
  await restoreBackup(backup, restore);
  assert.deepEqual(await fs.readFile(path.join(restore, 'big.bin')), bytes);
  await fs.writeFile(path.join(backup, 'data', 'big.bin'), Buffer.from([1]));
  await assert.rejects(verifyInventory(inventory, path.join(backup, 'data')), /INTEGRITY_MISMATCH/);
});

test('backup rejects overlapping roots and source changes', async t => {
  const root = await fixture(t), source = path.join(root, 'source');
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'a.txt'), 'before');
  const inventory = await createInventory(source);
  await assert.rejects(backupInventory(inventory, path.join(source, 'backup')), /OVERLAPPING_ROOTS/);
  if (process.platform === 'win32') await assert.rejects(backupInventory(inventory, path.join(source.toUpperCase(), 'backup')), /OVERLAPPING_ROOTS/);
  await fs.writeFile(path.join(source, 'a.txt'), 'after');
  await assert.rejects(backupInventory(inventory, path.join(root, 'backup')), /SOURCE_CHANGED/);
});

test('restore rejects existing targets and manifest traversal', async t => {
  const root = await fixture(t), source = path.join(root, 'source'), backup = path.join(root, 'backup'), target = path.join(root, 'target');
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'a.txt'), 'a');
  await backupInventory(await createInventory(source), backup);
  await fs.mkdir(target);
  await assert.rejects(restoreBackup(backup, target), /TARGET_EXISTS/);
  const manifestPath = path.join(backup, 'inventory.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.entries[0].path = '../outside.txt';
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(restoreBackup(backup, path.join(root, 'other')), /INVALID_MANIFEST_PATH/);
});
