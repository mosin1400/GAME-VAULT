const { createInventory, digestEntries } = require('./inventory.cjs');
const { validateInventory } = require('./manifest.cjs');

async function verifyInventory(inventory, copiedRoot) {
  validateInventory(inventory);
  const actual = await createInventory(copiedRoot);
  if (actual.entries.some(e => ['quarantine', 'protected'].includes(e.migrationClass)) || digestEntries(actual.entries) !== digestEntries(inventory.entries)) throw Error('INTEGRITY_MISMATCH');
  return { verified: true, inventoryHash: digestEntries(inventory.entries) };
}

module.exports = { verifyInventory };
