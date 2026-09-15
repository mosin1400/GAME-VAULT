const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('theia/gv-extension/studio-module.js', 'utf8');

for (const id of ['gv-preview', 'gv-layout-explorer', 'gv-layout-split', 'gv-layout-focus', 'gv-version-add', 'gv-version-rename', 'gv-version-delete']) {
  assert.match(source, new RegExp(id), `${id} must be available in the native Studio toolbar`);
}
assert.match(source, /api\/version/, 'version controls must use the server version API');
assert.match(source, /window\.location\.assign\(data\.url\)/, 'version changes must open the matching workspace URL');
console.log('Theia toolbar contract passed');
