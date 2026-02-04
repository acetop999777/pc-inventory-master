/**
 * @param {import('pg').Pool} pool
 * @param {{ attempts?: number, delayMs?: number }} opts
 */
async function waitForDb(pool, { attempts = 30, delayMs = 1000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`[db] not ready (${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('DB not ready after retries');
}

module.exports = { waitForDb };
