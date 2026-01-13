mkdir -p server/db/migrations

cat > server/db/migrations/003_cleanup_video_card_to_gpu.sql <<'SQL'
-- 003: cleanup specs: move "Video Card" -> "GPU"
-- Rule:
--   - If specs has "Video Card":
--       - If GPU missing OR GPU.name is null/blank => set GPU = Video Card
--       - Always remove "Video Card"
-- Idempotent: running multiple times is safe.

UPDATE clients
SET specs =
  CASE
    WHEN specs IS NULL THEN NULL
    WHEN NOT (specs ? 'Video Card') THEN specs
    WHEN (NOT (specs ? 'GPU'))
         OR (specs->'GPU'->>'name' IS NULL)
         OR (btrim(specs->'GPU'->>'name') = '')
      THEN jsonb_set(specs - 'Video Card', '{GPU}', specs->'Video Card', true)
    ELSE (specs - 'Video Card')
  END
WHERE specs IS NOT NULL
  AND (specs ? 'Video Card');
SQL
