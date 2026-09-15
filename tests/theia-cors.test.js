const assert = require('node:assert/strict');
const { applyTheiaCors, theiaOrigin, localhostTheiaOrigin } = require('../backend/http/theia-cors');

const headers = new Map();
const response = { setHeader: (key, value) => headers.set(key, value) };
assert.equal(applyTheiaCors({ method: 'OPTIONS', headers: { origin: theiaOrigin } }, response), true);
assert.equal(headers.get('Access-Control-Allow-Credentials'), 'true');
assert.match(headers.get('Access-Control-Allow-Headers'), /x-gv-studio-token/i, 'Studio access token header must pass the CORS preflight');
assert.equal(applyTheiaCors({ method: 'POST', headers: { origin: localhostTheiaOrigin } }, response), false);
assert.equal(headers.get('Access-Control-Allow-Origin'), localhostTheiaOrigin);
assert.equal(applyTheiaCors({ method: 'POST', headers: { origin: 'http://example.test' } }, response), false);
console.log('Theia CORS passed');
