const assert = require('node:assert/strict');
const { normalizePasswordDigits } = require('../backend/auth/passwords');

assert.equal(normalizePasswordDigits('۱۹۲۸۳۷۴۶۵'), '192837465');
assert.equal(normalizePasswordDigits('۱۹۲۸۳۷۴۶۵'), normalizePasswordDigits('192837465'));
assert.equal(normalizePasswordDigits('a۱۹۲b'), 'a192b');
console.log('password normalization passed');
