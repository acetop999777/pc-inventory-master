import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import AppError = require('../errors/AppError');
import { withTransaction } from '../db/tx';
import * as inventoryRepo from '../repositories/inventoryRepo';
import * as movementRepo from '../repositories/movementRepo';
import * as auditLogRepo from '../repositories/auditLogRepo';
import * as idempotencyRepo from '../repositories/idempotencyRepo';
import * as receiptRepo from '../repositories/receiptRepo';
import * as logRepo from '../repositories/logRepo';
import { asNonEmptyString, requireNumber, requireInt } from '../validators/requestUtils';

type DbPool = Pool;
type DbClient = PoolClient;
type ReceiptItemInput = {
  inventoryId?: unknown;
  qty?: unknown;
  unitCost?: unknown;
};
type ReceiptUpdateItem = {
  id?: unknown;
  remove?: unknown;
  qtyReceived?: unknown;
  unitCost?: unknown;
};
type ReceiptUpdatePayload = {
  [key: string]: unknown;
  items?: unknown;
};
type CreateReceiptInput = {
  pool: DbPool;
  operationId: unknown;
  receivedAt?: string | number | Date | null;
  vendor?: unknown;
  mode?: unknown;
  notes?: unknown;
  images?: unknown;
  items: unknown;
  requestId?: unknown;
  endpoint?: unknown;
};
type ListReceiptsInput = { pool: DbPool; limit?: unknown };
type GetReceiptDetailInput = { pool: DbPool; id: string };
type UpdateReceiptImagesInput = { pool: DbPool; id: string; images?: unknown };
type UpdateReceiptInput = {
  pool: DbPool;
  id: string;
  payload: ReceiptUpdatePayload;
  requestId?: unknown;
  endpoint?: unknown;
};

type ReceiptRow = {
  id: number;
  received_at: string;
  vendor: string | null;
  mode: string;
  notes: string | null;
  operation_id: string;
  images?: unknown;
};
type InventoryRow = {
  id: string;
  name?: string | null;
  sku?: string | null;
  quantity?: unknown;
  cost?: unknown;
  category?: unknown;
  keyword?: unknown;
  price?: unknown;
  location?: unknown;
  status?: unknown;
  notes?: unknown;
  metadata?: unknown;
};
type ReceiptItemRow = {
  id: number;
  receipt_id: number;
  inventory_id: string;
  qty_received: number;
  unit_cost: number;
  line_total: number;
  inventory_name?: string | null;
  inventory_sku?: string | null;
};
type InventoryUpdate = { inventoryId: string; onHandQty: number; avgCost: string };
type ReceiptResponseItem = {
  id: number;
  receiptId: number;
  inventoryId: string;
  qtyReceived: number;
  unitCost: string;
  lineTotal: string;
  displayName: string;
  sku: string;
};
type ReceiptResponse = {
  receipt: {
    id: number;
    receivedAt: string;
    vendor: string | null;
    mode: string;
    notes: string | null;
    operationId: string;
    images: string[];
  };
  items: ReceiptResponseItem[];
  inventoryUpdates: InventoryUpdate[];
};

