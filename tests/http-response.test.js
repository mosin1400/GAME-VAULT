const assert = require('node:assert/strict');
const { serializeResponse } = require('../backend/http/response');

const payload = serializeResponse({ ok: true });
assert.equal(payload.body, '{"ok":true}');
assert.match(payload.headers['content-type'], /application\/json/);
assert.equal(serializeResponse('ok').body, 'ok');
console.log('HTTP response helpers passed');
