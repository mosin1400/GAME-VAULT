const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createAgentMemory({ root, now = () => new Date().toISOString(), limit = 40 }) {
  function fileFor(game, version) {
    return path.join(root, String(game), `${String(version)}.json`);
  }

  async function read(game, version) {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(fileFor(game, version), 'utf8'));
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.content === 'string' && ['user', 'assistant'].includes(item.role)).map(item => ({ ...item, id: item.id || crypto.randomUUID() })) : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function write(game, version, messages) {
    const file = fileFor(game, version);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(messages.slice(-limit), null, 2));
  }

  async function append(game, version, message) {
    const messages = await read(game, version);
    const entry = { id: crypto.randomUUID(), role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content || '').trim(), createdAt: now() };
    if (!entry.content) return messages;
    messages.push(entry);
    await write(game, version, messages);
    return messages.slice(-limit);
  }

  async function clear(game, version) {
    try { await fs.promises.rm(fileFor(game, version), { force: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  async function editAndTrim(game, version, id, content) {
    const messages = await read(game, version);
    const index = messages.findIndex(item => item.id === id && item.role === 'user');
    if (index < 0) return null;
    const next = messages.slice(0, index + 1);
    next[index] = { ...next[index], content: String(content || '').trim(), editedAt: now() };
    if (!next[index].content) return null;
    await write(game, version, next);
    return next;
  }

  async function remove(game, version, id) {
    const messages = await read(game, version);
    const next = messages.filter(item => item.id !== id);
    if (next.length === messages.length) return null;
    await write(game, version, next);
    return next;
  }

  return { read, append, clear, editAndTrim, remove };
}

module.exports = { createAgentMemory };
