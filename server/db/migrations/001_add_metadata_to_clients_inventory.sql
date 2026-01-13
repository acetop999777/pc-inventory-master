-- Phase 8.0 - Add metadata JSONB columns (idempotent)

-- clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS metadata JSONB;
UPDATE clients SET metadata = '{}'::jsonb WHERE metadata IS NULL;
ALTER TABLE clients ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE clients ALTER COLUMN metadata SET NOT NULL;

-- inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS metadata JSONB;
UPDATE inventory SET metadata = '{}'::jsonb WHERE metadata IS NULL;
ALTER TABLE inventory ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE inventory ALTER COLUMN metadata SET NOT NULL;
