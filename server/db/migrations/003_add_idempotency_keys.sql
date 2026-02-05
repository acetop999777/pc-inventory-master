-- 003_add_idempotency_keys.sql
-- Idempotency keys for critical write endpoints

CREATE TABLE IF NOT EXISTS idempotency_keys (
  operation_id TEXT PRIMARY KEY,
  endpoint TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status
  ON idempotency_keys(status);
