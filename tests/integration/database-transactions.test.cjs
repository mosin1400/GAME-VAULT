const assert = require('node:assert/strict');
const test = require('node:test');
const { withActorTransaction } = require('../../apps/api/dist/platform/database/transactions');

function fixture() {
  const calls = [];
  const client = {
    async query(sql, values) { calls.push({ sql, values }); },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  return { calls, pool: { async connect() { calls.push({ sql: 'CONNECT' }); return client; } } };
}

test('transaction binds a validated actor locally before domain work and releases the connection', async () => {
  const { calls, pool } = fixture();
  await withActorTransaction(pool, '11111111-1111-4111-8111-111111111111', async client => {
    await client.query('DOMAIN WORK');
  });
  assert.deepEqual(calls, [
    { sql: 'CONNECT' },
    { sql: 'BEGIN', values: undefined },
    { sql: "SELECT set_config('app.actor_id', $1, true)", values: ['11111111-1111-4111-8111-111111111111'] },
    { sql: 'DOMAIN WORK', values: undefined },
    { sql: 'COMMIT', values: undefined },
    { sql: 'RELEASE' }
  ]);
});

test('failed domain work rolls back and an invalid actor never checks out a connection', async () => {
  const { calls, pool } = fixture();
  await assert.rejects(() => withActorTransaction(pool, '11111111-1111-4111-8111-111111111111', async () => { throw Error('failed'); }), /failed/);
  assert.equal(calls.at(-2).sql, 'ROLLBACK');
  assert.equal(calls.at(-1).sql, 'RELEASE');
  const untouched = fixture();
  await assert.rejects(() => withActorTransaction(untouched.pool, 'not-a-uuid', async () => {}), /INVALID_ACTOR_ID/);
  assert.deepEqual(untouched.calls, []);
});
