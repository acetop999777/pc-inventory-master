-- 007_add_receipt_images.sql
-- Add images column to inbound receipts
ALTER TABLE inbound_receipts
ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
