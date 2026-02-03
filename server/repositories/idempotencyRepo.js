/**
 * @typedef {import('pg').PoolClient} DbClient
 * @typedef {{ operationId: string, endpoint?: string | null }} BeginOperationInput
 * @typedef {{ state: 'NEW' | 'DONE' | 'IN_PROGRESS', response?: unknown }} BeginOperationResult
 * @typedef {{ operationId: string, response: unknown }} MarkDoneInput
 */

/**
 * @param {DbClient} tx
 * @param {BeginOperationInput} params
 * @returns {Promise<BeginOperationResult>}
 */
async function beginOperation(tx, { operationId, endpoint }) {
  const insertRes = await tx.query(
    `INSERT INTO idempotency_keys (operation_id, endpoint, status)
     VALUES ($1, $2, 'IN_PROGRESS')
     ON CONFLICT (operation_id) DO NOTHING`,
    [operationId, endpoint || null],
  );

  if (insertRes.rowCount === 1) {
    return { state: 'NEW' };
  }

  const { rows } = await tx.query(
    'SELECT status, response_json FROM idempotency_keys WHERE operation_id = $1',
    [operationId],
  );

  const row = rows[0];
  if (!row) return { state: 'NEW' };

  if (row.status === 'DONE' && row.response_json) {
    return { state: 'DONE', response: row.response_json };
  }

  return { state: 'IN_PROGRESS' };
}

/**
 * @param {DbClient} tx
 * @param {MarkDoneInput} params
 * @returns {Promise<void>}
 */
async function markDone(tx, { operationId, response }) {
  await tx.query(
    `UPDATE idempotency_keys
     SET status = 'DONE', response_json = $2
     WHERE operation_id = $1`,
    [operationId, response],
  );
}

module.exports = {
  beginOperation,
  markDone,
};
