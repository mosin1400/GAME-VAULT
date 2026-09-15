const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { run, projectStats } = require('../backend/tools/system-tools');

(async () => {
  const result = await run(process.execPath, ['--version']);
  assert.equal(result.ok, true);
  assert.match(result.stdout, /^v\d+/);
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-system-tools-test-'));
  try {
    await fs.writeFile(path.join(fixture, 'image.png'), Buffer.from([0, 255, 128]));
    await fs.writeFile(path.join(fixture, 'code.js'), 'hello');
    const stats = await projectStats(fixture);
    assert.equal(stats.files, 2);
    assert.equal(stats.bytes, 8);
    assert.equal(stats.assets, 3);
    assert.equal(stats.byType.png, 3);
  } finally {
    if (path.dirname(fixture) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith('gv-system-tools-test-')) throw Error('UNSAFE_CLEANUP');
    await fs.rm(fixture, { recursive: true, force: true });
  }
  console.log('system tools passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
