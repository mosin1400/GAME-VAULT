const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function backFor(search, referrer) {
  const nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, { classList: { toggle() {} }, remove() {} }); return nodes.get(selector); };
  vm.runInNewContext(fs.readFileSync('frontend/scripts/profile.js', 'utf8'), {
    URL, URLSearchParams, location: { search, origin: 'http://localhost:8081' },
    document: { referrer, querySelector: node, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, json: async () => ({ guest: true }) }),
  });
  return node('.back').href;
}
assert.equal(backFor('?returnTo=%2Fmanage.html%23communityAdmin', ''), '/manage.html#communityAdmin');
assert.equal(backFor('', 'http://localhost:8081/manage.html'), '/manage.html');
assert.equal(backFor('?returnTo=%2F%2Fevil.test', 'https://evil.test/'), '/');
assert.equal(backFor('?returnTo=javascript%3Aalert(1)', ''), '/');
assert.equal(backFor('', ''), '/');
console.log('Profile returns to local origin and rejects external redirects');
