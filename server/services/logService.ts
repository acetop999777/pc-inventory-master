import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import AppError = require('../errors/AppError');
import { withTransaction } from '../db/tx';
import * as idempotencyRepo from '../repositories/idempotencyRepo';
import * as logRepo from '../repositories/logRepo';

type DbPool = Pool;
type DbClient = PoolClient;
type LogInput = {
  id?: unknown;
  timestamp?: unknown;
  type?: unknown;
  title?: unknown;
  msg?: unknown;
  meta?: unknown;
};
type CreateLogInput = {
  pool: DbPool;
  operationId: unknown;
  log: LogInput;
  endpoint?: unknown;
  requestId?: unknown;
};

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function asNonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function logWriteMetric(tx: DbClient, payload: Record<string, unknown>): Promise<void> {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'logs',
      ...payload,
    }),
  );
  try {
    await logRepo.insert(tx, {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'metric',
      title: typeof payload.event === 'string' ? payload.event : 'logs.metric',
      msg: null,
      meta: payload,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'logs',
        event: 'logs.metric.persist.error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * @param {CreateLogInput} params
 * @returns {Promise<unknown>}
 */
async function createLog({
  pool,
  operationId,
  log,
  endpoint,
  requestId,
}: CreateLogInput): Promise<unknown> {
  const startMs = Date.now();
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
    if (idem.state === 'DONE') {
      await logWriteMetric(tx, {
        event: 'logs.create.metrics',
        requestId,
        operationId: opId,
        endpoint: endpointSafe,
        durationMs: Date.now() - startMs,
        idempotencyHit: true,
        status: 'success',
      });
      return idem.response;
    }
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
    await logWriteMetric(tx, {
      event: 'logs.create.metrics',
      requestId,
      operationId: opId,
      endpoint: endpointSafe,
      durationMs: Date.now() - startMs,
      idempotencyHit: false,
      status: 'success',
    });
    return response;
  });
}

export { createLog };
