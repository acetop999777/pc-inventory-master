const express = require('express');

module.exports = function lookupRoutes({ pool }) {
  const router = express.Router();

  router.get('/lookup/:code', async (req, res) => {
    try {
      const code = req.params.code;
      const cacheRes = await pool.query('SELECT data FROM product_cache WHERE barcode = $1', [code]);
      if (cacheRes.rows.length > 0) return res.json(cacheRes.rows[0].data);

      const apiRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
      if (!apiRes.ok) throw new Error('API Failed');
      const data = await apiRes.json();

      if (data.items && data.items.length > 0) {
        await pool.query(
          `INSERT INTO product_cache (barcode, data)
           VALUES ($1, $2)
           ON CONFLICT (barcode) DO UPDATE SET data = EXCLUDED.data`,
          [code, data],
        );
      }
      res.json(data);
    } catch (e) {
      res.json({ items: [] });
    }
  });

  return router;
};
