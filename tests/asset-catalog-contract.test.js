const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const catalog = fs.readFileSync('backend/http/static-assets.js', 'utf8');
assert.match(server, /backend\/http\/static-assets/, 'server must use the dedicated static asset catalog');
for (const asset of ['app-page.css', 'manage-page.css', 'profile-page.css', 'foundation.css', 'theme.css', 'community.css']) {
  assert.match(catalog, new RegExp("'" + asset.replace('.', '\\.') + "'"), `${asset} must be catalogued`);
}
for (const legacyAsset of ['editor-page.css', 'editor-core-files.css', 'editor-professional.css', 'editor-resize.css', 'editor-upgrades.css', 'editor-workspace.css', 'profile-fix.css', 'views-overrides.css', 'wizard.css']) {
  assert.doesNotMatch(catalog, new RegExp("'" + legacyAsset.replace('.', '\\.') + "'"), `${legacyAsset} must not remain in the active asset catalog`);
}
console.log('asset catalog contract passed');
