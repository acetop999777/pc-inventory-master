// server/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const { runMigrations } = require('./db/migrate');
const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./errors/AppError');
const { applyInventoryBatch, updateInventoryItem } = require('./services/inventoryService');
const { createLog } = require('./services/logService');
const {
  createReceipt,
  listReceipts,
  getReceiptDetail,
  updateReceiptImages,
  updateReceipt,
} = require('./services/inboundReceiptService');

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

// -------- helpers --------
function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function normalizeDateOnly(v) {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  const s = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
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
  return normalizeDateOnly(v);
};

function assertClientInput(c) {
  const fields = [];

  const id = asNonEmptyString(c.id);
  if (!id) fields.push({ field: 'id', message: 'id is required' });

  const wechatName = asNonEmptyString(c.wechatName);
  if (!wechatName) fields.push({ field: 'wechatName', message: 'wechatName is required' });

  const orderDate = normalizeDateOnly(c.orderDate);
  if (!orderDate) fields.push({ field: 'orderDate', message: 'orderDate is required and must be YYYY-MM-DD' });

  const deliveryDate = c.deliveryDate ? normalizeDateOnly(c.deliveryDate) : null;
  if (c.deliveryDate && !deliveryDate) fields.push({ field: 'deliveryDate', message: 'deliveryDate must be YYYY-MM-DD' });

  const numeric = ['totalPrice', 'actualCost', 'profit', 'paidAmount', 'rating'];
  for (const k of numeric) {
    if (c[k] === undefined || c[k] === null || c[k] === '') continue;
    const n = Number(c[k]);
    if (!Number.isFinite(n)) fields.push({ field: k, message: `${k} must be a number` });
  }

  if (fields.length > 0) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'Validation failed',
      details: { fields },
    });
  }

  return { id, wechatName, orderDate, deliveryDate };
}

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

    
  // Ensure chk_clients_money_nonneg matches current semantics:
  // - total_price / actual_cost / paid_amount must be non-negative
  // - profit can be negative (or NULL)
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_clients_money_nonneg'
          AND conrelid = 'clients'::regclass
      ) THEN
        ALTER TABLE clients DROP CONSTRAINT chk_clients_money_nonneg;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE clients
    ADD CONSTRAINT chk_clients_money_nonneg CHECK (
      total_price >= 0
      AND actual_cost >= 0
      AND paid_amount >= 0
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        operation_id TEXT PRIMARY KEY,
        endpoint TEXT,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        response_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id BIGSERIAL PRIMARY KEY,
        inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        qty_delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        unit_cost NUMERIC(12,4) NULL,
        unit_cost_used NUMERIC(12,4) NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ref_type TEXT NULL,
        ref_id TEXT NULL,
        on_hand_after INTEGER NOT NULL,
        avg_cost_after NUMERIC(12,4) NOT NULL,
        request_id TEXT NULL,
        operation_id TEXT NOT NULL UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inbound_receipts (
        id BIGSERIAL PRIMARY KEY,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        vendor TEXT NULL,
        mode TEXT NOT NULL DEFAULT 'MANUAL',
        notes TEXT NULL,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        request_id TEXT NULL,
        operation_id TEXT NOT NULL UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inbound_receipt_items (
        id BIGSERIAL PRIMARY KEY,
        receipt_id BIGINT NOT NULL REFERENCES inbound_receipts(id) ON DELETE CASCADE,
        inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
        qty_received INTEGER NOT NULL CHECK (qty_received > 0),
        unit_cost NUMERIC(12,4) NOT NULL CHECK (unit_cost >= 0),
        line_total NUMERIC(12,4) GENERATED ALWAYS AS (qty_received * unit_cost) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_date ON inventory_movements(inventory_id, occurred_at DESC);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(ref_type, ref_id);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inbound_receipts_received_at ON inbound_receipts(received_at DESC);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inbound_receipt_items_receipt ON inbound_receipt_items(receipt_id);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_inbound_receipt_items_inventory_receipt ON inbound_receipt_items(inventory_id, receipt_id);`,
    );

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
    res.json({ ok: true, db: true, requestId: req.requestId || null });
  } catch {
    res.status(500).json({ ok: false, db: false, requestId: req.requestId || null });
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
    const includeArchivedRaw = String(req.query.includeArchived || '').toLowerCase();
    const includeArchived =
      includeArchivedRaw === '1' || includeArchivedRaw === 'true' || includeArchivedRaw === 'yes';
    const query = includeArchived
      ? 'SELECT * FROM inventory ORDER BY category, name'
      : `SELECT * FROM inventory
         WHERE status IS NULL OR lower(status) <> 'archived'
         ORDER BY category, name`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get('/api/inventory/:id/movements', async (req, res, next) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query(
      `SELECT m.*, r.vendor as receipt_vendor, r.received_at as receipt_received_at
       FROM inventory_movements m
       LEFT JOIN inbound_receipts r
         ON m.ref_type = 'RECEIPT' AND r.id::text = m.ref_id
       WHERE m.inventory_id = $1 AND m.qty_delta <> 0
       ORDER BY m.occurred_at ASC, m.id ASC`,
      [id],
    );

    let prevCost = 0;
    const normalized = rows.map((row) => {
      const qtyDelta = Number(row.qty_delta ?? 0);
      const onHandAfter = Number(row.on_hand_after ?? 0);
      const avgCostAfter = Number(row.avg_cost_after ?? 0);
      const prevQty = onHandAfter - qtyDelta;
      const prevCostVal = Number.isFinite(prevCost) ? prevCost : 0;
      prevCost = avgCostAfter;

      return {
        id: row.id,
        inventoryId: row.inventory_id,
        qtyDelta,
        reason: row.reason,
        unitCost: row.unit_cost != null ? Number(row.unit_cost) : null,
        unitCostUsed: row.unit_cost_used != null ? Number(row.unit_cost_used) : null,
        onHandAfter,
        avgCostAfter,
        occurredAt: row.occurred_at,
        refType: row.ref_type,
        refId: row.ref_id,
        vendor: row.receipt_vendor || null,
        receiptReceivedAt: row.receipt_received_at || null,
        prevQty,
        prevCost: prevCostVal,
      };
    });

    res.json(normalized.reverse());
  } catch (e) {
    next(e);
  }
});

app.post('/api/inventory/batch', async (req, res, next) => {
  const endpoint = req.originalUrl || req.url;
  const { operationId, items } = req.body || {};
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'inventory',
      event: 'inventory.batch.request',
      requestId: req.requestId || null,
      operationId,
      endpoint,
      itemCount: Array.isArray(items) ? items.length : 0,
    }),
  );
  try {
    const result = await applyInventoryBatch({
      pool,
      operationId,
      items,
      endpoint,
      requestId: req.requestId || null,
    });
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.batch.response',
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
        scope: 'inventory',
        event: 'inventory.batch.response',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        status: 'error',
        error: e?.code || e?.message || 'ERROR',
      }),
    );
    next(e);
  }
});

app.put('/api/inventory/:id', async (req, res, next) => {
  const id = req.params.id;
  const body = req.body || {};
  const endpoint = req.originalUrl || req.url;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'inventory',
      event: 'inventory.update.request',
      requestId: req.requestId || null,
      operationId: body.operationId,
      endpoint,
      inventoryId: id,
    }),
  );
  try {
    const row = await updateInventoryItem({
      pool,
      id,
      fields: body,
      operationId: body.operationId,
      requestId: req.requestId || null,
      endpoint,
    });
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.update.response',
        requestId: req.requestId || null,
        operationId: body.operationId,
        endpoint,
        inventoryId: id,
        status: 'success',
      }),
    );
    return res.json(row || { success: true });
  } catch (e) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.update.response',
        requestId: req.requestId || null,
        operationId: body.operationId,
        endpoint,
        inventoryId: id,
        status: 'error',
        error: e?.code || e?.message || 'ERROR',
      }),
    );
    next(e);
  }
});

app.delete('/api/inventory/:id', async (req, res, next) => {
  const endpoint = req.originalUrl || req.url;
  const operationId = req?.body?.operationId || req?.query?.operationId || null;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'inventory',
      event: 'inventory.delete.request',
      requestId: req.requestId || null,
      operationId,
      endpoint,
      inventoryId: req.params.id,
    }),
  );
  try {
    const invId = req.params.id;
    const { rows: refRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM inbound_receipt_items WHERE inventory_id = $1',
      [invId],
    );
    const refCount = Number(refRows?.[0]?.cnt ?? 0);
    if (refCount > 0) {
      const { rows: archivedRows } = await pool.query(
        `UPDATE inventory
         SET status = $2, quantity = 0, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [invId, 'Archived'],
      );
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          scope: 'inventory',
          event: 'inventory.delete.archived',
          requestId: req.requestId || null,
          operationId,
          endpoint,
          inventoryId: invId,
          refCount,
        }),
      );
      return res.json({ archived: true, refCount, item: archivedRows[0] || null });
    }

    await pool.query('DELETE FROM inventory WHERE id = $1', [invId]);
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.delete.response',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        inventoryId: req.params.id,
        status: 'success',
      }),
    );
    res.json({ success: true });
  } catch (e) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'inventory',
        event: 'inventory.delete.response',
        requestId: req.requestId || null,
        operationId,
        endpoint,
        inventoryId: req.params.id,
        status: 'error',
        error: e?.code || e?.message || 'ERROR',
      }),
    );
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

