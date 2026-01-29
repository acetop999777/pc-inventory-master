async function insert(tx, log) {
  const {
    id,
    sku,
    name,
    type,
    qtyChange,
    unitCost,
    totalValue,
    refId,
    operator,
  } = log;

  const safeSku = typeof sku === 'string' ? sku : '';

  await tx.query(
    `INSERT INTO audit_logs (
      id, sku, name, type, qty_change, unit_cost, total_value, ref_id, operator
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      safeSku,
      name || null,
      type || null,
      Number(qtyChange ?? 0),
      Number(unitCost ?? 0),
      Number(totalValue ?? 0),
      refId || null,
      operator || null,
    ],
  );
}

module.exports = { insert };
