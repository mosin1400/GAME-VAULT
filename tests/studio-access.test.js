const assert = require('node:assert/strict');
const { createStudioAccess } = require('../backend/auth/studio-access');

let now = 1_000;
const access = createStudioAccess({ now: () => now, ttlMs: 100 });
const token = access.issue({ id: 'admin-local', role: 'admin' });

assert.equal(access.admin({ headers: { 'x-gv-studio-token': token } }), true, 'a fresh Studio token must grant editor API access');
assert.equal(access.admin({ headers: { 'x-gv-studio-token': 'invalid' } }), false, 'an unknown Studio token must not grant access');
now += 101;
assert.equal(access.admin({ headers: { 'x-gv-studio-token': token } }), false, 'an expired Studio token must not grant access');
console.log('Studio access token passed');
