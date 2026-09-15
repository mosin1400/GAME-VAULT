const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { serveStatic } = require('../../backend/http/static-response');
const { safeStaticPath } = require('../../backend/http/static-assets');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-static-test-'));
  t.after(async () => {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('gv-static-test-')) throw Error('UNSAFE_CLEANUP');
    await fs.rm(root, { recursive: true, force: true });
  });
  async function file(name, bytes) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), bytes);
  }
  await file('frontend/pages/theia.html', 'THEIA');
  await file('frontend/scripts/project-tools.js', 'TOOLS');
  await file('frontend/styles/theme.css', 'THEME');
  await file('games/demo/versions/v1/game.html', 'GAME');
  await file('games/demo/versions/v1/assets/a.png', Buffer.from([0, 255, 128]));
  await file('server.js', 'PRIVATE SOURCE');
  await file('.vault/users.json', 'PRIVATE FIXTURE');
  await file('games/demo/versions/v1/game.json', 'PRIVATE METADATA');
  // A directory tripwire: protected paths are not opened or descended into.
  await fs.mkdir(path.join(root, '.ENV'));
  const server = http.createServer((req, res) => { serveStatic(root, req, res, req.url).catch(() => res.destroy()); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(url, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method }, res => {
        const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => resolve({ status: res.statusCode, bytes: Buffer.concat(chunks), headers: res.headers }));
      }); req.on('error', reject); req.end();
    });
  }
  return { root, request, file };
}

test('public frontend and game web assets retain exact bytes', async t => {
  const { request } = await fixture(t);
  for (const [url, body] of [['/theia.html', 'THEIA'], ['/project-tools.js', 'TOOLS'], ['/frontend/styles/theme.css', 'THEME'], ['/games/demo/versions/v1/game.html', 'GAME']]) {
    const r = await request(url); assert.equal(r.status, 200, url); assert.equal(r.bytes.toString(), body);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
  }
  assert.deepEqual((await request('/games/demo/versions/v1/assets/a.png')).bytes, Buffer.from([0, 255, 128]));
});

test('private, protected, traversal and unknown paths return generic 404', async t => {
  const { root, request } = await fixture(t);
  for (const url of ['/server.js', '/package.json', '/backend/auth/admin-account.js', '/.vault/users.json', '/.ENV', '/api/.env.local', '/games/demo/versions/v1/game.json', '/games/demo/versions/v1/package.json', '/games/demo/versions/v1/node_modules/a.js', '/editor.html', '/frontend/styles/missing.css', '/%2e%2e/server.js', '/%252e%252e/server.js', '/games/demo/versions/v1/%2e%2e/game.html', '/frontend/styles/theme.css%00', '/frontend%5cstyles%5ctheme.css']) {
    const r = await request(url); assert.equal(r.status, 404, url); assert.equal(r.bytes.toString(), 'Not found'); assert.ok(!r.bytes.toString().includes(root));
  }
});

test('public physical junctions and hardlinks cannot publish external files', async t => {
  const { root, request, file } = await fixture(t);
  await file('outside/sentinel.css', 'PRIVATE');
  await fs.symlink(path.join(root, 'outside'), path.join(root, 'games/demo/versions/v1/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await request('/games/demo/versions/v1/linked/sentinel.css')).status, 404);
  await fs.link(path.join(root, 'outside/sentinel.css'), path.join(root, 'frontend/styles/foundation.css'));
  assert.equal((await request('/foundation.css')).status, 404);
  assert.equal(safeStaticPath(root, '/server.js'), null);
});

test('HEAD sends headers without bytes and unsupported methods are rejected', async t => {
  const { request } = await fixture(t);
  const r = await request('/theia.html', 'HEAD'); assert.equal(r.status, 200); assert.equal(r.bytes.length, 0);
  assert.equal((await request('/theia.html', 'POST')).status, 405);
});
