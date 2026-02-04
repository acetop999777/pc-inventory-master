import { createApp } from './app';
import { pool } from './db/pool';
import { runMigrations } from './db/migrate';
import { waitForDb } from './db/waitForDb';
import { seedIfEnabled } from './db/seed';
import { startupCleanupIfEnabled } from './db/startupCleanup';

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

export { bootstrap };
