const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dashboard = 'http://127.0.0.1:8081';
const studio = 'http://127.0.0.1:3010/gv-api';
(async () => {
  if (!process.env.GV_SMOKE_PASSWORD) throw Error('Set GV_SMOKE_PASSWORD for the local test account; no env file is read.');
  const login = await fetch(dashboard + '/api/login', { signal: AbortSignal.timeout(15000), method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: process.env.GV_SMOKE_PASSWORD }) });
  assert.equal(login.status, 200, 'local test sign-in must work');
  const cookie = login.headers.getSetCookie().map(item => item.split(';')[0]).join('; ');
  const game = 'gv-smoke-' + crypto.randomUUID().slice(0, 8);
  let created = false;
  const request = async (base, route, method, data, token) => {
    console.log('Smoke:', method, route.split('?')[0]);
    const response = await fetch(base + route, { signal: AbortSignal.timeout(15000), method, headers: { cookie, 'content-type': 'application/json', ...(token ? { 'x-gv-studio-token': token } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const result = await response.json();
    if (!response.ok) throw Error(`${method} ${route}: ${response.status} ${result.error || ''}`);
    return result;
  };
  try {
    await request(dashboard, '/api/game', 'POST', { slug: game, name: 'Disposable Studio smoke fixture' }); created = true;
    await request(dashboard, '/api/version', 'POST', { game, version: 'v2', fromVersion: 'v1.0.0' });
    const opened = await request(dashboard, '/api/theia/open', 'POST', { game, version: 'v2' });
    const url = new URL(opened.url), token = url.searchParams.get('gvToken');
    assert.ok(decodeURI(url.hash).endsWith('/versions/v2'));
    assert.ok(url.searchParams.get('workspace').endsWith('/versions/v2'));
    await request(studio, '/api/version', 'DELETE', { game, version: 'v2' }, token);
    const catalog = await request(studio, '/api/versions?game=' + game, 'GET', null, token);
    assert.deepEqual(catalog.versions.map(item => item.name), ['v1.0.0']);
    const session = await request(studio, '/api/agent/sessions', 'POST', { game, version: 'v1.0.0' }, token);
    await request(studio, '/api/agent/sessions', 'DELETE', { game, version: 'v1.0.0', sessionId: session.id }, token);
    console.log('LIVE PASS: authenticated Studio proxy, exact version workspace, deletion and chat session CRUD');
  } finally {
    if (created && /^gv-smoke-[0-9a-f]{8}$/.test(game)) await request(dashboard, '/api/game', 'DELETE', { game });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
