import express from 'express';
import type { Pool } from 'pg';
import { createLog } from '../services/logService';
import type { RequestWithId } from '../middleware/requestId';

type RouteDeps = { pool: Pool };
type ErrorLike = { code?: unknown; message?: unknown };

function errorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return 'ERROR';
  const e = err as ErrorLike;
  if (typeof e.code === 'string' && e.code) return e.code;
  if (typeof e.message === 'string' && e.message) return e.message;
  return 'ERROR';
}

function logsRoutes({ pool }: RouteDeps) {
  const router = express.Router();

  router.get('/logs', async (req: RequestWithId, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  router.post('/logs', async (req: RequestWithId, res, next) => {
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
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'logs',
          event: 'logs.create.response',
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

  return router;
}

export default logsRoutes;
