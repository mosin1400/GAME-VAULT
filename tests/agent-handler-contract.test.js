const assert = require('node:assert/strict');
const { createAgentHandler } = require('../backend/ai/agent-handler');

(async () => {
  const appended = [], saved = [], calls = [];
  const memory = { read: async () => [], append: async (_game, _version, item) => { appended.push(item); } };
  const handler = createAgentHandler({
    agentMemory: memory,
    projectRoot: () => 'C:/project',
    buildAgentContext: async () => ({ files: { 'main.js': 'const a = 1;' }, paths: ['main.js'] }),
    createAgentTools: () => ({ listFiles: async () => [], readFile: async () => '', searchText: async () => [] }),
    runAgent: async input => { calls.push(input); return { reply: 'انجام شد', events: [{ type: 'read_file', detail: 'main.js' }] }; },
    saveAction: action => saved.push(action), apiKey: 'configured', model: 'free', port: 8080
  });
  const result = await handler({ game: 'demo', version: 'v1', message: 'تصویر را بررسی کن', skill: 'bug-fix', approvalMode: 'manual', attachmentName: 'shot.png', attachmentType: 'image/png', attachmentData: 'YWJj' });
  assert.equal(result.message, 'انجام شد');
  assert.equal(appended[0].role, 'user');
  assert.match(calls[0].messages[0].content, /Skill فعال=bug-fix/, 'selected Skill must reach the Agent system context');
  assert.equal(calls[0].messages.at(-1).content[1].image_url.url, 'data:image/png;base64,YWJj', 'attached image must reach the model as image input');
  assert.ok(calls[0].tools.propose_file_change, 'Agent must receive a file-change proposal tool');
  const pending = await calls[0].tools.propose_file_change({ operation: 'write', path: 'main.js', content: 'const a = 2;' });
  assert.equal(pending.status, 'pending_confirmation');
  assert.equal(saved[0].type, 'write');
  console.log('agent handler contract passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
