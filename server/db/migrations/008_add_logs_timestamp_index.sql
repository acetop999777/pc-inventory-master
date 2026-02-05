-- 008: add index for logs timestamp
CREATE INDEX IF NOT EXISTS idx_logs_timestamp_desc ON logs (timestamp DESC);
