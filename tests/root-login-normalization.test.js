const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/scripts/app.js', 'utf8');

assert.match(app, /normalizePasswordDigits/, 'root login must normalize Persian password digits before local validation');
assert.doesNotMatch(app, /PASSWORD_DIGEST/, 'root login must not ship an administrator password hash to browsers');
console.log('root login normalization passed');
