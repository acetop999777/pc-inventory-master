-- server/init.sql
-- 初始化/迁移用的基础 schema（幂等）

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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_cache (
  barcode VARCHAR(50) PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp BIGINT,
  type TEXT,
  title TEXT,
  msg TEXT,
  meta JSONB
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_clients_order_date ON clients(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_category_name ON inventory(category, name);

-- ✅ 只保留这一条 SKU 规则：非空白时 lower(trim) 唯一
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_sku_norm_nonempty
ON inventory (lower(btrim(sku)))
WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE INDEX IF NOT EXISTS idx_audit_logs_sku  ON audit_logs(sku);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ref  ON audit_logs(ref_id);

-- constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_money_nonneg'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_money_nonneg
      CHECK (total_price >= 0 AND actual_cost >= 0 AND paid_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_specs_object'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_specs_object
      CHECK (specs IS NULL OR jsonb_typeof(specs) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_photos_array'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_photos_array
      CHECK (photos IS NULL OR jsonb_typeof(photos) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_metadata_object'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_metadata_object
      CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');
  END IF;
END $$;
