const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const profile = fs.readFileSync('frontend/scripts/profile.js', 'utf8');

assert.match(server, /shell:\s*process\.platform\s*===\s*['"]win32['"]/, 'Theia must launch .cmd safely on Windows');
assert.match(server, /username\s*:\s*['"]admin['"]/, 'the single administrator account must be created by the server');
assert.match(server, /\/api\/theia\/free/, 'administrator must have a separate free Studio endpoint');
assert.match(server, /theiaHost\(req\)/, 'Studio must preserve localhost or 127.0.0.1 used by the manager session');
assert.match(server, /gvToken/, 'Studio opened from management must receive an authenticated Studio token');
assert.doesNotMatch(profile, /api\/auth\/register/, 'the public profile page must not create a second account');
console.log('Theia/admin contract passed');
