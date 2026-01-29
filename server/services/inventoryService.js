const crypto = require('crypto');
const AppError = require('../errors/AppError');
const { withTransaction } = require('../db/tx');
const inventoryRepo = require('../repositories/inventoryRepo');
const auditLogRepo = require('../repositories/auditLogRepo');
const movementRepo = require('../repositories/movementRepo');
const idempotencyRepo = require('../repositories/idempotencyRepo');

function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function requireInt(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be an integer`,
      details: { field },
    });
  }
  return n;
}

function requireNumber(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be a number`,
      details: { field },
    });
  }
  return n;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function coerceInventoryPatch(fields) {
  const next = { ...fields };
  if (Object.prototype.hasOwnProperty.call(next, 'quantity')) {
    next.quantity = Number(next.quantity ?? 0);
  }
  if (Object.prototype.hasOwnProperty.call(next, 'cost')) {
    next.cost = Number(next.cost ?? 0);
  }
  if (Object.prototype.hasOwnProperty.call(next, 'price')) {
    next.price = Number(next.price ?? 0);
  }
  return next;
}

function logInventoryEvent(payload) {
  const record = {
    ts: new Date().toISOString(),
    scope: 'inventory',
    ...payload,
  };
  console.log(JSON.stringify(record));
}

function normalizeReason(raw, qtyDelta) {
  const reason = typeof raw === 'string' ? raw.toUpperCase().trim() : '';
  if (reason === 'RECEIVE' || reason === 'CONSUME' || reason === 'ADJUST' || reason === 'OPENING') {
    return reason;
  }
  if (qtyDelta > 0) return 'RECEIVE';
  if (qtyDelta < 0) return 'CONSUME';
  return 'ADJUST';
}

function movementOperationId(operationId, inventoryId) {
  return `${operationId}:${inventoryId}`;
}

async function updateInventoryItem({ pool, id, fields, operationId, requestId, endpoint }) {
  const rowId = asNonEmptyString(id);
  if (!rowId) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'inventory id is required',
      details: { field: 'id' },
    });
  }

  if (!asNonEmptyString(operationId)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'operationId is required',
      details: { field: 'operationId' },
    });
  }

  const patch = coerceInventoryPatch(fields || {});

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

    const existing = await inventoryRepo.getForUpdateById(tx, rowId);
    if (!existing) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Inventory item not found',
        details: { id: rowId },
      });
    }

    const prevQty = Number(existing.quantity ?? 0);
    const prevCost = Number(existing.cost ?? 0);
    const nextQty =
      Object.prototype.hasOwnProperty.call(patch, 'quantity') ? Number(patch.quantity) : prevQty;
    const nextCost =
      Object.prototype.hasOwnProperty.call(patch, 'cost') ? Number(patch.cost) : prevCost;

    const qtyDelta = nextQty - prevQty;
    const costChanged = nextCost !== prevCost;
    const shouldMove = qtyDelta !== 0 || costChanged;

    if (shouldMove && nextQty < 0) {
      throw new AppError({
        code: 'INVENTORY_INSUFFICIENT',
        httpStatus: 409,
        retryable: false,
        message: 'Not enough stock',
        details: { id: rowId, available: prevQty, requested: qtyDelta },
      });
    }

    logInventoryEvent({
      event: 'inventory.update.start',
      requestId,
      operationId,
      endpoint,
      inventoryId: rowId,
      sku: existing?.sku,
      action: 'ADJUST',
      delta: qtyDelta,
    });

    try {
      const updatedRow = await inventoryRepo.update(tx, rowId, patch);

      if (shouldMove) {
        const movementId = movementOperationId(operationId, rowId);
        await movementRepo.insert(tx, {
          inventoryId: rowId,
          qtyDelta,
          reason: 'ADJUST',
          unitCost: costChanged ? nextCost : null,
          unitCostUsed: null,
          refType: 'ADJUST',
          refId: operationId,
          onHandAfter: nextQty,
          avgCostAfter: nextCost,
          requestId,
          operationId: movementId,
        });

        await auditLogRepo.insert(tx, {
          id: crypto.randomUUID(),
          sku: updatedRow?.sku,
          name: updatedRow?.name,
          type: 'ADJUST',
          qtyChange: qtyDelta,
          unitCost: nextCost,
          totalValue: qtyDelta * nextCost,
          refId: operationId,
          operator: patch.operator || null,
        });
      }

      const response = updatedRow || { success: true };
      await idempotencyRepo.markDone(tx, { operationId, response });

      logInventoryEvent({
        event: 'inventory.update.success',
        requestId,
        operationId,
        endpoint,
        inventoryId: rowId,
        sku: updatedRow?.sku,
        action: 'ADJUST',
        delta: qtyDelta,
      });

      return response;
    } catch (err) {
      logInventoryEvent({
        event: 'inventory.update.error',
        requestId,
        operationId,
        endpoint,
        inventoryId: rowId,
        sku: existing?.sku,
        action: 'ADJUST',
        delta: qtyDelta,
        error: err?.code || err?.message || 'ERROR',
      });
      throw err;
    }
  });
}

