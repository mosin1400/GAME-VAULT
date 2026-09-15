const toolDefinitions = [
  { type: 'function', function: { name: 'list_files', description: 'List project files before investigating.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_file', description: 'Read one text file from the current project.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'search_text', description: 'Search text across the current project.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'propose_file_change', description: 'Propose one create, edit, or delete operation. Never apply it directly.', parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['write', 'delete'] }, path: { type: 'string' }, content: { type: 'string' } }, required: ['operation', 'path'] } } },
  { type: 'function', function: { name: 'propose_terminal_command', description: 'Propose one terminal command. Never run it directly.', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } }
];

function eventFor(name, args) {
  if (name === 'read_file') return { type: name, detail: args.path || '' };
  if (name === 'search_text') return { type: name, detail: args.query || '' };
  return { type: name, detail: '' };
}

async function runAgent({ fetchImpl = fetch, endpoint, headers, model, messages, tools }) {
  const conversation = [...messages], events = [];
  for (let turn = 0; turn < 5; turn += 1) {
    const response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify({ model, messages: conversation, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.2 }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenRouter پاسخ ناموفق داد');
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('پاسخی از مدل دریافت نشد');
    const calls = message.tool_calls || [];
    if (!calls.length) return { reply: message.content || 'پاسخی دریافت نشد.', events };
    conversation.push({ role: 'assistant', content: message.content || '', tool_calls: calls });
    for (const call of calls) {
      let args = {}; try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      const name = call.function?.name, handler = tools[name];
      events.push(eventFor(name, args));
      let result;
      try { result = handler ? await handler(args) : { error: 'ابزار ناشناخته است' }; } catch (error) { result = { error: error.message }; }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('تعداد فراخوانی ابزارها از حد مجاز گذشت');
}

module.exports = { runAgent, toolDefinitions };
