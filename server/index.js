// server/index.js
const { app } = require('./app');
const { pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');
// initDB removed from bootstrap; migrations are the single schema source of truth.

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

function isInitDbRequested() {
  const raw = String(process.env.INIT_DB || '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function bootstrap() {
  await waitForDb();
  if (isInitDbRequested()) {
    console.warn('[bootstrap] INIT_DB is deprecated; migrations only. Skipping initDB().');
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
