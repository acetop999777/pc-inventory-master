import type { Pool, PoolClient } from 'pg';

type DbPool = Pool;
type DbClient = PoolClient;

async function withTransaction<T>(pool: DbPool, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Preserve the original error, but log rollback issues for visibility.
      console.error('[tx] rollback failed', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export { withTransaction };
