async function withTransaction(pool, fn) {
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

module.exports = { withTransaction };
