const express = require('express');
const { applyInventoryBatch, updateInventoryItem } = require('../services/inventoryService');
const {
  assertInventoryBatchPayload,
  assertInventoryUpdatePayload,
} = require('../validators/inventoryValidator');

/** @typedef {{ pool: import('pg').Pool }} RouteDeps */
/** @typedef {{ code?: unknown, message?: unknown }} ErrorLike */

/**
 * @param {unknown} err
 * @returns {string}
 */
function errorCode(err) {
  if (!err || typeof err !== 'object') return 'ERROR';
  const e = /** @type {ErrorLike} */ (err);
  if (typeof e.code === 'string' && e.code) return e.code;
  if (typeof e.message === 'string' && e.message) return e.message;
  return 'ERROR';
}

/**
 * @param {RouteDeps} deps
 */
module.exports = function inventoryRoutes({ pool }) {
  const router = express.Router();

  router.get('/inventory', async (req, res, next) => {
    try {
      const includeArchivedRaw = String(req.query.includeArchived || '').toLowerCase();
      const includeArchived =
        includeArchivedRaw === '1' || includeArchivedRaw === 'true' || includeArchivedRaw === 'yes';
      const query = includeArchived
        ? 'SELECT * FROM inventory ORDER BY category, name'
        : `SELECT * FROM inventory
           WHERE status IS NULL OR lower(status) <> 'archived'
           ORDER BY category, name`;
      const { rows } = await pool.query(query);
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  router.get('/inventory/:id/movements', async (req, res, next) => {
    const id = req.params.id;
    try {
      const { rows } = await pool.query(
        `SELECT m.*, r.vendor as receipt_vendor, r.received_at as receipt_received_at
         FROM inventory_movements m
         LEFT JOIN inbound_receipts r
           ON m.ref_type = 'RECEIPT' AND r.id::text = m.ref_id
         WHERE m.inventory_id = $1 AND m.qty_delta <> 0
         ORDER BY m.occurred_at ASC, m.id ASC`,
        [id],
      );

      let prevCost = 0;
      const normalized = rows.map((row) => {
        /** @type {Record<string, unknown>} */
        const entry = row;
        const qtyDelta = Number(entry.qty_delta ?? 0);
        const onHandAfter = Number(entry.on_hand_after ?? 0);
        const avgCostAfter = Number(entry.avg_cost_after ?? 0);
        const prevQty = onHandAfter - qtyDelta;
        const prevCostVal = Number.isFinite(prevCost) ? prevCost : 0;
        prevCost = avgCostAfter;

        return {
          id: entry.id,
          inventoryId: entry.inventory_id,
          qtyDelta,
          reason: entry.reason,
          unitCost: entry.unit_cost != null ? Number(entry.unit_cost) : null,
          unitCostUsed: entry.unit_cost_used != null ? Number(entry.unit_cost_used) : null,
          onHandAfter,
          avgCostAfter,
          occurredAt: entry.occurred_at,
          refType: entry.ref_type,
          refId: entry.ref_id,
          vendor: entry.receipt_vendor || null,
          receiptReceivedAt: entry.receipt_received_at || null,
          prevQty,
          prevCost: prevCostVal,
        };
      });

      res.json(normalized.reverse());
    } catch (e) {
      next(e);
    }
  });

  router.post('/inventory/batch', async (req, res, next) => {
    const endpoint = req.originalUrl || req.url;
    let payload;
    try {
      payload = assertInventoryBatchPayload(req.body || {});
    } catch (e) {
      return next(e);
    }
    const { operationId, items } = payload;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.batch.request',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        itemCount: Array.isArray(items) ? items.length : 0,
      }),
    );
    try {
      const result = await applyInventoryBatch({
        pool,
        operationId,
        items,
        endpoint,
        requestId: req.requestId || null,
      });
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.batch.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          status: 'success',
        }),
      );
      res.json(result);
    } catch (e) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.batch.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          status: 'error',
          error: errorCode(e),
        }),
      );
      next(e);
    }
  });

  router.put('/inventory/:id', async (req, res, next) => {
    const id = req.params.id;
    let body;
    try {
      body = assertInventoryUpdatePayload(req.body || {});
    } catch (e) {
      return next(e);
    }
    const endpoint = req.originalUrl || req.url;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.update.request',
        requestId: req.requestId || null,
        operationId: body.operationId,
        endpoint,
        inventoryId: id,
      }),
    );
    try {
      const row = await updateInventoryItem({
        pool,
        id,
        fields: body,
        operationId: body.operationId,
        requestId: req.requestId || null,
        endpoint,
      });
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.update.response',
          requestId: req.requestId || null,
          operationId: body.operationId,
          endpoint,
          inventoryId: id,
          status: 'success',
        }),
      );
      return res.json(row || { success: true });
    } catch (e) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.update.response',
          requestId: req.requestId || null,
          operationId: body.operationId,
          endpoint,
          inventoryId: id,
          status: 'error',
          error: errorCode(e),
        }),
      );
      next(e);
    }
  });

  router.delete('/inventory/:id', async (req, res, next) => {
    const endpoint = req.originalUrl || req.url;
    const operationId = req?.body?.operationId || req?.query?.operationId || null;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.delete.request',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        inventoryId: req.params.id,
      }),
    );
    try {
      const invId = req.params.id;
      const { rows: refRows } = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM inbound_receipt_items WHERE inventory_id = $1',
        [invId],
      );
      const refCount = Number(refRows?.[0]?.cnt ?? 0);
      if (refCount > 0) {
        const { rows: archivedRows } = await pool.query(
          `UPDATE inventory
           SET status = $2, quantity = 0, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [invId, 'Archived'],
        );
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            scope: 'inventory',
            event: 'inventory.delete.archived',
            requestId: req.requestId || null,
            operationId,
            endpoint,
            inventoryId: invId,
            refCount,
          }),
        );
        return res.json({ archived: true, refCount, item: archivedRows[0] || null });
      }

      await pool.query('DELETE FROM inventory WHERE id = $1', [invId]);
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.delete.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          inventoryId: req.params.id,
          status: 'success',
        }),
      );
      res.json({ success: true });
    } catch (e) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.delete.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          inventoryId: req.params.id,
          status: 'error',
          error: errorCode(e),
        }),
      );
      next(e);
    }
  });

  return router;
};
