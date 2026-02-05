import type { Pool } from 'pg';

/**
 * @param {Pool} pool
 */
async function startupCleanupIfEnabled(pool: Pool) {
  const on = String(process.env.STARTUP_CLEANUP || '').toLowerCase() === 'true';
  if (!on) return;

  console.log('[cleanup] STARTUP_CLEANUP=true -> running cleanup (idempotent)');

  // Video Card -> GPU (only if GPU missing OR GPU.name blank)
  const r = await pool.query(`
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
      AND (specs ? 'Video Card')
    RETURNING id;
  `);

  console.log(`[cleanup] Video Card -> GPU: updated=${r.rowCount || 0}`);
}

export { startupCleanupIfEnabled };
