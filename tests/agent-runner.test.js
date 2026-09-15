const assert = require('node:assert/strict');
const { runAgent } = require('../backend/ai/agent-runner');

(async () => {
  const requests = [];
  const replies = [
    { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call-1', function: { name: 'search_text', arguments: '{"query":"tank"}' } }] } }] },
    { choices: [{ message: { role: 'assistant', content: 'فایل پیدا شد.' } }] }
  ];
  const result = await runAgent({
    fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => replies.shift() }; },
    endpoint: 'https://example.test', headers: {}, model: 'free', messages: [{ role: 'user', content: 'tank را پیدا کن' }, { role: 'user', content: 'tank را پیدا کن' }],
    tools: { search_text: async ({ query }) => ({ matches: [{ path: 'game.js', line: 2, text: query }] }) }
  });
  assert.equal(result.reply, 'فایل پیدا شد.');
  assert.deepEqual(result.events, [{ type: 'search_text', detail: 'tank' }]);
  assert.equal(requests.length, 2, 'tool result must be sent back to the model in a second turn');
  assert.equal(requests[1].messages.at(-1).role, 'tool');
  console.log('agent runner passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
