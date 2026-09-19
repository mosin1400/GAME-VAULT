const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const profile = fs.readFileSync('frontend/scripts/profile.js', 'utf8');

assert.match(server, /spawn\(\s*process\.execPath/, 'Theia must launch its JavaScript CLI directly through Node without a Windows command shell');
assert.match(server, /username\s*:\s*['"]admin['"]/, 'the single administrator account must be created by the server');
assert.match(server, /\/api\/theia\/free/, 'administrator must have a separate free Studio endpoint');
assert.match(server, /theiaHost\(req\)/, 'Studio must use the explicit reachable loopback host');
assert.match(server, /gvToken/, 'Studio opened from management must receive an authenticated Studio token');
assert.match(profile, /api\/auth\/register/, 'the public profile page must support normal account registration');
console.log('Theia/admin contract passed');
