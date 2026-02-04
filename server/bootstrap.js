const { createApp } = require('./app');
const { pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');
const { waitForDb } = require('./db/waitForDb');
const { seedIfEnabled } = require('./db/seed');
const { startupCleanupIfEnabled } = require('./db/startupCleanup');

function isInitDbRequested() {
  const raw = String(process.env.INIT_DB || '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function bootstrap() {
  await waitForDb(pool);
  if (isInitDbRequested()) {
    console.warn('[bootstrap] INIT_DB is deprecated; migrations only. Skipping initDB().');
  }
  await runMigrations(pool);
  await startupCleanupIfEnabled(pool); // ✅ 默认不跑（STARTUP_CLEANUP=true 才跑）
  await seedIfEnabled(pool);

  const app = createApp({ pool });
  const PORT = Number(process.env.PORT || 5000);
  const server = app.listen(PORT, () => console.log(`Server on ${PORT}`));
  return { app, server };
}

module.exports = { bootstrap };
