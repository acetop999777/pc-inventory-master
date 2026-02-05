import express from 'express';
import type { Pool } from 'pg';
import AppError = require('../errors/AppError');
import { mapClient } from '../mappers/clientMapper';
import type { RequestWithId } from '../middleware/requestId';
import { deleteClient, upsertClient } from '../services/clientService';

type RouteDeps = { pool: Pool };

function clientsRoutes({ pool }: RouteDeps) {
  const router = express.Router();

  router.get('/clients', async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC');
      res.json(rows.map(mapClient));
    } catch (e) {
      next(e);
    }
  });

  router.get('/clients/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (rows.length === 0) {
        throw new AppError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          retryable: false,
          message: 'Client not found',
          details: { id },
        });
      }
      res.json(mapClient(rows[0]));
    } catch (e) {
      next(e);
    }
  });

  router.post('/clients', (req: RequestWithId, res, next) => {
    // ✅ Express4 最稳写法：不依赖 async handler 的 promise 捕获
    try {
      const payload = (req.body && typeof req.body === 'object') ? req.body : {};
      const endpoint = req.originalUrl || req.url;
      upsertClient({
        pool,
        payload,
        requestId: req.requestId || null,
        endpoint,
      })
        .then((result) => res.json(result))
        .catch(next);
    } catch (e) {
      next(e);
    }
  });

  router.delete('/clients/:id', (req: RequestWithId, res, next) => {
    try {
      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      const endpoint = req.originalUrl || req.url;
      const operationId =
        (body as Record<string, unknown>).operationId ??
        (typeof req.query?.operationId === 'string' ? req.query.operationId : null);
      deleteClient({
        pool,
        id: req.params.id,
        operationId,
        requestId: req.requestId || null,
        endpoint,
      })
        .then((result) => res.json(result))
        .catch(next);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export default clientsRoutes;
