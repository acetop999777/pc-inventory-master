const AppError = require('../errors/AppError');
const { withTransaction } = require('../db/tx');
const idempotencyRepo = require('../repositories/idempotencyRepo');
const logRepo = require('../repositories/logRepo');

function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function createLog({ pool, operationId, log, endpoint, requestId }) {
  if (!asNonEmptyString(operationId)) {
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

  return withTransaction(pool, async (tx) => {
    const idem = await idempotencyRepo.beginOperation(tx, { operationId, endpoint });
    if (idem.state === 'DONE') return idem.response;
    if (idem.state === 'IN_PROGRESS') {
      throw new AppError({
        code: 'OPERATION_IN_PROGRESS',
        httpStatus: 409,
        retryable: true,
        message: 'Operation is already in progress',
        details: { operationId },
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
        operationId,
        endpoint,
        logId: id,
      }),
    );

    const response = { success: true };
    await idempotencyRepo.markDone(tx, { operationId, response });
    return response;
  });
}

module.exports = { createLog };
