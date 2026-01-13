-- 002_schema_align_indexes_constraints.sql
-- Goals:
-- 1) clients: ensure metadata column exists + not null + object type check
-- 2) clients: ensure specs/photos type checks
-- 3) clients: if old column deposit_date exists -> backfill order_date then drop deposit_date
-- 4) inventory: keep ONLY one sku uniqueness rule: lower(trim(sku)) unique when sku is not blank
-- 5) drop legacy sku indexes if they exist

BEGIN;

-- ---------- clients: ensure metadata baseline ----------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE clients SET metadata = '{}'::jsonb WHERE metadata IS NULL;
ALTER TABLE clients ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE clients ALTER COLUMN metadata SET NOT NULL;

-- ---------- clients: ensure JSONB type constraints (idempotent) ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_specs_object'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_specs_object
      CHECK (specs IS NULL OR jsonb_typeof(specs) = 'object') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_photos_array'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_photos_array
      CHECK (photos IS NULL OR jsonb_typeof(photos) = 'array') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='chk_clients_metadata_object'
      AND conrelid='public.clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT chk_clients_metadata_object
      CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object') NOT VALID;
  END IF;
END $$;

-- validate (safe even if already valid)
ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_specs_object;
ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_photos_array;
ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_metadata_object;

-- ---------- clients: drop deposit_date if exists (with safe backfill) ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='deposit_date'
  ) THEN
    UPDATE clients
      SET order_date = deposit_date
    WHERE order_date IS NULL AND deposit_date IS NOT NULL;

    IF EXISTS (SELECT 1 FROM clients WHERE order_date IS NULL) THEN
      RAISE EXCEPTION 'clients.order_date still NULL after backfill from deposit_date; fix data first';
    END IF;

    ALTER TABLE clients DROP COLUMN deposit_date;
  END IF;
END $$;

-- enforce order_date not null if possible
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients WHERE order_date IS NULL) THEN
    ALTER TABLE clients ALTER COLUMN order_date SET NOT NULL;
  END IF;
END $$;

-- ---------- inventory: ensure ONLY one sku uniqueness rule ----------
-- fail fast if duplicates exist under normalization
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT lower(btrim(sku)) AS norm, COUNT(*) cnt
      FROM inventory
      WHERE sku IS NOT NULL AND btrim(sku) <> ''
      GROUP BY 1
      HAVING COUNT(*) > 1
      LIMIT 1
    ) t
  ) THEN
    RAISE EXCEPTION 'inventory has duplicate sku after lower(trim) normalization; resolve before applying unique index';
  END IF;
END $$;

-- drop legacy indexes if present
DROP INDEX IF EXISTS public.idx_inventory_sku;
DROP INDEX IF EXISTS public.uq_inventory_sku;
DROP INDEX IF EXISTS public.uq_inventory_sku_nonblank;
DROP INDEX IF EXISTS public.uq_inventory_sku_nonblank_ci;
DROP INDEX IF EXISTS public.ux_inventory_sku_nonempty;
DROP INDEX IF EXISTS public.ux_inventory_sku_nonempty_norm;
DROP INDEX IF EXISTS public.ux_inventory_sku_nonempty_ci;

-- ensure the indexes we actually want
CREATE INDEX IF NOT EXISTS idx_clients_order_date ON public.clients(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_category_name ON public.inventory(category, name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_sku_norm_nonempty
ON public.inventory (lower(btrim(sku)))
WHERE sku IS NOT NULL AND btrim(sku) <> '';

COMMIT;
