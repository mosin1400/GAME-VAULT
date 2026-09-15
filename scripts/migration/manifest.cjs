const { isProtectedEnvironmentPath } = require('../../backend/core/protected-paths');

function validateInventory(inventory) {
  if (inventory?.schemaVersion !== 1 || typeof inventory.sourceRoot !== 'string' || !Array.isArray(inventory.entries)) throw Error('INVALID_MANIFEST');
  const paths = new Set();
  for (const entry of inventory.entries) {
    if (typeof entry.path !== 'string' || !entry.path || /[\\:\0]/.test(entry.path) || entry.path.split('/').some(part => !part || part === '.' || part === '..')) throw Error('INVALID_MANIFEST_PATH');
    if (paths.has(entry.path.toLowerCase())) throw Error('DUPLICATE_MANIFEST_PATH');
    paths.add(entry.path.toLowerCase());
    if (isProtectedEnvironmentPath(entry.path) && entry.migrationClass !== 'protected') throw Error('PROTECTED_PATH_REJECTED');
    if (!['preserve', 'protected', 'generated', 'quarantine'].includes(entry.migrationClass)) throw Error('INVALID_MANIFEST');
    if (entry.migrationClass === 'preserve') {
      if (!['file', 'directory'].includes(entry.kind) || !Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777) throw Error('INVALID_MANIFEST');
      if (entry.kind === 'file' && (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256))) throw Error('INVALID_MANIFEST');
    }
  }
}

module.exports = { validateInventory };
