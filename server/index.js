// server/index.js
const { app } = require('./app');
const { pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');

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

function shouldInitDb() {
  const raw = String(process.env.INIT_DB || '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function bootstrap() {
  await waitForDb();
  if (shouldInitDb()) {
    console.log('[bootstrap] INIT_DB enabled: running baseline initDB()');
    await initDB();
  } else {
    console.log('[bootstrap] INIT_DB disabled: skip baseline initDB()');
  }
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
