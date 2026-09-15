const assert = require('node:assert/strict');
const { runAgent } = require('../backend/ai/agent-runner');
(async () => {
  const tokens = [], events = [];
  let turn = 0;
  const frames = [
    [{ tool_calls: [{ index: 0, id: 'call1', function: { name: 'read_', arguments: '{"path":' } }] }, { tool_calls: [{ index: 0, function: { name: 'file', arguments: '"game.js"}' } }] }],
    [{ content: 'Hello ' }, { content: 'world' }]
  ];
  const result = await runAgent({ endpoint: 'mock', headers: {}, model: 'test', messages: [], tools: { read_file: ({ path }) => ({ path }) }, onToken: token => tokens.push(token), onEvent: event => events.push(event),
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).stream, true);
      const raw = frames[turn++].map(delta => `data: ${JSON.stringify({ choices: [{ delta }] })}\r\n\r\n`).join('') + 'data: [DONE]\n\n';
      return { ok: true, body: (async function* () { const bytes = new TextEncoder().encode(raw); for (let i = 0; i < bytes.length; i += 7) yield bytes.slice(i, i + 7); })() };
    }
  });
  assert.equal(result.reply, 'Hello world');
  assert.deepEqual(tokens, ['Hello ', 'world']);
  assert.equal(events[0].detail, 'game.js');
  console.log('agent stream passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
