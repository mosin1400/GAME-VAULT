const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createAgentMemory } = require('../backend/ai/agent-memory');
const { createAgentHandler } = require('../backend/ai/agent-handler');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-timeline-'));
  try {
    const memory = createAgentMemory({ root: path.join(root, 'memory') }), observed = [];
    const handle = createAgentHandler({ agentMemory: memory, projectRoot: () => root, apiKey: 'fixture', buildAgentContext: async () => ({ paths: [], files: {} }), createAgentTools: () => ({}), saveAction() {},
      runAgent: async ({ onToken, onEvent, tools }) => {
        onToken('First I inspect the file.'); onEvent({ type: 'read_file', detail: 'main.js' });
        onToken('A change is ready for review.'); await tools.propose_file_change({ path: 'main.js', content: 'new', operation: 'write' });
        onToken('Please approve the proposed change.'); return { reply: 'Please approve the proposed change.', events: [] };
      }
    });
    const result = await handle({ game: 'demo', version: 'v1', message: 'Fix', sessionId: 'default' }, { onToken: token => observed.push(token), onEvent: event => observed.push(event.type) });
    assert.deepEqual(observed, ['First I inspect the file.', 'read_file', 'A change is ready for review.', 'action', 'Please approve the proposed change.']);
    assert.deepEqual(result.timeline.map(item => item.type), ['text', 'activity', 'text', 'activity', 'text']);
    assert.deepEqual((await memory.read('demo', 'v1')).at(-1).timeline, result.timeline);
    await assert.rejects(fs.stat(path.join(root, 'main.js')), { code: 'ENOENT' });
    console.log('Agent streamed text/tool interleaving, persistence and manual approval safety passed');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
