-- 006_add_inbound_receipts.sql
-- Inbound receipts (header + items)

CREATE TABLE IF NOT EXISTS inbound_receipts (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendor TEXT NULL,
  mode TEXT NOT NULL DEFAULT 'MANUAL',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id TEXT NULL,
  operation_id TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_inbound_receipts_received_at
  ON inbound_receipts(received_at DESC);

CREATE TABLE IF NOT EXISTS inbound_receipt_items (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES inbound_receipts(id) ON DELETE CASCADE,
  inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  qty_received INTEGER NOT NULL CHECK (qty_received > 0),
  unit_cost NUMERIC(12,4) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(12,4) GENERATED ALWAYS AS (qty_received * unit_cost) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_receipt_items_receipt
  ON inbound_receipt_items(receipt_id);

CREATE INDEX IF NOT EXISTS idx_inbound_receipt_items_inventory_receipt
  ON inbound_receipt_items(inventory_id, receipt_id);