function roundMoney(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function buildResponse(
  receipt: ReceiptRow,
  items: ReceiptItemRow[],
  updates: InventoryUpdate[],
): ReceiptResponse {
  return {
    receipt: {
      id: receipt.id,
      receivedAt: receipt.received_at,
      vendor: receipt.vendor,
      mode: receipt.mode,
      notes: receipt.notes,
      operationId: receipt.operation_id,
      images: Array.isArray(receipt.images) ? (receipt.images as string[]) : [],
    },
    items: items.map((it) => ({
      id: it.id,
      receiptId: it.receipt_id,
      inventoryId: it.inventory_id,
      qtyReceived: Number(it.qty_received),
      unitCost: String(it.unit_cost),
      lineTotal: String(it.line_total),
      displayName: it.inventory_name || '',
      sku: it.inventory_sku || '',
    })),
    inventoryUpdates: updates,
  };
}

async function logReceiptWriteMetric(tx: DbClient, payload: Record<string, unknown>): Promise<void> {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'receipts',
      ...payload,
    }),
  );
  try {
    await logRepo.insert(tx, {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'metric',
      title: typeof payload.event === 'string' ? payload.event : 'receipts.metric',
      msg: null,
      meta: payload,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipts.metric.persist.error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * @param {CreateReceiptInput} params
 * @returns {Promise<unknown>}
 */
async function createReceipt({
  pool,
  operationId,
  receivedAt,
  vendor,
  mode,
  notes,
  images,
  items,
  requestId,
  endpoint,
}: CreateReceiptInput) {
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

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'items must be a non-empty array',
      details: { field: 'items' },
    });
  }

  const endpointSafe = asNonEmptyString(endpoint);
  const startMs = Date.now();

  return withTransaction(pool, async (tx) => {
    const idem = await idempotencyRepo.beginOperation(tx, { operationId: opId, endpoint: endpointSafe });
    if (idem.state === 'DONE') {
      await logReceiptWriteMetric(tx, {
        event: 'receipts.create.metrics',
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

    const existingReceipt = (await receiptRepo.getReceiptByOperationId(tx, opId)) as ReceiptRow | null;
    if (existingReceipt) {
      const receiptItems = (await receiptRepo.getReceiptItems(tx, existingReceipt.id)) as ReceiptItemRow[];
      const updates: InventoryUpdate[] = [];
      for (const it of receiptItems) {
        const inv = (await inventoryRepo.getForUpdateById(tx, it.inventory_id)) as InventoryRow | null;
        if (inv) {
          updates.push({
            inventoryId: it.inventory_id,
            onHandQty: Number(inv.quantity ?? 0),
            avgCost: String(inv.cost ?? 0),
          });
        }
      }
      const response = buildResponse(existingReceipt, receiptItems, updates);
      await idempotencyRepo.markDone(tx, { operationId: opId, response });
      await logReceiptWriteMetric(tx, {
        event: 'receipts.create.metrics',
        requestId,
        operationId: opId,
        endpoint: endpointSafe,
        durationMs: Date.now() - startMs,
        idempotencyHit: true,
        status: 'success',
      });
      return response;
    }

    const seen = new Set<string>();
    const rawItems = items as ReceiptItemInput[];
    const sorted: Array<{ inventoryId: string | null; qty: number; unitCost: number }> = rawItems
      .map((item) => ({
        inventoryId: asNonEmptyString(item?.inventoryId),
        qty: requireInt(item?.qty, 'qty'),
        unitCost: requireNumber(item?.unitCost, 'unitCost'),
      }))
      .sort((a, b) => String(a.inventoryId || '').localeCompare(String(b.inventoryId || '')));

    for (const it of sorted) {
      const inventoryId = it.inventoryId;
      if (!inventoryId) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'inventoryId is required',
          details: { field: 'inventoryId' },
        });
      }
      if (it.qty <= 0) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'qty must be > 0',
          details: { field: 'qty', inventoryId },
        });
      }
      if (it.unitCost < 0) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'unitCost must be >= 0',
          details: { field: 'unitCost', inventoryId },
        });
      }
      if (seen.has(inventoryId)) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'duplicate inventoryId in items',
          details: { inventoryId },
        });
      }
      seen.add(inventoryId);
    }

    const receipt = (await receiptRepo.insertReceipt(tx, {
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      vendor,
      mode: mode || 'MANUAL',
      notes,
      images,
      requestId,
      operationId: opId,
    })) as ReceiptRow;

    const receiptItems: ReceiptItemRow[] = [];
    const inventoryUpdates: InventoryUpdate[] = [];

    for (const it of sorted) {
      const inventoryId = it.inventoryId;
      if (!inventoryId) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'inventoryId is required',
          details: { field: 'inventoryId' },
        });
      }

      const inv = (await inventoryRepo.getForUpdateById(tx, inventoryId)) as InventoryRow | null;
      if (!inv) {
        throw new AppError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          retryable: false,
          message: 'Inventory item not found',
          details: { inventoryId },
        });
      }

      const prevQty = Number(inv.quantity ?? 0);
      const prevCost = Number(inv.cost ?? 0);

      const newQty = prevQty + it.qty;
      const currentTotalVal = prevQty * prevCost;
      const incomingTotalVal = it.qty * it.unitCost;
      const newAvgCost = newQty > 0 ? (currentTotalVal + incomingTotalVal) / newQty : 0;

      const nextRow = {
        id: inventoryId,
        quantity: newQty,
        cost: roundMoney(newAvgCost),
      };

      await inventoryRepo.update(tx, inventoryId, nextRow);

      const receiptItem = (await receiptRepo.insertReceiptItem(tx, {
        receiptId: receipt.id,
        inventoryId: inventoryId,
        qtyReceived: it.qty,
        unitCost: it.unitCost,
      })) as ReceiptItemRow;
      receiptItems.push({
        ...receiptItem,
        inventory_name: inv.name,
        inventory_sku: inv.sku,
      });

      await movementRepo.insert(tx, {
        inventoryId: inventoryId,
        qtyDelta: it.qty,
        reason: 'RECEIVE',
        unitCost: it.unitCost,
        unitCostUsed: null,
        refType: 'RECEIPT',
        refId: String(receipt.id),
        onHandAfter: newQty,
        avgCostAfter: roundMoney(newAvgCost),
        requestId,
        operationId: `${opId}:${inventoryId}`,
      });

      await auditLogRepo.insert(tx, {
        id: crypto.randomUUID(),
        sku: inv.sku,
        name: inv.name,
        type: 'RECEIVE',
        qtyChange: it.qty,
        unitCost: it.unitCost,
        totalValue: incomingTotalVal,
        refId: String(receipt.id),
        operator: null,
      });

      inventoryUpdates.push({
        inventoryId: inventoryId,
        onHandQty: newQty,
        avgCost: String(roundMoney(newAvgCost)),
      });
    }

    const response = buildResponse(receipt, receiptItems, inventoryUpdates);
    await idempotencyRepo.markDone(tx, { operationId: opId, response });
    await logReceiptWriteMetric(tx, {
      event: 'receipts.create.metrics',
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

/**
 * @param {ListReceiptsInput} params
 * @returns {Promise<unknown>}
 */
async function listReceipts({ pool, limit }: ListReceiptsInput) {
  return withTransaction(pool, async (tx) => {
    const rows = (await receiptRepo.listReceipts(tx, limit)) as Array<
      ReceiptRow & { created_at?: string; total_amount?: unknown }
    >;
    return rows.map((r) => ({
      id: r.id,
      receivedAt: r.received_at,
      vendor: r.vendor,
      mode: r.mode,
      notes: r.notes,
      createdAt: r.created_at,
      operationId: r.operation_id,
      totalAmount: Number(r.total_amount ?? 0),
    }));
  });
}

/**
 * @param {GetReceiptDetailInput} params
 * @returns {Promise<unknown>}
 */
async function getReceiptDetail({ pool, id }: GetReceiptDetailInput) {
  return withTransaction(pool, async (tx) => {
    const receipt = (await receiptRepo.getReceipt(tx, id)) as ReceiptRow | null;
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }
    const items = (await receiptRepo.getReceiptItems(tx, receipt.id)) as ReceiptItemRow[];
    const inventoryUpdates: InventoryUpdate[] = [];
    for (const it of items) {
      const inv = (await inventoryRepo.getForUpdateById(tx, it.inventory_id)) as InventoryRow | null;
      if (inv) {
        inventoryUpdates.push({
          inventoryId: it.inventory_id,
          onHandQty: Number(inv.quantity ?? 0),
          avgCost: String(inv.cost ?? 0),
        });
      }
    }
    return buildResponse(receipt, items, inventoryUpdates);
  });
}

/**
 * @param {UpdateReceiptImagesInput} params
 * @returns {Promise<unknown>}
 */
async function updateReceiptImages({ pool, id, images }: UpdateReceiptImagesInput) {
  const startMs = Date.now();
  return withTransaction(pool, async (tx) => {
    const receipt = (await receiptRepo.updateReceiptImages(tx, id, images)) as ReceiptRow | null;
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }
    await logReceiptWriteMetric(tx, {
      event: 'receipts.images.metrics',
      requestId: null,
      operationId: receipt.operation_id,
      endpoint: null,
      durationMs: Date.now() - startMs,
      idempotencyHit: false,
      idempotencyMode: 'none',
      status: 'success',
    });
    return {
      id: receipt.id,
      receivedAt: receipt.received_at,
      vendor: receipt.vendor,
      mode: receipt.mode,
      notes: receipt.notes,
      operationId: receipt.operation_id,
      images: Array.isArray(receipt.images) ? receipt.images : [],
    };
  });
}

