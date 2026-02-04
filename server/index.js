// server/index.js
const { bootstrap } = require('./bootstrap');
const { pool } = require('./db/pool');

/**
 * @param {unknown} err
 */
function handleBootstrapError(err) {
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
