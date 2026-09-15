const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('theia/gv-extension/studio-toolbar.js', 'utf8');

for (const id of ['gv-preview', 'gv-layout-explorer', 'gv-layout-split', 'gv-layout-focus', 'gv-layout-bottom', 'gv-version-add', 'gv-version-rename', 'gv-version-delete']) {
  assert.match(source, new RegExp(id), `${id} must be available in the native Studio toolbar`);
}
assert.match(source, /api\/version/, 'version controls must use the server version API');
assert.match(source, /window\.location\.assign\(url\.href\)/, 'version changes must open the matching workspace URL');
assert.doesNotMatch(source, /id="gv-theme-mode"|id="gv-project-tools"/, 'duplicate toolbar controls must not return');
console.log('Theia toolbar contract passed');
