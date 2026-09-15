const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentMemory } = require('../backend/ai/agent-memory');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-agent-memory-'));
  const memory = createAgentMemory({ root, now: () => '2026-09-14T13:30:00.000Z', limit: 3 });
  await memory.append('demo', 'v1', { role: 'user', content: 'اولین پیام' });
  await memory.append('demo', 'v1', { role: 'assistant', content: 'اولین پاسخ' });
  const userMessage = await memory.append('demo', 'v1', { role: 'user', content: 'پیام دوم' });
  await memory.append('demo', 'v1', { role: 'assistant', content: 'پاسخ دوم' });
  const conversation = await memory.read('demo', 'v1');
  assert.deepEqual(conversation.map(item => item.content), ['اولین پاسخ', 'پیام دوم', 'پاسخ دوم'], 'memory must retain the latest messages in order');
  assert.equal(conversation[0].createdAt, '2026-09-14T13:30:00.000Z');
  assert.ok(conversation.every(item => item.id), 'persisted messages must have stable identifiers for UI actions');
  const branched = await memory.editAndTrim('demo', 'v1', userMessage.at(-1).id, 'پیام دوم ویرایش‌شده');
  assert.deepEqual(branched.map(item => item.content), ['اولین پاسخ', 'پیام دوم ویرایش‌شده'], 'editing a user message must remove later stale replies');
  await memory.append('demo', 'v1', { role: 'assistant', content: 'پاسخ جایگزین' });
  const assistant = (await memory.read('demo', 'v1')).at(-1);
  await memory.remove('demo', 'v1', assistant.id);
  assert.deepEqual((await memory.read('demo', 'v1')).map(item => item.content), ['اولین پاسخ', 'پیام دوم ویرایش‌شده'], 'removing one message must preserve the rest of the conversation');
  assert.deepEqual(await memory.read('other', 'v1'), [], 'each game/version must have isolated memory');
  await memory.clear('demo', 'v1');
  assert.deepEqual(await memory.read('demo', 'v1'), [], 'clearing a conversation must not affect other conversations');
  fs.rmSync(root, { recursive: true, force: true });
  console.log('agent memory passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
