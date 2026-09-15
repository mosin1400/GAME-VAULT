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
console.log('management and terminal contract passed');
