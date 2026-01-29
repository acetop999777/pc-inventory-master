const express = require('express');

module.exports = function dashboardRoutes({ pool }) {
  const router = express.Router();

  router.get('/dashboard/stats', async (req, res, next) => {
    try {
      const invRes = await pool.query(
        'SELECT SUM(cost * quantity) as total_inv_value, SUM(quantity) as total_items FROM inventory',
      );
      const clientRes = await pool.query(
        'SELECT COUNT(*) as total_clients, SUM(profit) as total_profit, SUM(total_price - paid_amount) as total_balance FROM clients',
      );

      res.json({
        inventoryValue: parseFloat(invRes.rows[0].total_inv_value || 0),
        totalItems: parseInt(invRes.rows[0].total_items || 0, 10),
        totalClients: parseInt(clientRes.rows[0].total_clients || 0, 10),
        totalProfit: parseFloat(clientRes.rows[0].total_profit || 0),
        totalBalanceDue: parseFloat(clientRes.rows[0].total_balance || 0),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/dashboard/profit', async (req, res, next) => {
    const { start, end, group } = req.body || {};
    let trunc = 'day',
      fmt = 'YYYY-MM-DD';
    if (group === 'week') trunc = 'week';
    if (group === 'month') {
      trunc = 'month';
      fmt = 'YYYY-MM';
    }
    try {
      const { rows } = await pool.query(
        `SELECT to_char(date_trunc($1, order_date), $2) as label, SUM(profit) as value
         FROM clients
         WHERE order_date BETWEEN $3 AND $4
         GROUP BY 1
         ORDER BY 1 ASC`,
        [trunc, fmt, start, end],
      );
      res.json(rows.map((r) => ({ date: r.label, profit: parseFloat(r.value) })));
    } catch (err) {
      next(err);
    }
  });

  return router;
};
