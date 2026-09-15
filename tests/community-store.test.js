const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCommunityStore } = require('../backend/community/store');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-vault-community-'));
  const store = createCommunityStore({ file: path.join(root, 'community.json') });
  await store.rate('demo', 'guest:one', 5);
  await store.rate('demo', 'admin-local', 3);
  await store.event('demo', 'play');
  await store.event('demo', 'download');
  const activity = await store.activity('demo');
  assert.equal(activity.playCount, 1);
  assert.equal(activity.downloadCount, 1);
  assert.ok(activity.lastPlayedAt);
  const rating = await store.rating('demo');
  assert.equal(rating.count, 2);
  assert.equal(rating.average, 4);
  const comment = await store.comment('demo', { author: 'مهمان', userId: 'guest:one', text: 'بازی خوب است' });
  await store.reply(comment.id, { author: 'ادمین', text: 'ممنون' });
  assert.equal((await store.comments('demo'))[0].replies[0].text, 'ممنون');
  await store.event('demo', 'play');
  assert.equal((await store.weekly()).days.reduce((sum, day) => sum + day.play, 0), 2);
  console.log('community store passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
