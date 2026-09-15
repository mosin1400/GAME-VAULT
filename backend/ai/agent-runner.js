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

const { readEventStream } = require('./event-stream');

async function runAgent({ fetchImpl = fetch, endpoint, headers, model, messages, tools, onToken, onEvent, signal }) {
  const conversation = [...messages], events = [];
  for (let turn = 0; turn < 5; turn += 1) {
    const response = await fetchImpl(endpoint, { method: 'POST', headers, signal, body: JSON.stringify({ model, messages: conversation, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.2, ...(onToken ? { stream: true } : {}) }) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || 'OpenRouter پاسخ ناموفق داد'); }
    let message;
    if (onToken) {
      message = { role: 'assistant', content: '', tool_calls: [] };
      await readEventStream(response.body, data => {
        if (data.error) throw new Error(data.error.message || 'Model stream failed');
        const delta = data.choices?.[0]?.delta;
        if (!delta) return;
        if (delta.content) { message.content += delta.content; onToken(delta.content); }
        for (const part of delta.tool_calls || []) {
          const call = message.tool_calls[part.index] ||= { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (part.id) call.id = part.id;
          call.function.name += part.function?.name || '';
          call.function.arguments += part.function?.arguments || '';
        }
      });
      message.tool_calls = message.tool_calls.filter(Boolean);
    } else { const data = await response.json(); message = data.choices?.[0]?.message; }
    if (!message) throw new Error('پاسخی از مدل دریافت نشد');
    const calls = message.tool_calls || [];
    if (!calls.length) return { reply: message.content || 'پاسخی دریافت نشد.', events };
    conversation.push({ role: 'assistant', content: message.content || '', tool_calls: calls });
    for (const call of calls) {
      let args = {}; try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      const name = call.function?.name, handler = tools[name];
      const event = eventFor(name, args);
      events.push(event);
      onEvent?.(event);
      let result;
      try { result = handler ? await handler(args) : { error: 'ابزار ناشناخته است' }; } catch (error) { result = { error: error.message }; }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('تعداد فراخوانی ابزارها از حد مجاز گذشت');
}

module.exports = { runAgent, toolDefinitions };
