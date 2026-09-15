const assert = require('node:assert/strict');
const fs = require('node:fs');

const management = fs.readFileSync('frontend/pages/manage.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');

assert.match(management, /id="managementDashboard"/, 'edit-mode dashboard must exist');
assert.match(management, /id="profileView"/, 'profile view must exist');
assert.match(management, /id="gameWizard"/, 'game creation wizard must exist');
assert.match(management, /id="gameImage"/, 'game wizard must support image upload');
assert.match(management, /id="gamePackage"/, 'game wizard must support game package upload');
assert.match(server, /\/api\/terminal/, 'terminal API must exist');
assert.match(server, /\/api\/history\/restore/, 'history restore API must exist');
const manageJs = fs.readFileSync('frontend/scripts/manage.js', 'utf8');
assert.match(manageJs, /mountFreeStudio/, 'management must expose the free Studio entry');
assert.match(manageJs, /\/api\/theia\/free/, 'free Studio entry must start the isolated Theia service');
const versionControls = manageJs.match(/<section class="version-controls compact-version-controls">([\s\S]*?)<\/section>/)?.[1];
assert.ok(versionControls, 'version controls must be a compact single row');
for (const action of ['add', 'rename', 'delete']) {
  assert.match(versionControls, new RegExp(`data-version-action="${action}" title="[^"]+" aria-label="[^"]+">[^<]+</button>`), 'icon actions must retain accessible names');
}
assert.match(versionControls, /class="version-preview"/, 'preview belongs beside the version selector');
assert.doesNotMatch(manageJs, /<a[^>]*\bdownload\b/, 'management cards must not show a download button');
console.log('management and terminal contract passed');