app.get('/api/clients/:id', async (req, res, next) => {
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

app.post('/api/clients', (req, res, next) => {
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
      ]
    )
    .then(() => res.json({ success: true }))
    .catch(next);

  } catch (e) {
    next(e);
  }
});

app.delete('/api/clients/:id', async (req, res, next) => {
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
        error: e?.code || e?.message || 'ERROR',
      }),
    );
    next(e);
  }
});

// ---- inbound receipts ----
app.get('/api/inbound/receipts', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const rows = await listReceipts({ pool, limit });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get('/api/inbound/receipts/:id', async (req, res, next) => {
  try {
    const result = await getReceiptDetail({ pool, id: req.params.id });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

app.post('/api/inbound/receipts', async (req, res, next) => {
  const endpoint = req.originalUrl || req.url;
  const payload = req.body || {};
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'receipts',
      event: 'receipt.create.request',
      requestId: req.requestId || null,
      operationId: payload.operationId,
      endpoint,
      itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
    }),
  );
  try {
    const result = await createReceipt({
      pool,
      operationId: payload.operationId,
      receivedAt: payload.receivedAt,
      vendor: payload.vendor,
      mode: payload.mode,
      notes: payload.notes,
      images: payload.images,
      items: payload.items,
      requestId: req.requestId || null,
      endpoint,
    });
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.create.response',
        requestId: req.requestId || null,
        operationId: payload.operationId,
        endpoint,
        status: 'success',
      }),
    );
    res.json(result);
  } catch (e) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.create.response',
        requestId: req.requestId || null,
        operationId: payload.operationId,
        endpoint,
        status: 'error',
        error: e?.code || e?.message || 'ERROR',
      }),
    );
    next(e);
  }
});

