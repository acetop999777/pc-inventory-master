const express = require('express');

module.exports = function healthRoutes({ pool }) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: true, requestId: req.requestId || null });
    } catch {
      res.status(500).json({ ok: false, db: false, requestId: req.requestId || null });
    }
  });

  return router;
};
