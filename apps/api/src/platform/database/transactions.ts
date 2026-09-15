export interface SqlClient {
  query(sql: string, values?: readonly unknown[]): Promise<unknown>;
  release(): void;
}

export interface SqlPool {
  connect(): Promise<SqlClient>;
}

const UUID_V4_OR_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function withActorTransaction<T>(pool: SqlPool, actorId: string, work: (client: SqlClient) => Promise<T>): Promise<T> {
  if (!UUID_V4_OR_V7.test(actorId)) throw new Error('INVALID_ACTOR_ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
