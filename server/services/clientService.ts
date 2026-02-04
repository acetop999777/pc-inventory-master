import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import AppError = require('../errors/AppError');
import { withTransaction } from '../db/tx';
import { assertClientInput } from '../validators/clientValidator';
import { asNonEmptyString } from '../validators/requestUtils';
import * as logRepo from '../repositories/logRepo';

type DbPool = Pool;
type DbClient = PoolClient;
type ClientPayload = Record<string, unknown>;
type UpsertClientInput = {
  pool: DbPool;
  payload: ClientPayload;
  requestId?: unknown;
  endpoint?: unknown;
};
type DeleteClientInput = {
  pool: DbPool;
  id?: unknown;
  operationId?: unknown;
  requestId?: unknown;
  endpoint?: unknown;
};

async function logClientWriteMetric(tx: DbClient, payload: Record<string, unknown>): Promise<void> {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'clients',
      ...payload,
    }),
  );
  try {
    await logRepo.insert(tx, {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'metric',
      title: typeof payload.event === 'string' ? payload.event : 'clients.metric',
      msg: null,
      meta: payload,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'clients',
        event: 'clients.metric.persist.error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * @param {UpsertClientInput} params
 * @returns {Promise<unknown>}
 */
async function upsertClient({ pool, payload, requestId, endpoint }: UpsertClientInput): Promise<unknown> {
  const c = (payload && typeof payload === 'object' ? payload : {}) as ClientPayload;
  const validated = assertClientInput(c as never);
  const endpointSafe = asNonEmptyString(endpoint);
  const operationId = asNonEmptyString(c.operationId);
  const startMs = Date.now();

  return withTransaction(pool, async (tx) => {
    await tx.query(
      `INSERT INTO clients (
          id, wechat_name, wechat_id, real_name, xhs_name, xhs_id,
          order_date, delivery_date,
          pcpp_link, is_shipping, tracking_number,
          address_line, city, state, zip_code, status,
          total_price, actual_cost, profit, paid_amount, specs, photos, rating, notes, phone, metadata
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,
          $9,$10,$11,
          $12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26
        )
        ON CONFLICT (id) DO UPDATE SET
          wechat_name=EXCLUDED.wechat_name,
          wechat_id=EXCLUDED.wechat_id,
          real_name=EXCLUDED.real_name,
          xhs_name=EXCLUDED.xhs_name,
          xhs_id=EXCLUDED.xhs_id,
          order_date=EXCLUDED.order_date,
          delivery_date=EXCLUDED.delivery_date,
          pcpp_link=EXCLUDED.pcpp_link,
          is_shipping=EXCLUDED.is_shipping,
          tracking_number=EXCLUDED.tracking_number,
          address_line=EXCLUDED.address_line,
          city=EXCLUDED.city,
          state=EXCLUDED.state,
          zip_code=EXCLUDED.zip_code,
          status=EXCLUDED.status,
          total_price=EXCLUDED.total_price,
          actual_cost=EXCLUDED.actual_cost,
          profit=EXCLUDED.profit,
          paid_amount=EXCLUDED.paid_amount,
          specs=EXCLUDED.specs,
          photos=EXCLUDED.photos,
          rating=EXCLUDED.rating,
          notes=EXCLUDED.notes,
          phone=EXCLUDED.phone,
          metadata=EXCLUDED.metadata`,
      [
        validated.id,
        validated.wechatName,
        c.wechatId,
        c.realName,
        c.xhsName,
        c.xhsId,

        validated.orderDate,
        validated.deliveryDate,

        c.pcppLink,
        c.isShipping,
        c.trackingNumber,

        c.address,
        c.city,
        c.state,
        c.zip,
        c.status,

        c.totalPrice,
        c.actualCost,
        c.profit,
        c.paidAmount,

        JSON.stringify(c.specs || {}),
        JSON.stringify(c.photos || []),
        c.rating,
        c.notes,
        c.phone || '',
        JSON.stringify(c.metadata || {}),
      ],
    );

    await logClientWriteMetric(tx, {
      event: 'clients.upsert.metrics',
      requestId,
      operationId,
      endpoint: endpointSafe,
      durationMs: Date.now() - startMs,
      idempotencyHit: false,
      idempotencyMode: 'none',
      status: 'success',
    });

    return { success: true };
  });
}

/**
 * @param {DeleteClientInput} params
 * @returns {Promise<unknown>}
 */
async function deleteClient({
  pool,
  id,
  operationId,
  requestId,
  endpoint,
}: DeleteClientInput): Promise<unknown> {
  const rowId = asNonEmptyString(id);
  if (!rowId) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'id is required',
      details: { field: 'id' },
    });
  }
  const endpointSafe = asNonEmptyString(endpoint);
  const opId = asNonEmptyString(operationId);
  const startMs = Date.now();

  return withTransaction(pool, async (tx) => {
    const r = await tx.query('DELETE FROM clients WHERE id = $1', [rowId]);
    if ((r.rowCount || 0) === 0) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Client not found',
        details: { id: rowId },
      });
    }

    await logClientWriteMetric(tx, {
      event: 'clients.delete.metrics',
      requestId,
      operationId: opId,
      endpoint: endpointSafe,
      durationMs: Date.now() - startMs,
      idempotencyHit: false,
      idempotencyMode: 'none',
      status: 'success',
    });

    return { success: true };
  });
}

export { upsertClient, deleteClient };
