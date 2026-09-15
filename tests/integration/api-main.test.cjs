const assert = require('node:assert/strict');
const test = require('node:test');
const { startApi } = require('../../apps/api/dist/main');

test('API entrypoint listens on requested loopback port without legacy side effects', async () => {
  const app = await startApi({ config: { bodyLimit: 1024 }, isReady: async () => true }, { host: '127.0.0.1', port: 0 });
  try {
    const address = app.server.address();
    assert.equal(typeof address, 'object');
    assert.equal(address.address, '127.0.0.1');
    const response = await fetch(`http://127.0.0.1:${address.port}/health/live`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'live' });
  } finally {
    await app.close();
  }
});
