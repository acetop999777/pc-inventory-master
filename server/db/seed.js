/**
 * @param {import('pg').Pool} pool
 */
async function seedIfEnabled(pool) {
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
    `,
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
    `,
  );

  console.log('[seed] ✅ done');
}

module.exports = { seedIfEnabled };
