import { createApp } from './app';
import { pool } from './db/pool';
import { runMigrations } from './db/migrate';
import { waitForDb } from './db/waitForDb';
import { seedIfEnabled } from './db/seed';
import { startupCleanupIfEnabled } from './db/startupCleanup';

async function bootstrap() {
  await waitForDb(pool);
  const initDbFlag = String(process.env.INIT_DB || '').toLowerCase();
  if (initDbFlag === '1' || initDbFlag === 'true' || initDbFlag === 'yes') {
    throw new Error('[bootstrap] INIT_DB is no longer supported; migrations are the only schema source.');
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
