const express = require('express');
const AppError = require('../errors/AppError');
const {
  createReceipt,
  listReceipts,
  getReceiptDetail,
  updateReceipt,
} = require('../services/inboundReceiptService');

module.exports = function inboundRoutes({ pool }) {
  const router = express.Router();

  router.get('/inbound/receipts', async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 50);
      const rows = await listReceipts({ pool, limit });
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  router.get('/inbound/receipts/:id', async (req, res, next) => {
    try {
      const result = await getReceiptDetail({ pool, id: req.params.id });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post('/inbound/receipts', async (req, res, next) => {
    const endpoint = req.originalUrl || req.url;
    const payload = req.body || {};
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.create.request',
        requestId: req.requestId || null,
        operationId: payload.operationId,
        endpoint,
        itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
      }),
    );
    try {
      const result = await createReceipt({
        pool,
        operationId: payload.operationId,
        receivedAt: payload.receivedAt,
        vendor: payload.vendor,
        mode: payload.mode,
        notes: payload.notes,
        images: payload.images,
        items: payload.items,
        requestId: req.requestId || null,
        endpoint,
      });
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'receipts',
          event: 'receipt.create.response',
          requestId: req.requestId || null,
          operationId: payload.operationId,
          endpoint,
          status: 'success',
        }),
      );
      res.json(result);
    } catch (e) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'receipts',
          event: 'receipt.create.response',
          requestId: req.requestId || null,
          operationId: payload.operationId,
          endpoint,
          status: 'error',
          error: e?.code || e?.message || 'ERROR',
        }),
      );
      next(e);
    }
  });

  router.patch('/inbound/receipts/:id', async (req, res, next) => {
    const id = req.params.id;
    const payload = req.body || {};
    const endpoint = req.originalUrl || req.url;
    try {
      const result = await updateReceipt({
        pool,
        id,
        payload,
        requestId: req.requestId || null,
        endpoint,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/inbound/receipts/:id', async (req, res, next) => {
    const id = req.params.id;
    const endpoint = req.originalUrl || req.url;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.delete.request',
        requestId: req.requestId || null,
        endpoint,
        receiptId: id,
      }),
    );
    try {
      const { rows } = await pool.query('DELETE FROM inbound_receipts WHERE id = $1 RETURNING *', [
        id,
      ]);
      if (rows.length === 0) {
        throw new AppError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          retryable: false,
          message: 'Receipt not found',
          details: { id },
        });
      }
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'receipts',
          event: 'receipt.delete.response',
          requestId: req.requestId || null,
          endpoint,
          receiptId: id,
          status: 'success',
        }),
      );
      res.json({ success: true });
    } catch (err) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'receipts',
          event: 'receipt.delete.response',
          requestId: req.requestId || null,
          endpoint,
          receiptId: id,
          status: 'error',
          error: err?.code || err?.message || 'ERROR',
        }),
      );
      next(err);
    }
  });

  return router;
};
