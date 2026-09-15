const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/scripts/app.js', 'utf8');
const profile = fs.readFileSync('frontend/scripts/profile.js', 'utf8');
assert.match(app, /profile\.html\?next=/, 'editor entry must preserve its destination');
assert.match(profile, /URLSearchParams/, 'profile must read the pending destination');
assert.match(profile, /location\.href=next/, 'admin login must continue to the pending destination');
console.log('editor login return passed');
