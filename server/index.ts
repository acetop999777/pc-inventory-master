// server/index.js
import { bootstrap } from './bootstrap';
import { pool } from './db/pool';

/**
 * @param {unknown} err
 */
function handleBootstrapError(err: unknown) {
  console.error('[bootstrap] failed', err);
  process.exit(1);
}

bootstrap().catch(handleBootstrapError);

// graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});
process.on('SIGINT', async () => {
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});
