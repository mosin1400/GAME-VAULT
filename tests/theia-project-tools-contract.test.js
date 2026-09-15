const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8');

for (const value of ['GameVaultProjectToolsWidget', '/api/project-tools', '/api/history', '/api/history/restore', 'gv-project-tools']) {
  assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${value} must be available in Studio`);
}
console.log('Theia project tools contract passed');
