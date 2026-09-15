const assert = require('node:assert/strict');
const { isAdminPassword } = require('../backend/auth/admin-account');

assert.equal(isAdminPassword('192837465'), true);
assert.equal(isAdminPassword('۱۹۲۸۳۷۴۶۵'), true);
assert.equal(isAdminPassword('not-the-admin-password'), false);
console.log('single admin account passed');
