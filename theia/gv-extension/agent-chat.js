const { readEventStream } = require('../../backend/ai/event-stream');
const { renderMarkdown } = require('./markdown-renderer');

function installAgentChat(AgentWidget, { project, apiFetch, API, addCodexStep }) {
  const prototype = AgentWidget.prototype;
  const baseRender = prototype.render;
  const request = async (path, method, data) => {
    const response = await apiFetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Request failed');
    return result;
  };
  const payload = widget => ({ ...project(), sessionId: widget.sessionId || 'default' });

  prototype.render = function () {
    this.sessionId = localStorage.getItem(`gv-chat-session:${project().game}:${project().version}`) || 'default';
    baseRender.call(this);
    const context = document.createElement('div'); context.className = 'gv-chat-context';
    context.textContent = [project().game, project().version].filter(Boolean).join(' · ');
    this.node.querySelector('.gv-head').append(context);
    const controls = document.createElement('div'); controls.className = 'gv-session-controls';
    controls.innerHTML = '<input class="gv-session-search" type="search" placeholder="Search" aria-label="Search chats"><select aria-label="Chat session"><option value="default">گفتگوی تازه</option></select><button type="button" data-chat="new" title="New chat">＋</button><button type="button" data-chat="rename" title="Rename chat">✎</button><button type="button" data-chat="pin" title="Pin chat">☆</button><button type="button" data-chat="archive" title="Archive chat">⌫</button>';
    this.node.querySelector('.gv-head').after(controls);
    this.sessionsSelect = controls.querySelector('select');
    this.sessionsSelect.onchange = async () => {
      if (this.busy) { this.sessionsSelect.value = this.sessionId; return; }
      this.sessionId = this.sessionsSelect.value; this.editing = ''; this.rememberSession(); await this.restore();
    };
    this.sessionSearch = controls.querySelector('.gv-session-search');
    this.sessionSearch.oninput = () => this.drawSessions();
    controls.querySelector('[data-chat="new"]').onclick = async () => {
      if (this.busy) return;
      try { const result = await request('/api/agent/sessions', 'POST', project()); this.sessionId = result.id; this.editing = ''; this.rememberSession(); await this.refreshSessions(); await this.restore(); }
      catch (error) { this.add(error.message, 'task'); }
    };
    controls.querySelector('[data-chat="rename"]').onclick = async () => {
      if (this.busy || this.sessionId === 'default') return;
      const current = this.sessions.find(item => item.id === this.sessionId), title = window.prompt('Chat name', current?.title || '');
      if (title === null) return;
      try { await request('/api/agent/sessions', 'PATCH', { ...payload(this), title }); await this.refreshSessions(); }
      catch (error) { this.add(error.message, 'task'); }
    };
    controls.querySelector('[data-chat="pin"]').onclick = async event => {
      if (this.busy || this.sessionId === 'default') return;
      const current = this.sessions.find(item => item.id === this.sessionId);
      try { await request('/api/agent/sessions', 'PATCH', { ...payload(this), pinned: !current?.pinned }); await this.refreshSessions(); event.currentTarget.textContent = current?.pinned ? '☆' : '★'; }
      catch (error) { this.add(error.message, 'task'); }
    };
    controls.querySelector('[data-chat="archive"]').onclick = async () => {
      if (this.busy || this.sessionId === 'default' || !window.confirm('این گفتگو بایگانی شود؟')) return;
      try { await request('/api/agent/sessions', 'PATCH', { ...payload(this), archived: true }); this.sessionId = 'default'; this.rememberSession(); await this.refreshSessions(); await this.restore(); }
      catch (error) { this.add(error.message, 'task'); }
    };
    const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'gv-icon'; stop.textContent = '■'; stop.title = 'Stop response'; stop.hidden = true;
    stop.onclick = () => this.controller?.abort(); this.stopButton = stop;
    this.node.querySelector('.gv-compose-footer').appendChild(stop);
    this.file.onchange = () => { this.attachment = this.file.files[0]; this.renderAttachment(); };
    this.renderAttachment();
    this.refreshSessions().catch(error => this.add(error.message, 'task'));
  };
  prototype.renderAttachment = function () {
    const holder = this.node.querySelector('#gv-file-name'); if (!holder) return;
    holder.replaceChildren();
    if (!this.attachment) return;
    const chip = document.createElement('span'); chip.className = 'gv-file-chip';
    chip.textContent = `📎 ${this.attachment.name} · ${Math.ceil(this.attachment.size / 1024)} KB`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove attachment';
    remove.onclick = () => { this.attachment = null; this.file.value = ''; this.renderAttachment(); };
    chip.appendChild(remove); holder.appendChild(chip);
  };
  prototype.rememberSession = function () { localStorage.setItem(`gv-chat-session:${project().game}:${project().version}`, this.sessionId); };
  prototype.refreshSessions = async function () {
    const p = project(); if (!p.game || !p.version) return;
    const response = await apiFetch(`${API}/api/agent/sessions?${new URLSearchParams(p)}`), data = await response.json();
    if (!response.ok) throw Error(data.error || 'Cannot load chats');
    this.sessions = data.sessions || [];
    const previous = this.sessionId;
    if (!this.sessions.some(session => session.id === this.sessionId)) { this.sessionId = this.sessions[0]?.id || 'default'; this.rememberSession(); }
    if (!this.sessions.length) this.sessions.push({ id: 'default', title: 'New chat' });
    this.drawSessions();
    if (previous !== this.sessionId) await this.restore();
  };
  prototype.drawSessions = function () {
    const query = String(this.sessionSearch?.value || '').trim().toLocaleLowerCase();
    const visible = this.sessions.filter(session => !query || session.title.toLocaleLowerCase().includes(query));
    this.sessionsSelect.replaceChildren();
    for (const session of visible) { const option = document.createElement('option'); option.value = session.id; option.textContent = `${session.pinned ? '★ ' : ''}${session.title}`; option.selected = session.id === this.sessionId; this.sessionsSelect.appendChild(option); }
    if (!visible.some(session => session.id === this.sessionId) && visible[0]) this.sessionsSelect.value = visible[0].id;
  };
  prototype.restore = async function () {
    const p = payload(this); if (!p.game || !p.version || this.busy) return;
    try { const response = await apiFetch(`${API}/api/agent/conversation?${new URLSearchParams(p)}`), data = await response.json(); if (!response.ok) throw Error(data.error || 'Cannot load chat'); if (p.sessionId === this.sessionId) this.show(data.messages); }
    catch (error) { this.add(error.message, 'task'); }
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
  prototype.addRetry = function (message) {
    const task = document.createElement('article'); task.className = 'gv-task gv-retry'; task.textContent = 'Response interrupted. ';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry';
    retry.onclick = () => { this.input.value = message; this.input.focus(); task.remove(); };
    task.appendChild(retry); this.log.appendChild(task); this.log.scrollTop = this.log.scrollHeight;
  };
  prototype.send = async function (options = {}) {
    const message = this.input.value.trim(), p = payload(this);
    if (this.busy || (!message && !options.regenerateOf) || !p.game || !p.version) return;
    this.busy = true; this.controller = new AbortController(); this.stopButton.hidden = false; this.node.querySelector('.gv-send').disabled = true; this.sessionsSelect.disabled = true;
    let draft, text = '', resultReceived = false;
    const flushDraft = () => { if (draft && text) draft.innerHTML = renderMarkdown(text); };
    try {
      const attach = await this.encodeAttachment();
      if (!options.regenerateOf) this.add({ content: message, attachment: attach.attachmentData ? { name: attach.attachmentName, type: attach.attachmentType, size: attach.attachmentSize } : undefined }, 'user');
      this.input.value = ''; addCodexStep(this, { type: 'pending' });
      const response = await apiFetch(`${API}/api/agent/message`, { method: 'POST', signal: this.controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, message, stream: true, model: this.model.value, skill: this.skill.value, approvalMode: this.approvalMode, replaceMessageId: this.editing || '', ...attach, ...options }) });
      if (!response.ok) { const error = await response.json(); throw Error(error.error || 'Agent request failed'); }
      await readEventStream(response.body, (data, event) => {
        if (event === 'error') throw Error(data.error || 'Stream failed');
        if (event === 'token') {
          if (!draft) { draft = document.createElement('article'); draft.className = 'gv-ai gv-streaming'; this.log.appendChild(draft); }
          text += data.token; draft.textContent = text; this.log.scrollTop = this.log.scrollHeight;
        } else if (event === 'activity') {
          flushDraft(); draft = null; text = '';
          if (data.type === 'action') this.actionCard(data.action); else addCodexStep(this, data);
        } else if (event === 'result') {
          resultReceived = true; flushDraft();
          if (!draft && !(data.timeline || []).some(item => item.type === 'text')) this.add(data.message, 'ai');
          this.editing = ''; this.attachment = null; this.file.value = ''; this.renderAttachment();
        }
      });
      if (!resultReceived) throw Error('Connection ended before the response completed');
      await this.refreshSessions();
    } catch (error) {
      flushDraft(); if (draft) draft.classList.remove('gv-streaming');
      this.add(error.name === 'AbortError' ? 'Response stopped' : `Failed: ${error.message}`, 'task'); this.addRetry(message);
    } finally {
      this.busy = false; this.stopButton.hidden = true; this.sessionsSelect.disabled = false; this.node.querySelector('.gv-send').disabled = false; this.controller = null;
    }
  };
}
module.exports = { installAgentChat };
