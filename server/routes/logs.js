const express = require('express');
const { createLog } = require('../services/logService');

/** @typedef {{ pool: import('pg').Pool }} RouteDeps */

/**
 * @param {RouteDeps} deps
 */
module.exports = function logsRoutes({ pool }) {
  const router = express.Router();

  router.get('/logs', async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  router.post('/logs', async (req, res, next) => {
    const endpoint = req.originalUrl || req.url;
    const { operationId, ...log } = req.body || {};
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'logs',
        event: 'logs.create.request',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        logId: log?.id,
      }),
    );
    try {
      const result = await createLog({
        pool,
        operationId,
        log,
        endpoint,
        requestId: req.requestId || null,
      });
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'logs',
          event: 'logs.create.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          status: 'success',
        }),
      );
      res.json(result);
    } catch (e) {
      const errAny = /** @type {any} */ (e);
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'logs',
          event: 'logs.create.response',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          status: 'error',
          error: errAny?.code || errAny?.message || 'ERROR',
        }),
      );
      next(e);
    }
  });

  return router;
};
