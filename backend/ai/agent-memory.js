const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createAgentMemory({ root, now = () => new Date().toISOString(), limit = 40 }) {
  function fileFor(game, version, sessionId = 'default') {
    if (sessionId === 'default' || !sessionId) return path.join(root, String(game), `${String(version)}.json`);
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid session identifier');
    return path.join(root, String(game), String(version), `${sessionId}.json`);
  }

  function sessionMetaFile(game, version) {
    return path.join(root, String(game), String(version), '.sessions.json');
  }

  async function readSessionMeta(game, version) {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(sessionMetaFile(game, version), 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }

  async function writeSessionMeta(game, version, metadata) {
    const file = sessionMetaFile(game, version);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(metadata, null, 2));
  }

  function safeAttachment(attachment) {
    if (!attachment || typeof attachment !== 'object') return undefined;
    const name = String(attachment.name || '').trim().slice(0, 180);
    if (!name) return undefined;
    const size = Number(attachment.size);
    return {
      name,
      type: String(attachment.type || 'application/octet-stream').slice(0, 120),
      size: Number.isFinite(size) && size >= 0 ? size : 0
    };
  }

  async function read(game, version, sessionId) {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(fileFor(game, version, sessionId), 'utf8'));
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.content === 'string' && ['user', 'assistant'].includes(item.role)).map(item => ({ ...item, id: item.id || crypto.randomUUID() })) : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function write(game, version, messages, sessionId) {
    const file = fileFor(game, version, sessionId);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(messages.slice(-limit), null, 2));
  }

  async function append(game, version, message, sessionId) {
    const messages = await read(game, version, sessionId);
    const entry = { id: crypto.randomUUID(), role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content || '').trim(), createdAt: now() };
    if (Array.isArray(message.timeline)) entry.timeline = message.timeline.slice(0, 200);
    const attachment = safeAttachment(message.attachment);
    if (attachment) entry.attachment = attachment;
    if (!entry.content) return messages;
    messages.push(entry);
    await write(game, version, messages, sessionId);
    return messages.slice(-limit);
  }

  async function clear(game, version, sessionId) {
    try { await fs.promises.rm(fileFor(game, version, sessionId), { force: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  async function editAndTrim(game, version, id, content, sessionId) {
    const messages = await read(game, version, sessionId);
    const index = messages.findIndex(item => item.id === id && item.role === 'user');
    if (index < 0) return null;
    const next = messages.slice(0, index + 1);
    next[index] = { ...next[index], content: String(content || '').trim(), editedAt: now() };
    if (!next[index].content) return null;
    await write(game, version, next, sessionId);
    return next;
  }

  async function remove(game, version, id, sessionId) {
    const messages = await read(game, version, sessionId);
    const next = messages.filter(item => item.id !== id);
    if (next.length === messages.length) return null;
    await write(game, version, next, sessionId);
    return next;
  }

  async function createSession(game, version) {
    const id = crypto.randomUUID();
    await write(game, version, [], id);
    return { id, title: 'New chat' };
  }

  async function updateSession(game, version, sessionId, changes = {}) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('The default chat cannot be changed');
    const metadata = await readSessionMeta(game, version);
    const current = metadata[sessionId] && typeof metadata[sessionId] === 'object' ? metadata[sessionId] : {};
    const next = { ...current };
    if (Object.hasOwn(changes, 'title')) {
      const title = String(changes.title || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!title) throw new Error('Chat title is required');
      next.title = title;
    }
    if (Object.hasOwn(changes, 'pinned')) next.pinned = Boolean(changes.pinned);
    if (Object.hasOwn(changes, 'archived')) next.archived = Boolean(changes.archived);
    metadata[sessionId] = next;
    await writeSessionMeta(game, version, metadata);
    return { id: sessionId, ...next };
  }

  async function listSessions(game, version) {
    let files = [];
    try { files = await fs.promises.readdir(path.join(root, String(game), String(version))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const ids = files.filter(file => /^[0-9a-f-]{36}\.json$/i.test(file)).map(file => file.slice(0, -5));
    try { await fs.promises.access(fileFor(game, version)); ids.unshift('default'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const metadata = await readSessionMeta(game, version);
    const sessions = await Promise.all(ids.map(async id => {
      const messages = await read(game, version, id);
      const meta = metadata[id] || {};
      return { id, title: meta.title || messages.find(item => item.role === 'user')?.content.slice(0, 50) || (id === 'default' ? 'Previous chat' : 'New chat'), updatedAt: messages.at(-1)?.createdAt || '', pinned: Boolean(meta.pinned), archived: Boolean(meta.archived) };
    }));
    return sessions.filter(session => !session.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  return { read, append, clear, editAndTrim, remove, createSession, updateSession, listSessions };
}

module.exports = { createAgentMemory };
