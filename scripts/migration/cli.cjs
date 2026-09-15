const path = require('node:path');
const { createInventory } = require('./inventory.cjs');
const { backupInventory, restoreBackup } = require('./backup.cjs');

async function main() {
  const [source, backup, restore, ...extra] = process.argv.slice(2);
  if (!source || !backup || !restore || extra.length || ![source, backup, restore].every(path.isAbsolute)) throw Error('ABSOLUTE_SOURCE_BACKUP_RESTORE_REQUIRED');
  const inventory = await createInventory(source);
  const receipt = await backupInventory(inventory, backup);
  await restoreBackup(backup, restore);
  console.log(JSON.stringify({ verified: true, inventoryHash: receipt.inventoryHash, files: inventory.entries.filter(e => e.migrationClass === 'preserve' && e.kind === 'file').length, protectedPathsExcluded: receipt.protectedPathsExcluded, secretsIncluded: false, runtimeVerified: false }));
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
