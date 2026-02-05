import express from 'express';
import type { Pool } from 'pg';
import type { RequestWithId } from '../middleware/requestId';

type RouteDeps = { pool: Pool };

function healthRoutes({ pool }: RouteDeps) {
  const router = express.Router();

  router.get('/health', async (req: RequestWithId, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: true, requestId: req.requestId || null });
    } catch {
      res.status(500).json({ ok: false, db: false, requestId: req.requestId || null });
    }
  });

  return router;
}

export default healthRoutes;
