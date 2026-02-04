import express from 'express';
import type { Pool } from 'pg';
import { createLog } from '../services/logService';
import type { RequestWithId } from '../middleware/requestId';
import { coerceLimit } from '../validators/requestUtils';

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
      const type =
        typeof req.query?.type === 'string' && req.query.type.trim()
          ? req.query.type.trim()
          : null;
      const event =
        typeof req.query?.event === 'string' && req.query.event.trim()
          ? req.query.event.trim()
          : null;
      const from = Number(req.query?.from);
      const to = Number(req.query?.to);
      const limit = coerceLimit(req.query?.limit, { min: 1, max: 500, fallback: 200 });
      const clauses: string[] = [];
      const values: Array<string | number> = [];
      let idx = 1;

      if (type) {
        clauses.push(`type = $${idx}`);
        values.push(type);
        idx += 1;
      }
      if (Number.isFinite(from)) {
        clauses.push(`timestamp >= $${idx}`);
        values.push(Math.floor(from));
        idx += 1;
      }
      if (Number.isFinite(to)) {
        clauses.push(`timestamp <= $${idx}`);
        values.push(Math.floor(to));
        idx += 1;
      }
      if (event) {
        clauses.push(`(title ILIKE $${idx} OR meta->>'event' ILIKE $${idx})`);
        values.push(`%${event}%`);
        idx += 1;
      }

      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const limitIndex = idx;
      values.push(limit);

      const { rows } = await pool.query(
        `SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT $${limitIndex}`,
        values,
      );
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
