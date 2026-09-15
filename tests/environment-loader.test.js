const assert = require('node:assert/strict');
const { loadEnvironmentFiles } = require('../backend/core/environment-loader');

let reads = 0;
const fakeFs = {
  existsSync() { throw Error('environment paths must not even be checked when disabled'); },
  readFileSync() { reads++; throw Error('environment file was read'); }
};
const target = {};

assert.deepEqual(loadEnvironmentFiles({ root: 'C:/fixture', fs: fakeFs, environment: target, enabled: false }), { loaded: 0, skipped: true });
assert.equal(reads, 0);
assert.deepEqual(target, {});
console.log('environment loader skip contract passed');
