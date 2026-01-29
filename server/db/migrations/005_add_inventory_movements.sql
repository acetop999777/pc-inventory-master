-- 005_add_inventory_movements.sql
-- Inventory movements ledger (append-only)

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

CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_date
  ON inventory_movements(inventory_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref
  ON inventory_movements(ref_type, ref_id);

-- Backfill opening balances (idempotent via unique operation_id)
INSERT INTO inventory_movements (
  inventory_id, qty_delta, reason, unit_cost, unit_cost_used,
  ref_type, ref_id, on_hand_after, avg_cost_after, request_id, operation_id
)
SELECT
  i.id,
  i.quantity,
  'OPENING',
  i.cost,
  NULL,
  'OPENING',
  i.id,
  i.quantity,
  i.cost,
  NULL,
  'backfill-opening-' || i.id
FROM inventory i
ON CONFLICT (operation_id) DO NOTHING;
