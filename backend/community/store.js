const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function createCommunityStore({ file }) {
  const dayKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  async function read() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { ratings: {}, comments: [], events: [] }; throw error; }
  }
  async function write(data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(data, null, 2));
    await fs.rename(temporary, file);
  }
  async function rate(game, userId, value) {
    const data = await read();
    const rating = Math.max(1, Math.min(5, Number(value)));
    if (!Number.isInteger(rating)) throw new Error('امتیاز باید عددی بین ۱ تا ۵ باشد');
    data.ratings[game] ||= {};
    data.ratings[game][userId] = { value: rating, at: new Date().toISOString() };
    await write(data);
    return summary(data, game);
  }
  function summary(data, game) {
    const values = Object.values(data.ratings[game] || {}).map(item => Number(item.value));
    return { count: values.length, average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0 };
  }
  async function rating(game) { return summary(await read(), game); }
  async function comment(game, input) {
    const text = String(input.text || '').trim();
    if (text.length < 2 || text.length > 1200) throw new Error('متن نظر باید بین ۲ تا ۱۲۰۰ حرف باشد');
    const data = await read();
    const item = { id: crypto.randomUUID(), game, author: String(input.author || 'مهمان').slice(0, 80), userId: input.userId, text, at: new Date().toISOString(), replies: [] };
    data.comments.unshift(item); await write(data); return item;
  }
  async function comments(game) { return (await read()).comments.filter(item => item.game === game); }
  async function allComments() { return (await read()).comments; }
  async function exportData() { return await read(); }
  async function reply(id, input) {
    const data = await read(), item = data.comments.find(comment => comment.id === id), text = String(input.text || '').trim();
    if (!item) throw new Error('نظر پیدا نشد'); if (text.length < 2 || text.length > 1200) throw new Error('پاسخ معتبر نیست');
    item.replies.push({ id: crypto.randomUUID(), author: String(input.author || 'ادمین').slice(0, 80), text, at: new Date().toISOString() });
    await write(data); return item;
  }
  async function remove(id) { const data = await read(); data.comments = data.comments.filter(item => item.id !== id); await write(data); }
  async function event(game, type, version) { if (!['play', 'download'].includes(type)) throw Error('Invalid activity type'); const data = await read(), now = new Date(); data.events.push({ game, version: version || null, type, at: now.toISOString(), day: dayKey(now) }); data.events = data.events.slice(-5000); await write(data); }
  async function activity(game) {
    const events = (await read()).events.filter(event => event.game === game);
    const play = events.filter(event => event.type === 'play');
    const download = events.filter(event => event.type === 'download');
    return { playCount: play.length, downloadCount: download.length, lastPlayedAt: play.at(-1)?.at || null };
  }
  async function weekly() {
    const data = await read(), days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return { key: dayKey(date), label: new Intl.DateTimeFormat('fa-IR', { weekday: 'narrow' }).format(date), play: 0, download: 0 }; });
    for (const event of data.events) { const day = days.find(item => item.key === (event.day || dayKey(new Date(event.at)))); if (day) day[event.type]++; }
    return { days };
  }
  let pending = Promise.resolve();
  const mutate = fn => { const operation = pending.then(fn); pending = operation.catch(() => {}); return operation; };
  const afterWrites = fn => (...args) => pending.then(() => fn(...args));
  return { rate: (...args) => mutate(() => rate(...args)), comment: (...args) => mutate(() => comment(...args)), reply: (...args) => mutate(() => reply(...args)), remove: (...args) => mutate(() => remove(...args)), event: (...args) => mutate(() => event(...args)), rating: afterWrites(rating), comments: afterWrites(comments), allComments: afterWrites(allComments), activity: afterWrites(activity), weekly: afterWrites(weekly), exportData: afterWrites(exportData) };
}
module.exports = { createCommunityStore };
