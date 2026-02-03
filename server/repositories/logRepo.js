/**
 * @typedef {import('pg').PoolClient} DbClient
 * @typedef {{
 *   id: string,
 *   timestamp: unknown,
 *   type: unknown,
 *   title: unknown,
 *   msg: unknown,
 *   meta: unknown
 * }} LogInput
 */

/**
 * @param {DbClient} tx
 * @param {LogInput} log
 * @returns {Promise<void>}
 */
async function insert(tx, log) {
  const { id, timestamp, type, title, msg, meta } = log;
  await tx.query(
    'INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, timestamp, type, title, msg, meta],
  );
}

module.exports = { insert };
