const { readEventStream } = require('../../backend/ai/event-stream');
const { renderMarkdown } = require('./markdown-renderer');

function installAgentChat(AgentWidget, { project, apiFetch, API, addCodexStep }) {
  const prototype = AgentWidget.prototype;
  const render = prototype.render;
  const request = async (path, method, data) => {
    const response = await apiFetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || 'Request failed'); return result;
  };
  const payload = widget => ({ ...project(), sessionId: widget.sessionId || 'default' });
  prototype.render = function () {
    this.sessionId = localStorage.getItem(`gv-chat-session:${project().game}:${project().version}`) || 'default';
    render.call(this);
    const controls = document.createElement('div'); controls.className = 'gv-session-controls';
    controls.innerHTML = '<select aria-label="Chat session"><option value="default">گفتگوی تازه</option></select><button class="gv-new-chat" title="New chat">＋ New chat</button><button class="gv-delete-chat" title="Delete chat">⌫</button>';
    this.node.querySelector('.gv-head').after(controls);
    this.sessionsSelect = controls.querySelector('select');
    this.sessionsSelect.onchange = async () => {
      if (this.busy) { this.sessionsSelect.value = this.sessionId; return; }
      this.sessionId = this.sessionsSelect.value; this.editing = ''; this.rememberSession(); await this.restore();
    };
    controls.querySelectorAll('button')[0].onclick = async () => {
      if (this.busy) return;
      try { const result = await request('/api/agent/sessions', 'POST', project()); this.sessionId = result.id; this.editing = ''; this.rememberSession(); await this.refreshSessions(); await this.restore(); }
      catch (error) { this.add(error.message, 'task'); }
    };
    controls.querySelectorAll('button')[1].onclick = async () => {
      if (this.busy || !window.confirm('این گفتگو حذف شود؟')) return;
      try { await request('/api/agent/sessions', 'DELETE', payload(this)); this.sessionId = 'default'; this.editing = ''; this.rememberSession(); await this.refreshSessions(); await this.restore(); }
      catch (error) { this.add(error.message, 'task'); }
    };
    const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'gv-icon'; stop.textContent = '■'; stop.title = 'Stop response'; stop.hidden = true;
    stop.onclick = () => this.controller?.abort(); this.stopButton = stop;
    this.node.querySelector('.gv-compose-footer').appendChild(stop);
    this.refreshSessions().catch(error => this.add(error.message, 'task'));
  };
  prototype.rememberSession = function () { localStorage.setItem(`gv-chat-session:${project().game}:${project().version}`, this.sessionId); };
  prototype.refreshSessions = async function () {
    const p = project(); if (!p.game || !p.version) return;
    const response = await apiFetch(`${API}/api/agent/sessions?${new URLSearchParams(p)}`), data = await response.json();
    if (!response.ok) throw Error(data.error || 'Cannot load chats');
    const sessions = data.sessions || [];
    const previous = this.sessionId;
    if (!sessions.some(session => session.id === this.sessionId)) { this.sessionId = sessions[0]?.id || 'default'; this.rememberSession(); }
    if (!sessions.length) sessions.push({ id: 'default', title: 'New chat' });
    this.sessionsSelect.replaceChildren();
    for (const session of sessions) { const option = document.createElement('option'); option.value = session.id; option.textContent = session.title; option.selected = session.id === this.sessionId; this.sessionsSelect.appendChild(option); }
    if (previous !== this.sessionId) await this.restore();
  };
  prototype.restore = async function () {
    const p = payload(this); if (!p.game || !p.version || this.busy) return;
    try {
      const response = await apiFetch(`${API}/api/agent/conversation?${new URLSearchParams(p)}`), data = await response.json();
      if (!response.ok) throw Error(data.error || 'Cannot load chat');
      if (p.sessionId === this.sessionId) this.show(data.messages);
    } catch (error) { this.add(error.message, 'task'); }
  };
  prototype.clear = async function () {
    if (this.busy || !window.confirm('پیام‌های این گفتگو پاک شوند؟')) return;
    try { await request('/api/agent/conversation', 'DELETE', payload(this)); this.show([]); await this.refreshSessions(); }
    catch (error) { this.add(error.message, 'task'); }
  };
  prototype.remove = async function (id) {
    if (this.busy) return;
    try { const data = await request('/api/agent/message', 'DELETE', { ...payload(this), id }); this.show(data.messages); }
    catch (error) { this.add(error.message, 'task'); }
  };
  prototype.send = async function (options = {}) {
    const message = this.input.value.trim(), p = payload(this);
    if (this.busy || (!message && !options.regenerateOf) || !p.game || !p.version) return;
    this.busy = true; this.controller = new AbortController();
    this.stopButton.hidden = false; this.node.querySelector('.gv-send').disabled = true;
    this.sessionsSelect.disabled = true;
    let draft, text = '', resultReceived = false;
    try {
      const attach = await this.encodeAttachment();
      if (!options.regenerateOf) this.add(message, 'user');
      this.input.value = ''; addCodexStep(this, { type: 'pending' });
      const response = await apiFetch(`${API}/api/agent/message`, { method: 'POST', signal: this.controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, message, stream: true, model: this.model.value, skill: this.skill.value, approvalMode: this.approvalMode, replaceMessageId: this.editing || '', ...attach, ...options }) });
      if (!response.ok) { const error = await response.json(); throw Error(error.error || 'Agent request failed'); }
      await readEventStream(response.body, (data, event) => {
        if (event === 'error') throw Error(data.error || 'Stream failed');
        if (event === 'token') {
          if (!draft) { draft = document.createElement('article'); draft.className = 'gv-ai'; this.log.appendChild(draft); }
          text += data.token; draft.innerHTML = renderMarkdown(text); this.log.scrollTop = this.log.scrollHeight;
        } else if (event === 'activity') {
          draft = null; text = '';
          if (data.type === 'action') this.actionCard(data.action); else addCodexStep(this, data);
        }
        else if (event === 'result') {
          resultReceived = true;
          // Keep the actual streamed timeline. Re-rendering messages here used
          // to move every tool step to the bottom and destroy the interleaving.
          if (!draft && !(data.timeline || []).some(item => item.type === 'text')) this.add(data.message, 'ai');
          this.editing = ''; this.attachment = null; this.file.value = ''; this.node.querySelector('#gv-file-name').textContent = '';
        }
      });
      if (!resultReceived) throw Error('Connection ended before the response completed');
      await this.refreshSessions();
    } catch (error) {
      this.add(error.name === 'AbortError' ? 'Response stopped' : `Failed: ${error.message}`, 'task');
    } finally {
      this.busy = false; this.stopButton.hidden = true; this.sessionsSelect.disabled = false; this.node.querySelector('.gv-send').disabled = false; this.controller = null;
    }
  };
}
module.exports = { installAgentChat };
