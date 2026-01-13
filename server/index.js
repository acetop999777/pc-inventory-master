// server/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const { runMigrations } = require('./db/migrate');
const requestId = require('./middleware/requestId');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(requestId);

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'inventory_db',
  // ✅ 默认对齐你现在的 compose/.env，避免 securepassword 导致 28P01
  password: process.env.POSTGRES_PASSWORD || 'change_me',
  port: 5432,
});

// -------- helpers: error contract --------
function getReqId(req) {
  return (
    req.requestId ||
    req.id ||
    req.headers['x-request-id'] ||
    req.headers['X-Request-Id'] ||
    ''
  );
}

function sendError(res, req, status, code, message, retryable = false, details = undefined) {
  const payload = {
    code,
    message,
    retryable,
    requestId: getReqId(req),
  };
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

function notFound(req, res) {
  return sendError(res, req, 404, 'NOT_FOUND', 'Route not found', false);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err && err.status ? err.status : 500;
  const code =
    err && err.codeName
      ? err.codeName
      : err && err.code
        ? `PG_${err.code}`
        : 'INTERNAL_ERROR';
  const message = err && err.message ? err.message : 'Internal server error';

  const details =
    status >= 500
      ? { hint: 'Check server logs', pg: err && err.code ? err.code : undefined }
      : err && err.details
        ? err.details
        : undefined;

  return sendError(res, req, status, code, message, status >= 500, details);
}

// -------- date helpers --------
// Contract: date-only YYYY-MM-DD
const fmtDate = (d) => {
  if (!d) return '';
  // pg DATE often returns 'YYYY-MM-DD' string; keep stable
  if (typeof d === 'string') return d.slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

// DB write helper: accept 'YYYY-MM-DD' or ISO string; returns null/DATE
const toDateOnly = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const mapClient = (r) => ({
  id: r.id,
  wechatName: r.wechat_name,
  wechatId: r.wechat_id || '',
  realName: r.real_name || '',
  xhsName: r.xhs_name || '',
  xhsId: r.xhs_id || '',
  orderDate: fmtDate(r.order_date),
  deliveryDate: fmtDate(r.delivery_date),
  isShipping: r.is_shipping,
  trackingNumber: r.tracking_number || '',
  pcppLink: r.pcpp_link || '',
  address: r.address_line || '',
  city: r.city || '',
  state: r.state || '',
  zip: r.zip_code || '',
  status: r.status,
  rating: r.rating || 0,
  notes: r.notes || '',
  totalPrice: parseFloat(r.total_price || 0),
  actualCost: parseFloat(r.actual_cost || 0),
  profit: parseFloat(r.profit || 0),
  paidAmount: parseFloat(r.paid_amount || 0),
  phone: r.phone || '',
  metadata: r.metadata || {},
  specs: r.specs || {},
  photos: r.photos || [],
});

// -------- DB init (baseline schema) --------
// NOTE: 现在仍保留 baseline init（后续我们会逐步收敛到 migrations）
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(255) PRIMARY KEY,
        wechat_name VARCHAR(255),
        wechat_id VARCHAR(255),
        real_name VARCHAR(255),
        xhs_name VARCHAR(255),
        xhs_id VARCHAR(255),

        photos JSONB DEFAULT '[]'::jsonb,
        rating INTEGER DEFAULT 0,
        notes TEXT,

        order_date DATE NOT NULL,
        delivery_date DATE,

        pcpp_link VARCHAR(500),
        is_shipping BOOLEAN DEFAULT FALSE,
        tracking_number VARCHAR(100),

        address_line VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),
        status VARCHAR(50),

        total_price NUMERIC(10, 2) DEFAULT 0,
        actual_cost NUMERIC(10, 2) DEFAULT 0,
        profit NUMERIC(10, 2) DEFAULT 0,
        paid_amount NUMERIC(10, 2) DEFAULT 0,

        specs JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        phone VARCHAR(50),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        category TEXT,
        name TEXT,
        keyword TEXT,
        sku TEXT,
        quantity INTEGER DEFAULT 0,
        cost NUMERIC(10,2) DEFAULT 0,
        price NUMERIC(10,2) DEFAULT 0,
        location TEXT,
        status TEXT,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_cache (
        barcode VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        sku TEXT,
        name TEXT,
        type TEXT,
        qty_change INTEGER,
        unit_cost NUMERIC,
        total_value NUMERIC,
        ref_id TEXT,
        operator TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp BIGINT,
        type TEXT,
        title TEXT,
        msg TEXT,
        meta JSONB
      );
    `);

    // indexes (fresh db 也自动有)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_order_date ON clients(order_date DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inventory_category_name ON inventory(category, name);`);

    // ✅ 只保留这一条 SKU 规则：非空白时 lower(trim) 唯一
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_sku_norm_nonempty
      ON inventory (lower(btrim(sku)))
      WHERE sku IS NOT NULL AND btrim(sku) <> '';
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_sku ON audit_logs(sku);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(date DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_ref ON audit_logs(ref_id);`);

    console.log('Database initialized.');
  } catch (err) {
    console.error('DB init error:', err);
    throw err;
  }
};

// -------- optional startup cleanup (ONLY when STARTUP_CLEANUP=true) --------
// 推荐：用 migration 003 一次性做；这里留个紧急开关（默认 false）
async function startupCleanupIfEnabled() {
  const on = String(process.env.STARTUP_CLEANUP || '').toLowerCase() === 'true';
  if (!on) return;

  console.log('[cleanup] STARTUP_CLEANUP=true -> running cleanup (idempotent)');

  // Video Card -> GPU (only if GPU missing OR GPU.name blank)
  const r = await pool.query(`
    UPDATE clients
    SET specs =
      CASE
        WHEN specs IS NULL THEN NULL
        WHEN NOT (specs ? 'Video Card') THEN specs
        WHEN (NOT (specs ? 'GPU'))
             OR (specs->'GPU'->>'name' IS NULL)
             OR (btrim(specs->'GPU'->>'name') = '')
          THEN jsonb_set(specs - 'Video Card', '{GPU}', specs->'Video Card', true)
        ELSE (specs - 'Video Card')
      END
    WHERE specs IS NOT NULL
      AND (specs ? 'Video Card')
    RETURNING id;
  `);

  console.log(`[cleanup] Video Card -> GPU: updated=${r.rowCount || 0}`);
}

// -------- optional seed (ONLY when SEED=true) --------
async function seedIfEnabled() {
  const on = String(process.env.SEED || '').toLowerCase() === 'true';
  if (!on) {
    console.log('[seed] disabled (set SEED=true to enable)');
    return;
  }

  console.log('[seed] enabled -> inserting demo rows (idempotent)');

  // clients
  await pool.query(
    `
    INSERT INTO clients (
      id, wechat_name, wechat_id, real_name, xhs_name, xhs_id,
      order_date, delivery_date,
      pcpp_link, is_shipping, tracking_number,
      address_line, city, state, zip_code, status,
      total_price, actual_cost, profit, paid_amount,
      specs, photos, rating, notes, phone, metadata
    ) VALUES
      (
        'seed_client_002','王','W20260113001','Demo Client','demo_xhs','xhs_001',
        '2026-01-13','2026-01-20',
        '','false','',
        '1 Demo St','San Mateo','CA','94401','In Progress',
        2999.00, 2499.00, 500.00, 1000.00,
        '{}'::jsonb,'[]'::jsonb, 3, 'seed row', '','{}'::jsonb
      )
    ON CONFLICT (id) DO NOTHING;
    `
  );

  // inventory
  await pool.query(
    `
    INSERT INTO inventory (
      id, category, name, keyword, sku, quantity, cost, price, location, status, notes, metadata, updated_at
    ) VALUES
      (
        'seed_inv_004','CASE','Lian Li O11 Dynamic EVO','o11 evo',NULL,1,149.00,199.00,'Shelf D4','In Stock','seed row','{}'::jsonb,NOW()
      )
    ON CONFLICT (id) DO NOTHING;
    `
  );

  console.log('[seed] ✅ done');
}

// -------- routes --------
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true, requestId: getReqId(req) });
  } catch {
    res.status(500).json({ ok: false, db: false, requestId: getReqId(req) });
  }
});

app.get('/api/dashboard/stats', async (req, res, next) => {
  try {
    const invRes = await pool.query(
      'SELECT SUM(cost * quantity) as total_inv_value, SUM(quantity) as total_items FROM inventory'
    );
    const clientRes = await pool.query(
      'SELECT COUNT(*) as total_clients, SUM(profit) as total_profit, SUM(total_price - paid_amount) as total_balance FROM clients'
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

app.post('/api/dashboard/profit', async (req, res, next) => {
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
      [trunc, fmt, start, end]
    );
    res.json(rows.map((r) => ({ date: r.label, profit: parseFloat(r.value) })));
  } catch (err) {
    next(err);
  }
});

app.get('/api/inventory', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inventory ORDER BY category, name');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.post('/api/inventory/batch', async (req, res, next) => {
  const items = req.body || [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const { rows } = await client.query('SELECT * FROM inventory WHERE id = $1', [item.id]);
      if (rows.length > 0) {
        await client.query(
          `UPDATE inventory
           SET quantity=$1, cost=$2, name=$3, keyword=$4, sku=$5, category=$6,
               price=$7, location=$8, status=$9, notes=$10, updated_at=NOW()
           WHERE id=$11`,
          [
            item.quantity,
            item.cost,
            item.name,
            item.keyword,
            item.sku,
            item.category,
            item.price || 0,
            item.location || '',
            item.status || 'In Stock',
            item.notes || '',
            item.id,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost, price, location, status, notes, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
          [
            item.id,
            item.category,
            item.name,
            item.keyword,
            item.sku,
            item.quantity,
            item.cost,
            item.price || 0,
            item.location || '',
            item.status || 'In Stock',
            item.notes || '',
          ]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

app.put('/api/inventory/:id', async (req, res, next) => {
  const id = req.params.id;
  const body = req.body || {};
  const allowed = ['category', 'name', 'keyword', 'sku', 'quantity', 'cost', 'price', 'location', 'status', 'notes'];

  const sets = [];
  const values = [];
  let idx = 1;

  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      sets.push(`${k} = $${idx++}`);
      values.push(body[k]);
    }
  }

  try {
    if (sets.length === 0) {
      await pool.query(`UPDATE inventory SET updated_at = NOW() WHERE id = $1`, [id]);
      const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
      return res.json(rows[0] || { success: true });
    }

    values.push(id);
    const q = `UPDATE inventory SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const r = await pool.query(q, values);
    return res.json(r.rows[0] || { success: true });
  } catch (e) {
    next(e);
  }
});

