const AppError = require('../errors/AppError');
const { withTransaction } = require('../db/tx');
const idempotencyRepo = require('../repositories/idempotencyRepo');
const logRepo = require('../repositories/logRepo');

/**
 * @typedef {import('pg').Pool} DbPool
 * @typedef {{
 *   id?: unknown,
 *   timestamp?: unknown,
 *   type?: unknown,
 *   title?: unknown,
 *   msg?: unknown,
 *   meta?: unknown
 * }} LogInput
 * @typedef {{
 *   pool: DbPool,
 *   operationId: unknown,
 *   log: LogInput,
 *   endpoint?: unknown,
 *   requestId?: unknown
 * }} CreateLogInput
 */

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * @param {CreateLogInput} params
 * @returns {Promise<unknown>}
 */
async function createLog({ pool, operationId, log, endpoint, requestId }) {
  const opId = asNonEmptyString(operationId);
  if (!opId) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'operationId is required',
      details: { field: 'operationId' },
    });
  }

  const id = asNonEmptyString(log?.id);
  if (!id) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'log id is required',
      details: { field: 'id' },
    });
  }

  const endpointSafe = asNonEmptyString(endpoint);

  return withTransaction(pool, async (tx) => {
    const idem = await idempotencyRepo.beginOperation(tx, { operationId: opId, endpoint: endpointSafe });
    if (idem.state === 'DONE') return idem.response;
    if (idem.state === 'IN_PROGRESS') {
      throw new AppError({
        code: 'OPERATION_IN_PROGRESS',
        httpStatus: 409,
        retryable: true,
        message: 'Operation is already in progress',
        details: { operationId: opId },
      });
    }

    await logRepo.insert(tx, {
      id,
      timestamp: log.timestamp ?? Date.now(),
      type: log.type || null,
      title: log.title || null,
      msg: log.msg || null,
      meta: log.meta || null,
    });

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'logs',
        event: 'logs.create.success',
        requestId,
        operationId: opId,
        endpoint: endpointSafe,
        logId: id,
      }),
    );

    const response = { success: true };
    await idempotencyRepo.markDone(tx, { operationId: opId, response });
    return response;
  });
}

module.exports = { createLog };