/**
 * @param {UpdateReceiptInput} params
 * @returns {Promise<unknown>}
 */
async function updateReceipt({ pool, id, payload, requestId, endpoint }: UpdateReceiptInput) {
  const startMs = Date.now();
  return withTransaction(pool, async (tx) => {
    const receipt = (await receiptRepo.getReceipt(tx, id)) as ReceiptRow | null;
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }

    const itemsPayload = Array.isArray(payload.items) ? (payload.items as ReceiptUpdateItem[]) : null;
    const inventoryUpdates: InventoryUpdate[] = [];

    if (itemsPayload) {
      const existingItems = (await receiptRepo.getReceiptItems(tx, receipt.id)) as ReceiptItemRow[];
      const existingById = new Map(existingItems.map((it) => [String(it.id), it]));

      for (const item of itemsPayload) {
        const itemId = String(item?.id || '');
        const existing = existingById.get(itemId);
        if (!existing) {
          throw new AppError({
            code: 'INVALID_ARGUMENT',
            httpStatus: 400,
            retryable: false,
            message: 'Receipt item not found',
            details: { itemId },
          });
        }

        if (item?.remove === true) {
          const inv = (await inventoryRepo.getForUpdateById(tx, existing.inventory_id)) as InventoryRow | null;
          if (!inv) {
            throw new AppError({
              code: 'NOT_FOUND',
              httpStatus: 404,
              retryable: false,
              message: 'Inventory item not found',
              details: { inventoryId: existing.inventory_id },
            });
          }

          const oldQty = Number(existing.qty_received ?? 0);
          const prevQty = Number(inv.quantity ?? 0);
          const prevCost = Number(inv.cost ?? 0);
          const nextQty = prevQty - oldQty;
          if (nextQty < 0) {
            throw new AppError({
              code: 'INVENTORY_INSUFFICIENT',
              httpStatus: 409,
              retryable: false,
              message: 'Not enough stock to remove receipt item',
              details: { inventoryId: existing.inventory_id, available: prevQty, requested: -oldQty },
            });
          }

          await inventoryRepo.update(tx, existing.inventory_id, {
            id: existing.inventory_id,
            quantity: nextQty,
            cost: roundMoney(prevCost),
          });

          await receiptRepo.deleteReceiptItem(tx, existing.id);

          const qtyDelta = -oldQty;
          const movementId = `${receipt.operation_id}:delete:${existing.inventory_id}:${Date.now()}`;
          await movementRepo.insert(tx, {
            inventoryId: existing.inventory_id,
            qtyDelta,
            reason: 'CONSUME',
            unitCost: null,
            unitCostUsed: prevCost,
            refType: 'RECEIPT',
            refId: String(receipt.id),
            onHandAfter: nextQty,
            avgCostAfter: roundMoney(prevCost),
            requestId,
            operationId: movementId,
            occurredAt: new Date(),
          });

          await auditLogRepo.insert(tx, {
            id: crypto.randomUUID(),
            sku: inv.sku,
            name: inv.name,
            type: 'RECEIPT_DELETE',
            qtyChange: qtyDelta,
            unitCost: prevCost,
            totalValue: qtyDelta * prevCost,
            refId: String(receipt.id),
            operator: null,
          });

          inventoryUpdates.push({
            inventoryId: existing.inventory_id,
            onHandQty: nextQty,
            avgCost: String(roundMoney(prevCost)),
          });

          continue;
        }

        const newQty = requireInt(item?.qtyReceived, 'qtyReceived');
        const newCost = requireNumber(item?.unitCost, 'unitCost');
        if (newQty <= 0) {
          throw new AppError({
            code: 'INVALID_ARGUMENT',
            httpStatus: 400,
            retryable: false,
            message: 'qtyReceived must be > 0',
            details: { itemId },
          });
        }

        const oldQty = Number(existing.qty_received ?? 0);
        const oldCost = Number(existing.unit_cost ?? 0);
        const qtyDelta = newQty - oldQty;
        const costDelta = newCost - oldCost;

        if (qtyDelta === 0 && costDelta === 0) {
          continue;
        }

        const inv = (await inventoryRepo.getForUpdateById(tx, existing.inventory_id)) as InventoryRow | null;
        if (!inv) {
          throw new AppError({
            code: 'NOT_FOUND',
            httpStatus: 404,
            retryable: false,
            message: 'Inventory item not found',
            details: { inventoryId: existing.inventory_id },
          });
        }

        const prevQty = Number(inv.quantity ?? 0);
        const prevCost = Number(inv.cost ?? 0);
        const nextQty = prevQty + qtyDelta;
        if (nextQty < 0) {
          throw new AppError({
            code: 'INVENTORY_INSUFFICIENT',
            httpStatus: 409,
            retryable: false,
            message: 'Not enough stock for edit',
            details: { inventoryId: existing.inventory_id, available: prevQty, requested: qtyDelta },
          });
        }

        let nextCost = prevCost;
        if (qtyDelta > 0) {
          const currentTotalVal = prevQty * prevCost;
          const incomingTotalVal = qtyDelta * newCost;
          nextCost = nextQty > 0 ? (currentTotalVal + incomingTotalVal) / nextQty : 0;
        } else if (qtyDelta === 0 && costDelta !== 0) {
          const affectedQty = Math.min(prevQty, oldQty);
          const deltaVal = costDelta * affectedQty;
          nextCost = prevQty > 0 ? (prevQty * prevCost + deltaVal) / prevQty : newCost;
        }

        await inventoryRepo.update(tx, existing.inventory_id, {
          id: existing.inventory_id,
          quantity: nextQty,
          cost: roundMoney(nextCost),
        });

        await receiptRepo.updateReceiptItem(tx, existing.id, newQty, newCost);

        const reason =
          qtyDelta > 0 ? 'RECEIVE' : qtyDelta < 0 ? 'CONSUME' : 'ADJUST';
        const movementId = `${receipt.operation_id}:edit:${existing.inventory_id}:${Date.now()}`;
        await movementRepo.insert(tx, {
          inventoryId: existing.inventory_id,
          qtyDelta,
          reason,
          unitCost: reason === 'RECEIVE' || reason === 'ADJUST' ? newCost : null,
          unitCostUsed: reason === 'CONSUME' ? prevCost : null,
          refType: 'RECEIPT',
          refId: String(receipt.id),
          onHandAfter: nextQty,
          avgCostAfter: roundMoney(nextCost),
          requestId,
          operationId: movementId,
          occurredAt: new Date(),
        });

        await auditLogRepo.insert(tx, {
          id: crypto.randomUUID(),
          sku: inv.sku,
          name: inv.name,
          type: 'RECEIPT_EDIT',
          qtyChange: qtyDelta,
          unitCost: newCost,
          totalValue: qtyDelta * newCost,
          refId: String(receipt.id),
          operator: null,
        });

        inventoryUpdates.push({
          inventoryId: existing.inventory_id,
          onHandQty: nextQty,
          avgCost: String(roundMoney(nextCost)),
        });
      }
    }

    const updatedReceipt = (await receiptRepo.updateReceipt(tx, receipt.id, payload)) as ReceiptRow | null;
    if (!updatedReceipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }

    const updatedItems = (await receiptRepo.getReceiptItems(tx, receipt.id)) as ReceiptItemRow[];
    await logReceiptWriteMetric(tx, {
      event: 'receipts.update.metrics',
      requestId,
      operationId: receipt.operation_id,
      endpoint: asNonEmptyString(endpoint),
      durationMs: Date.now() - startMs,
      idempotencyHit: false,
      idempotencyMode: 'none',
      status: 'success',
    });
    return buildResponse(updatedReceipt, updatedItems, inventoryUpdates);
  });
}

export { createReceipt, listReceipts, getReceiptDetail, updateReceiptImages, updateReceipt };
