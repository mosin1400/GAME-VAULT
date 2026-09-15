const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const { createAgentMemory } = require('../backend/ai/agent-memory');
const { createAgentHandler } = require('../backend/ai/agent-handler');
const { applyTheiaCors } = require('../backend/http/theia-cors');
const { send, readJsonBody } = require('../backend/http/response');
const { workspaceFragment } = require('../backend/projects/workspace-url');
const { readEventStream } = require('../backend/ai/event-stream');

(async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gv-studio-http-'));
  const projectRoot = (game, version) => {
    if (!/^[a-z0-9-]+$/i.test(game) || !/^[a-z0-9.-]+$/i.test(version)) throw Error('Invalid project');
    return path.join(root, 'games', game, 'versions', version);
  };
  const memory = createAgentMemory({ root: path.join(root, 'chats') });
  const handleAgentMessage = createAgentHandler({ agentMemory: memory, projectRoot, apiKey: 'test-fixture-only', buildAgentContext: async () => ({ paths: [], files: {} }), createAgentTools: () => ({}), saveAction() {}, runAgent: async ({ onToken }) => { onToken?.('Hello '); onToken?.('world'); return { reply: 'Hello world', events: [] }; } });
  // Execute the production HTTP route function without startup or env loading.
  const source = fs.readFileSync('server.js', 'utf8');
  const routes = source.slice(source.indexOf('async function api('), source.indexOf('async function main()'));
  const context = { fs, fsp: fs.promises, path, send, body: readJsonBody, projectRoot, agentMemory: memory, handleAgentMessage, applyTheiaCors, admin: () => true, AbortController, setInterval, clearInterval,
    sessionUser: () => ({ id: 'test' }), studioAccess: { issue: () => 'fixture' }, startTheia: async () => {}, theiaHost: () => '127.0.0.1', THEIA_PORT: 3010, PORT: 8081, workspaceFragment };
  vm.createContext(context); vm.runInContext(`${routes}\nthis.route = api;`, context);
  const server = http.createServer((req, res) => context.route(req, res, new URL(req.url, 'http://fixture')).catch(error => send(res, 500, { error: error.message })));
  try {
    await fs.promises.mkdir(projectRoot('demo', 'v1'), { recursive: true });
    await fs.promises.mkdir(projectRoot('demo', 'v2'), { recursive: true });
    const bytes = Buffer.from([0, 255, 128, 42]);
    await fs.promises.writeFile(path.join(projectRoot('demo', 'v1'), 'asset.bin'), bytes);
    await fs.promises.writeFile(path.join(projectRoot('demo', 'v2'), 'only-v2.txt'), 'v2');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (url, method, data) => fetch(base + url, { method, headers: { origin: 'http://127.0.0.1:3010', 'content-type': 'application/json', 'x-gv-studio-token': 'fixture' }, ...(data ? { body: JSON.stringify(data) } : {}) });
    for (const method of ['PATCH', 'DELETE']) {
      const preflight = await fetch(base + '/api/version', { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:3010', 'access-control-request-method': method } });
      assert.equal(preflight.status, 204); assert.ok(preflight.headers.get('access-control-allow-methods').includes(method));
    }
    const opened = await (await request('/api/theia/open', 'POST', { game: 'demo', version: 'v2' })).json();
    assert.equal(decodeURI(new URL(opened.url).hash.slice(1)), decodeURI(workspaceFragment(projectRoot('demo', 'v2'))));
    const session = await (await request('/api/agent/sessions', 'POST', { game: 'demo', version: 'v2' })).json();
    const streamed = await request('/api/agent/message', 'POST', { game: 'demo', version: 'v2', sessionId: session.id, message: 'Hi', stream: true });
    assert.match(streamed.headers.get('content-type'), /event-stream/);
    assert.equal(streamed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3010');
    const events = []; await readEventStream(streamed.body, (data, event) => events.push({ data, event }));
    assert.deepEqual(events.filter(item => item.event === 'token').map(item => item.data.token), ['Hello ', 'world']);
    assert.equal(events.at(-1).event, 'result');
    assert.equal((await memory.read('demo', 'v2', session.id)).at(-1).content, 'Hello world');
    assert.deepEqual(await memory.read('demo', 'v2'), []);
    assert.equal((await request('/api/agent/sessions', 'DELETE', { game: 'demo', version: 'v2', sessionId: session.id })).status, 200);
    assert.equal((await request('/api/version', 'DELETE', { game: 'demo', version: 'v2' })).status, 200);
    await assert.rejects(fs.promises.stat(projectRoot('demo', 'v2')), { code: 'ENOENT' });
    assert.deepEqual(await fs.promises.readFile(path.join(projectRoot('demo', 'v1'), 'asset.bin')), bytes);
    console.log('Studio HTTP: version workspace, deletion, chat sessions, SSE and CORS passed');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('gv-studio-http-')) throw Error('Unsafe cleanup');
    await fs.promises.rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