app.delete('/api/inventory/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.get('/api/clients', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC');
    res.json(rows.map(mapClient));
  } catch (e) {
    next(e);
  }
});

app.post('/api/clients', async (req, res, next) => {
  const c = req.body || {};

  if (!c.id || !c.wechatName || !c.orderDate) {
    return sendError(
      res,
      req,
      400,
      'VALIDATION_FAILED',
      'Missing required fields: id, wechatName, orderDate',
      false,
      { required: ['id', 'wechatName', 'orderDate'] }
    );
  }

  try {
    await pool.query(
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
        c.id,
        c.wechatName,
        c.wechatId,
        c.realName,
        c.xhsName,
        c.xhsId,

        toDateOnly(c.orderDate),
        toDateOnly(c.deliveryDate),

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
      ]
    );

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.delete('/api/clients/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.get('/api/lookup/:code', async (req, res) => {
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
        [code, data]
      );
    }
    res.json(data);
  } catch (e) {
    res.json({ items: [] });
  }
});

app.get('/api/logs', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.post('/api/logs', async (req, res, next) => {
  const { id, timestamp, type, title, msg, meta } = req.body || {};
  try {
    await pool.query(
      'INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, timestamp, type, title, msg, meta]
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// --- Global error contract ---
app.use(notFound);
app.use(errorHandler);

// -------- bootstrap --------
async function waitForDb({ attempts = 30, delayMs = 1000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`[db] not ready (${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('DB not ready after retries');
}

async function bootstrap() {
  await waitForDb();
  await initDB();
  await runMigrations(pool);
  await startupCleanupIfEnabled(); // ✅ 默认不跑（STARTUP_CLEANUP=true 才跑）
  await seedIfEnabled();

  const PORT = Number(process.env.PORT || 5000);
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
  process.exit(1);
});

// graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});
process.on('SIGINT', async () => {
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});
