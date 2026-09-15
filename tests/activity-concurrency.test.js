const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createCommunityStore } = require('../backend/community/store');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-activity-'));
  try {
    const file = path.join(root, 'community.json'), store = createCommunityStore({ file });
    await Promise.all(Array.from({ length: 40 }, (_, i) => store.event('demo', i % 2 ? 'download' : 'play', 'v2')));
    const weekly = await store.weekly();
    assert.equal(weekly.days.reduce((sum, day) => sum + day.play + day.download, 0), 40);
    assert.equal((await store.activity('demo')).playCount, 20);
    assert.ok((await store.exportData()).events.every(event => event.version === 'v2'));
    await assert.rejects(store.event('demo', 'unknown'), /Invalid/);
    await fs.writeFile(file, 'corrupt fixture');
    await assert.rejects(store.event('demo', 'play'), SyntaxError);
    assert.equal(await fs.readFile(file, 'utf8'), 'corrupt fixture');
    console.log('Weekly activity concurrency and corruption safety passed');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
