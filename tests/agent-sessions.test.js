const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createAgentMemory } = require('../backend/ai/agent-memory');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-sessions-'));
  try {
    const memory = createAgentMemory({ root });
    await memory.append('demo', 'v1', { role: 'user', content: 'old chat' });
    const first = await memory.createSession('demo', 'v1');
    const second = await memory.createSession('demo', 'v1');
    await memory.append('demo', 'v1', { role: 'user', content: 'only first' }, first.id);
    assert.deepEqual(await memory.read('demo', 'v1', second.id), []);
    assert.equal((await memory.read('demo', 'v1'))[0].content, 'old chat');
    assert.equal((await memory.listSessions('demo', 'v1')).length, 3);
    await memory.clear('demo', 'v1', first.id);
    assert.equal((await memory.listSessions('demo', 'v1')).length, 2);
    await assert.rejects(memory.read('demo', 'v1', '../escape'), /session/i);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
  console.log('agent sessions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
