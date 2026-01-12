const fs = require('fs');
const path = require('path');

/**
 * Runs SQL migrations in server/db/migrations/*.sql
 * - Idempotent via schema_migrations table (filename PK)
 * - Protected by pg_advisory_lock to avoid concurrent runners
 */
async function runMigrations(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    : [];

  if (files.length === 0) {
    console.log('[migrate] no migration files found');
    return;
  }

  const client = await pool.connect();
  const LOCK_KEY = 724001337; // arbitrary constant bigint-ish

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const doneRes = await client.query('SELECT filename FROM schema_migrations');
    const done = new Set(doneRes.rows.map((r) => r.filename));

    for (const file of files) {
      if (done.has(file)) continue;

      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');

      console.log(`[migrate] running ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] ok ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] failed ${file}`, err);
        throw err;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    } catch (_) {}
    client.release();
  }
}

module.exports = { runMigrations };
