-- 003_cleanup_video_card_to_gpu.sql
-- One-time cleanup:
-- If specs has 'Video Card', merge into 'GPU' (only when GPU missing or empty), then remove 'Video Card'

UPDATE clients
SET specs =
  CASE
    WHEN (specs ? 'Video Card')
     AND (NOT (specs ? 'GPU') OR COALESCE(specs->'GPU'->>'name','') = '')
      THEN (specs - 'Video Card') || jsonb_build_object('GPU', specs->'Video Card')
    WHEN (specs ? 'Video Card')
      THEN (specs - 'Video Card')
    ELSE specs
  END
WHERE specs ? 'Video Card';
