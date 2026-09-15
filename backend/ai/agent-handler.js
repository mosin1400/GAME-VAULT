const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function textAttachment(data) {
  if (!data.attachmentData || String(data.attachmentType || '').startsWith('image/')) return '';
  try { return Buffer.from(String(data.attachmentData), 'base64').toString('utf8').slice(0, 50000); }
  catch { return ''; }
}

function unifiedDiff(before, after) {
  const left = String(before || '').split('\n'), right = String(after || '').split('\n'), lines = ['--- before', '+++ after'];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (left[index] === right[index]) continue;
    if (left[index] !== undefined) lines.push(`-${left[index]}`);
    if (right[index] !== undefined) lines.push(`+${right[index]}`);
  }
  return lines.join('\n');
}

function createAgentHandler({ agentMemory, projectRoot, buildAgentContext, createAgentTools, runAgent, saveAction, apiKey, model, port }) {
  return async function handle(data) {
    const game = String(data.game || ''), version = String(data.version || ''), root = projectRoot(game, version);
    let message = String(data.message || '').trim(), history = await agentMemory.read(game, version);
    if (!message) throw new Error('پیام خالی است');
    if (!apiKey) throw new Error('کلید OpenRouter در حافظهٔ سرور شناسایی نشد.');
    await agentMemory.append(game, version, { role: 'user', content: message });
    const context = await buildAgentContext(root, { maximumFileBytes: 50000, maximumTotalBytes: 100000 });
    const tools = createAgentTools({ root }), pendingActions = [];
    const propose = (type, payload) => {
      const action = { id: crypto.randomUUID(), game, version, type, approvalMode: data.approvalMode || 'manual', ...payload };
      if (type === 'write' || type === 'delete') {
        const target = path.resolve(root, String(action.path || ''));
        if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('مسیر فایل خارج از پروژه است');
        let before = '';
        try { before = fs.readFileSync(target, 'utf8'); } catch { /* new file */ }
        action.diff = unifiedDiff(before, type === 'delete' ? '' : action.content);
      }
      saveAction(action); pendingActions.push(action);
      return { status: 'pending_confirmation', id: action.id, diff: action.diff || '' };
    };
    const attachmentText = textAttachment(data);
    const userContent = data.attachmentData && String(data.attachmentType || '').startsWith('image/')
      ? [{ type: 'text', text: message || `فایل ${data.attachmentName || ''} را بررسی کن` }, { type: 'image_url', image_url: { url: `data:${data.attachmentType};base64,${data.attachmentData}` } }]
      : `${message}${attachmentText ? `\n\n[پیوست ${data.attachmentName || 'file'}]\n${attachmentText}` : ''}`;
    const system = `تو Agent پروژه هستی. Skill فعال=${data.skill || 'general'} و حالت تأیید=${data.approvalMode || 'manual'}. ابتدا برای بررسی از ابزارهای خواندنی استفاده کن. برای هر تغییر فایل یا Command فقط ابزار propose را فراخوانی کن؛ خودت هیچ تغییر اثرگذاری اعمال نکن. پس از پیشنهاد ابزار، هرگز شناسه، pending_confirmation، JSON خام یا محتوای کامل فایل را در پاسخ چاپ نکن؛ فقط یک جملهٔ طبیعی فارسی مانند «ویرایش ${'${'}path} آمادهٔ بررسی است.» بنویس. پاسخ نهایی را مختصر و شفاف بنویس.`;
    const result = await runAgent({ endpoint: 'https://openrouter.ai/api/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': `http://localhost:${port}`, 'X-Title': 'Game Vault Studio Agent' }, model: data.model || model || 'openrouter/free', messages: [{ role: 'system', content: system }, ...history.slice(-16).map(item => ({ role: item.role, content: item.content })), { role: 'system', content: `PROJECT CONTEXT: ${JSON.stringify(context.files)}` }, { role: 'user', content: userContent }], tools: { list_files: () => tools.listFiles(), read_file: args => tools.readFile(args.path), search_text: args => tools.searchText(args.query), propose_file_change: args => propose(args.operation === 'delete' ? 'delete' : 'write', { path: String(args.path || ''), content: String(args.content || '') }), propose_terminal_command: args => propose('command', { command: String(args.command || '') }) } });
    await agentMemory.append(game, version, { role: 'assistant', content: result.reply });
    return { message: result.reply, events: result.events, pendingActions, messages: await agentMemory.read(game, version), context: { files: context.paths.length }, model: data.model || model || 'openrouter/free' };
  };
}
module.exports = { createAgentHandler };
