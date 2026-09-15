const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('server.js', 'utf8');
const profile = fs.readFileSync('frontend/pages/profile.html', 'utf8');
const profileJs = fs.readFileSync('frontend/scripts/profile.js', 'utf8');

for (const route of ['/api/auth/register', '/api/auth/login', '/api/me', '/api/profile', '/api/metadata']) {
  assert.match(server, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), route + ' must exist');
}
assert.match(profile, /id="loginForm"/, 'profile login form must exist');
assert.match(profile, /id="profileForm"/, 'authenticated profile editor must exist');
assert.match(profile, /id="profileMessage"/, 'profile save feedback must exist');
assert.match(profileJs, /api\('\/api\/profile'/, 'profile editor must persist changes through the server');
assert.match(server, /\/api\/metadata\/repair/, 'metadata repair API must exist');
console.log('auth and metadata contract passed');