async function applyInventoryBatch({ pool, operationId, items, endpoint, requestId }) {
  if (!asNonEmptyString(operationId)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'operationId is required',
      details: { field: 'operationId' },
    });
  }

  if (!Array.isArray(items)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'items must be an array',
      details: { field: 'items' },
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

    const seen = new Set();
    const sortedItems = items.slice().sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));

    const updatedIds = [];

    for (const item of sortedItems) {
      const id = asNonEmptyString(item?.id);
      if (!id) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'inventory item id is required',
          details: { field: 'id' },
        });
      }

      if (seen.has(id)) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'duplicate inventory id in batch',
          details: { id },
        });
      }
      seen.add(id);

      if (!Object.prototype.hasOwnProperty.call(item, 'qtyDelta')) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'qtyDelta is required',
          details: { field: 'qtyDelta', id },
        });
      }

      const qtyDelta = requireInt(item.qtyDelta, 'qtyDelta');
      const reason = normalizeReason(item.reason, qtyDelta);

      const hasUnitCost = Object.prototype.hasOwnProperty.call(item, 'unitCost');
      if (!hasUnitCost && qtyDelta > 0) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'unitCost is required for receive',
          details: { field: 'unitCost', id },
        });
      }

      logInventoryEvent({
        event: 'inventory.batch.start',
        requestId,
        operationId,
        endpoint,
        inventoryId: id,
        sku: item?.sku,
        action: reason,
        delta: qtyDelta,
      });

      try {
        const existing = await inventoryRepo.getForUpdateById(tx, id);
        if (!existing && qtyDelta < 0) {
          throw new AppError({
            code: 'INVENTORY_INSUFFICIENT',
            httpStatus: 409,
            retryable: false,
            message: 'Not enough stock',
            details: { id, available: 0, requested: qtyDelta },
          });
        }

        const prevQty = Number(existing?.quantity ?? 0);
        const prevCost = Number(existing?.cost ?? 0);
        const unitCost = hasUnitCost ? requireNumber(item.unitCost, 'unitCost') : prevCost;

        const newQty = prevQty + qtyDelta;
        if (newQty < 0) {
          throw new AppError({
            code: 'INVENTORY_INSUFFICIENT',
            httpStatus: 409,
            retryable: false,
            message: 'Not enough stock',
            details: { id, available: prevQty, requested: qtyDelta },
          });
        }

        const currentTotalVal = prevQty * prevCost;
        const incomingTotalVal = qtyDelta * unitCost;
        let newAvgCost = prevCost;
        if (reason === 'RECEIVE' || reason === 'CONSUME') {
          const wac =
            newQty > 0 ? (currentTotalVal + incomingTotalVal) / newQty : 0;
          newAvgCost = Math.max(0, wac);
        } else if (reason === 'ADJUST') {
          newAvgCost = hasUnitCost ? unitCost : prevCost;
        }

        const nextRow = {
          id,
          category: item.category ?? existing?.category ?? null,
          name: item.name ?? existing?.name ?? null,
          keyword: item.keyword ?? existing?.keyword ?? null,
          sku: item.sku ?? existing?.sku ?? null,
          quantity: newQty,
          cost: roundMoney(newAvgCost),
          price: item.price ?? existing?.price ?? 0,
          location: item.location ?? existing?.location ?? null,
          status: item.status ?? existing?.status ?? 'In Stock',
          notes: item.notes ?? existing?.notes ?? null,
          metadata: item.metadata ?? existing?.metadata ?? {},
        };

        if (existing) {
          await inventoryRepo.update(tx, id, nextRow);
        } else {
          await inventoryRepo.insert(tx, nextRow);
        }

        const movementId = movementOperationId(operationId, id);
        await movementRepo.insert(tx, {
          inventoryId: id,
          qtyDelta,
          reason,
          unitCost: reason === 'RECEIVE' || reason === 'ADJUST' ? unitCost : null,
          unitCostUsed: reason === 'CONSUME' ? unitCost : null,
          refType: 'BATCH',
          refId: operationId,
          onHandAfter: newQty,
          avgCostAfter: roundMoney(newAvgCost),
          requestId,
          operationId: movementId,
        });

        await auditLogRepo.insert(tx, {
          id: crypto.randomUUID(),
          sku: nextRow.sku,
          name: nextRow.name,
          type: reason,
          qtyChange: qtyDelta,
          unitCost: unitCost,
          totalValue: incomingTotalVal,
          refId: operationId,
          operator: item.operator || null,
        });

        updatedIds.push(id);

        logInventoryEvent({
          event: 'inventory.batch.success',
          requestId,
          operationId,
          endpoint,
          inventoryId: id,
          sku: nextRow.sku,
          action: reason,
          delta: qtyDelta,
        });
      } catch (err) {
        logInventoryEvent({
          event: 'inventory.batch.error',
          requestId,
          operationId,
          endpoint,
          inventoryId: id,
          sku: item?.sku,
          action: reason,
          delta: qtyDelta,
          error: err?.code || err?.message || 'ERROR',
        });
        throw err;
      }
    }

    const response = { success: true, updatedIds };
    await idempotencyRepo.markDone(tx, { operationId, response });
    return response;
  });
}

module.exports = {
  applyInventoryBatch,
  updateInventoryItem,
};
