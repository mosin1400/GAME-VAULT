const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('frontend/pages/profile.html', 'utf8');
const app = fs.readFileSync('frontend/scripts/app.js', 'utf8');

assert.match(html, /profile-page\.css/, 'profile must load its consolidated page stylesheet');
assert.match(html, /theme-sync\.js/, 'profile must use the shared theme synchronizer');
assert.doesNotMatch(app, /link\.textContent='م'/, 'public guest avatar must not impersonate a named account');
console.log('guest profile contract passed');