app.patch('/api/inbound/receipts/:id', async (req, res, next) => {
  const id = req.params.id;
  const payload = req.body || {};
  const endpoint = req.originalUrl || req.url;
  try {
    const result = await updateReceipt({
      pool,
      id,
      payload,
      requestId: req.requestId || null,
      endpoint,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/inbound/receipts/:id', async (req, res, next) => {
  const id = req.params.id;
  const endpoint = req.originalUrl || req.url;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'receipts',
      event: 'receipt.delete.request',
      requestId: req.requestId || null,
      endpoint,
      receiptId: id,
    }),
  );
  try {
    const { rows } = await pool.query('DELETE FROM inbound_receipts WHERE id = $1 RETURNING *', [
      id,
    ]);
    if (rows.length === 0) {
      throw new AppError({
        code: 'NOT_FOUND',
        httpStatus: 404,
        retryable: false,
        message: 'Receipt not found',
        details: { id },
      });
    }
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.delete.response',
        requestId: req.requestId || null,
        endpoint,
        receiptId: id,
        status: 'success',
      }),
    );
    res.json({ success: true });
  } catch (err) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'receipts',
        event: 'receipt.delete.response',
        requestId: req.requestId || null,
        endpoint,
        receiptId: id,
        status: 'error',
        error: err?.code || err?.message || 'ERROR',
      }),
    );
    next(err);
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
