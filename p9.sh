cd ~/pc-inventory-master
mkdir -p server/db

cat > server/db/seed.sql <<'SQL'
BEGIN;

-- =========================
-- Seed: INVENTORY
-- =========================
INSERT INTO inventory (
  id, category, name, keyword, sku, quantity, cost, price, location, status, notes, updated_at
) VALUES
  ('seed_inv_001', 'CPU',    'AMD Ryzen 7 7800X3D',            '7800x3d', 'CPU-7800X3D',  3, 329.00, 399.00, 'Shelf A1', 'In Stock', 'seed item', NOW()),
  ('seed_inv_002', 'GPU',    'NVIDIA GeForce RTX 4080 SUPER',  '4080s',   'GPU-4080S',     2, 899.00, 1099.00,'Shelf B2', 'In Stock', 'seed item', NOW()),
  ('seed_inv_003', 'COOLER', 'MSI MAG Coreliquid A15 360 BLK', 'a15 360', 'COOL-A15-360',  5, 109.99, 149.99, 'Shelf C3', 'In Stock', 'seed item', NOW()),
  -- 演示：允许无 SKU（不触发 partial unique）
  ('seed_inv_004', 'CASE',   'Lian Li O11 Dynamic EVO',        'o11 evo', NULL,            1, 149.00, 199.00, 'Shelf D4', 'In Stock', 'seed item (no sku)', NOW())
ON CONFLICT (id) DO UPDATE SET
  category   = EXCLUDED.category,
  name       = EXCLUDED.name,
  keyword    = EXCLUDED.keyword,
  sku        = EXCLUDED.sku,
  quantity   = EXCLUDED.quantity,
  cost       = EXCLUDED.cost,
  price      = EXCLUDED.price,
  location   = EXCLUDED.location,
  status     = EXCLUDED.status,
  notes      = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;

-- =========================
-- Seed: CLIENTS
-- 注意：clients.order_date 是 NOT NULL
-- =========================
INSERT INTO clients (
  id, wechat_name, wechat_id, real_name, xhs_name, xhs_id,
  order_date, delivery_date,
  pcpp_link, is_shipping, tracking_number,
  address_line, city, state, zip_code, status,
  total_price, actual_cost, profit, paid_amount,
  specs, photos, rating, notes, phone, metadata
) VALUES
  (
    'seed_client_001',
    '杜', 'D18032112315', 'Chengyuan Du', '', '',
    '2026-01-12', NULL,
    '', FALSE, '',
    '', '', '', '', 'New',
    2999.00, 2499.00, 500.00, 1000.00,
    '{"CPU":{"name":"AMD Ryzen 7 7800X3D"},"GPU":{"name":"RTX 4080 SUPER"},"RAM":{"name":"32GB DDR5"}}'::jsonb,
    '[]'::jsonb, 2, 'seed client', '', '{}'::jsonb
  ),
  (
    'seed_client_002',
    '王', 'W20260113001', 'Demo Client', 'demo_xhs', 'xhs_001',
    '2026-01-13', '2026-01-20',
    'https://pcpartpicker.com/', TRUE, '1Z999AA10123456784',
    '123 Demo St', 'San Mateo', 'CA', '94401', 'Building',
    1899.00, 1500.00, 399.00, 1899.00,
    '{"CPU":{"name":"Intel i7-14700K"},"GPU":{"name":"RTX 4070 Ti Super"}}'::jsonb,
    '[]'::jsonb, 4, 'paid in full', '555-0100', '{}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  wechat_name     = EXCLUDED.wechat_name,
  wechat_id       = EXCLUDED.wechat_id,
  real_name       = EXCLUDED.real_name,
  xhs_name        = EXCLUDED.xhs_name,
  xhs_id          = EXCLUDED.xhs_id,
  order_date      = EXCLUDED.order_date,
  delivery_date   = EXCLUDED.delivery_date,
  pcpp_link       = EXCLUDED.pcpp_link,
  is_shipping     = EXCLUDED.is_shipping,
  tracking_number = EXCLUDED.tracking_number,
  address_line    = EXCLUDED.address_line,
  city            = EXCLUDED.city,
  state           = EXCLUDED.state,
  zip_code        = EXCLUDED.zip_code,
  status          = EXCLUDED.status,
  total_price     = EXCLUDED.total_price,
  actual_cost     = EXCLUDED.actual_cost,
  profit          = EXCLUDED.profit,
  paid_amount     = EXCLUDED.paid_amount,
  specs           = EXCLUDED.specs,
  photos          = EXCLUDED.photos,
  rating          = EXCLUDED.rating,
  notes           = EXCLUDED.notes,
  phone           = EXCLUDED.phone,
  metadata        = EXCLUDED.metadata;

-- =========================
-- Seed: AUDIT LOGS（可选演示）
-- =========================
INSERT INTO audit_logs (
  id, sku, name, type, qty_change, unit_cost, total_value, ref_id, operator, date
) VALUES
  ('seed_audit_001', 'CPU-7800X3D',  'AMD Ryzen 7 7800X3D',           'IN',  3, 329.00,  987.00, 'seed', 'system', NOW()),
  ('seed_audit_002', 'GPU-4080S',    'NVIDIA GeForce RTX 4080 SUPER', 'IN',  2, 899.00, 1798.00, 'seed', 'system', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;
SQL

