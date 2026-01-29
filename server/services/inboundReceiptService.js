const crypto = require('crypto');
const AppError = require('../errors/AppError');
const { withTransaction } = require('../db/tx');
const inventoryRepo = require('../repositories/inventoryRepo');
const movementRepo = require('../repositories/movementRepo');
const auditLogRepo = require('../repositories/auditLogRepo');
const idempotencyRepo = require('../repositories/idempotencyRepo');
const receiptRepo = require('../repositories/receiptRepo');

function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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

function roundMoney(n) {
  return Math.round(n * 10000) / 10000;
}

function buildResponse(receipt, items, updates) {
  return {
    receipt: {
      id: receipt.id,
      receivedAt: receipt.received_at,
      vendor: receipt.vendor,
      mode: receipt.mode,
      notes: receipt.notes,
      operationId: receipt.operation_id,
      images: Array.isArray(receipt.images) ? receipt.images : [],
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
}) {
  if (!asNonEmptyString(operationId)) {
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

    const existingReceipt = await receiptRepo.getReceiptByOperationId(tx, operationId);
    if (existingReceipt) {
      const receiptItems = await receiptRepo.getReceiptItems(tx, existingReceipt.id);
      const updates = [];
      for (const it of receiptItems) {
        const inv = await inventoryRepo.getForUpdateById(tx, it.inventory_id);
        if (inv) {
          updates.push({
            inventoryId: it.inventory_id,
            onHandQty: Number(inv.quantity ?? 0),
            avgCost: String(inv.cost ?? 0),
          });
        }
      }
      const response = buildResponse(existingReceipt, receiptItems, updates);
      await idempotencyRepo.markDone(tx, { operationId, response });
      return response;
    }

    const seen = new Set();
    const sorted = items
      .map((item) => ({
        inventoryId: asNonEmptyString(item?.inventoryId),
        qty: requireInt(item?.qty, 'qty'),
        unitCost: requireNumber(item?.unitCost, 'unitCost'),
      }))
      .sort((a, b) => String(a.inventoryId || '').localeCompare(String(b.inventoryId || '')));

    for (const it of sorted) {
      if (!it.inventoryId) {
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
          details: { field: 'qty', inventoryId: it.inventoryId },
        });
      }
      if (it.unitCost < 0) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'unitCost must be >= 0',
          details: { field: 'unitCost', inventoryId: it.inventoryId },
        });
      }
      if (seen.has(it.inventoryId)) {
        throw new AppError({
          code: 'INVALID_ARGUMENT',
          httpStatus: 400,
          retryable: false,
          message: 'duplicate inventoryId in items',
          details: { inventoryId: it.inventoryId },
        });
      }
      seen.add(it.inventoryId);
    }

    const receipt = await receiptRepo.insertReceipt(tx, {
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      vendor,
      mode: mode || 'MANUAL',
      notes,
      images,
      requestId,
      operationId,
    });

    const receiptItems = [];
    const inventoryUpdates = [];

    for (const it of sorted) {
      const inv = await inventoryRepo.getForUpdateById(tx, it.inventoryId);
      if (!inv) {
        throw new AppError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          retryable: false,
          message: 'Inventory item not found',
          details: { inventoryId: it.inventoryId },
        });
      }

      const prevQty = Number(inv.quantity ?? 0);
      const prevCost = Number(inv.cost ?? 0);

      const newQty = prevQty + it.qty;
      const currentTotalVal = prevQty * prevCost;
      const incomingTotalVal = it.qty * it.unitCost;
      const newAvgCost = newQty > 0 ? (currentTotalVal + incomingTotalVal) / newQty : 0;

      const nextRow = {
        id: it.inventoryId,
        quantity: newQty,
        cost: roundMoney(newAvgCost),
      };

      await inventoryRepo.update(tx, it.inventoryId, nextRow);

      const receiptItem = await receiptRepo.insertReceiptItem(tx, {
        receiptId: receipt.id,
        inventoryId: it.inventoryId,
        qtyReceived: it.qty,
        unitCost: it.unitCost,
      });
      receiptItems.push({
        ...receiptItem,
        inventory_name: inv.name,
        inventory_sku: inv.sku,
      });

      await movementRepo.insert(tx, {
        inventoryId: it.inventoryId,
        qtyDelta: it.qty,
        reason: 'RECEIVE',
        unitCost: it.unitCost,
        unitCostUsed: null,
        refType: 'RECEIPT',
        refId: String(receipt.id),
        onHandAfter: newQty,
        avgCostAfter: roundMoney(newAvgCost),
        requestId,
        operationId: `${operationId}:${it.inventoryId}`,
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
        inventoryId: it.inventoryId,
        onHandQty: newQty,
        avgCost: String(roundMoney(newAvgCost)),
      });
    }

    const response = buildResponse(receipt, receiptItems, inventoryUpdates);
    await idempotencyRepo.markDone(tx, { operationId, response });
    return response;
  });
}

async function listReceipts({ pool, limit }) {
  return withTransaction(pool, async (tx) => {
    const rows = await receiptRepo.listReceipts(tx, limit);
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

async function getReceiptDetail({ pool, id }) {
  return withTransaction(pool, async (tx) => {
    const receipt = await receiptRepo.getReceipt(tx, id);
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }
    const items = await receiptRepo.getReceiptItems(tx, receipt.id);
    const inventoryUpdates = [];
    for (const it of items) {
      const inv = await inventoryRepo.getForUpdateById(tx, it.inventory_id);
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

async function updateReceiptImages({ pool, id, images }) {
  return withTransaction(pool, async (tx) => {
    const receipt = await receiptRepo.updateReceiptImages(tx, id, images);
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }
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

async function updateReceipt({ pool, id, payload, requestId, endpoint }) {
  return withTransaction(pool, async (tx) => {
    const receipt = await receiptRepo.getReceipt(tx, id);
    if (!receipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }

    const itemsPayload = Array.isArray(payload.items) ? payload.items : null;
    const inventoryUpdates = [];

    if (itemsPayload) {
      const existingItems = await receiptRepo.getReceiptItems(tx, receipt.id);
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
          const inv = await inventoryRepo.getForUpdateById(tx, existing.inventory_id);
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

        const inv = await inventoryRepo.getForUpdateById(tx, existing.inventory_id);
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

    const updatedReceipt = await receiptRepo.updateReceipt(tx, receipt.id, payload);
    if (!updatedReceipt) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }

    const updatedItems = await receiptRepo.getReceiptItems(tx, receipt.id);
    return buildResponse(updatedReceipt, updatedItems, inventoryUpdates);
  });
}

module.exports = {
  createReceipt,
  listReceipts,
  getReceiptDetail,
  updateReceiptImages,
  updateReceipt,
};
