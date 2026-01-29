const express = require('express');
const AppError = require('../errors/AppError');
const { assertClientInput } = require('../validators/clientValidator');
const { mapClient } = require('../mappers/clientMapper');

module.exports = function clientsRoutes({ pool }) {
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

  router.post('/clients', (req, res, next) => {
    // ✅ Express4 最稳写法：不依赖 async handler 的 promise 捕获
    try {
      const c = (req.body && typeof req.body === 'object') ? req.body : {};

      // Phase 8.3: 收口散装错误到明确 code
      const validated = assertClientInput(c);

      pool.query(
        `INSERT INTO clients (
          id, wechat_name, wechat_id, real_name, xhs_name, xhs_id,
          order_date, delivery_date,
          pcpp_link, is_shipping, tracking_number,
          address_line, city, state, zip_code, status,
          total_price, actual_cost, profit, paid_amount, specs, photos, rating, notes, phone, metadata
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,
          $9,$10,$11,
          $12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26
        )
        ON CONFLICT (id) DO UPDATE SET
          wechat_name=EXCLUDED.wechat_name,
          wechat_id=EXCLUDED.wechat_id,
          real_name=EXCLUDED.real_name,
          xhs_name=EXCLUDED.xhs_name,
          xhs_id=EXCLUDED.xhs_id,
          order_date=EXCLUDED.order_date,
          delivery_date=EXCLUDED.delivery_date,
          pcpp_link=EXCLUDED.pcpp_link,
          is_shipping=EXCLUDED.is_shipping,
          tracking_number=EXCLUDED.tracking_number,
          address_line=EXCLUDED.address_line,
          city=EXCLUDED.city,
          state=EXCLUDED.state,
          zip_code=EXCLUDED.zip_code,
          status=EXCLUDED.status,
          total_price=EXCLUDED.total_price,
          actual_cost=EXCLUDED.actual_cost,
          profit=EXCLUDED.profit,
          paid_amount=EXCLUDED.paid_amount,
          specs=EXCLUDED.specs,
          photos=EXCLUDED.photos,
          rating=EXCLUDED.rating,
          notes=EXCLUDED.notes,
          phone=EXCLUDED.phone,
          metadata=EXCLUDED.metadata`,
        [
          validated.id,
          validated.wechatName,
          c.wechatId,
          c.realName,
          c.xhsName,
          c.xhsId,

          validated.orderDate,
          validated.deliveryDate,

          c.pcppLink,
          c.isShipping,
          c.trackingNumber,

          c.address,
          c.city,
          c.state,
          c.zip,
          c.status,

          c.totalPrice,
          c.actualCost,
          c.profit,
          c.paidAmount,

          JSON.stringify(c.specs || {}),
          JSON.stringify(c.photos || []),
          c.rating,
          c.notes,
          c.phone || '',
          JSON.stringify(c.metadata || {}),
        ],
      )
        .then(() => res.json({ success: true }))
        .catch(next);

    } catch (e) {
      next(e);
    }
  });

  router.delete('/clients/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      const r = await pool.query('DELETE FROM clients WHERE id = $1', [id]);
      if ((r.rowCount || 0) === 0) {
        throw new AppError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          retryable: false,
          message: 'Client not found',
          details: { id },
        });
      }
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
};
