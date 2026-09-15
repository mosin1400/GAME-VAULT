const assert = require('node:assert/strict');
const test = require('node:test');
const { buildApp } = require('../../apps/api/dist/app');

async function withApp(ready, exercise) {
  const app = buildApp({ config: { bodyLimit: 1024 }, isReady: async () => ready });
  try { return await exercise(app); }
  finally { await app.close(); }
}

test('API spine exposes live health without any environment access', async () => {
  await withApp(true, async app => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'live' });
    assert.match(response.headers['x-request-id'], /^[a-z0-9-]+$/i);
  });
});

test('API spine reports an unavailable dependency as ready=false', async () => {
  await withApp(false, async app => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'not_ready' });
  });
});

test('API spine returns a stable generic error for unknown routes and malformed JSON', async () => {
  await withApp(true, async app => {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/missing' });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { error: { code: 'NOT_FOUND', message: 'Not found' } });
    const malformed = await app.inject({ method: 'POST', url: '/health/live', headers: { 'content-type': 'application/json' }, payload: '{' });
    assert.equal(malformed.statusCode, 400);
    assert.deepEqual(malformed.json(), { error: { code: 'BAD_REQUEST', message: 'Bad request' } });
  });
});
