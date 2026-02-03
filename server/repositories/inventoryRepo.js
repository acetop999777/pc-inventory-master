/**
 * @typedef {import('pg').PoolClient} DbClient
 * @typedef {{
 *   id: string,
 *   category?: unknown,
 *   name?: unknown,
 *   keyword?: unknown,
 *   sku?: unknown,
 *   quantity?: unknown,
 *   cost?: unknown,
 *   price?: unknown,
 *   location?: unknown,
 *   status?: unknown,
 *   notes?: unknown,
 *   metadata?: unknown
 * }} InventoryInput
 * @typedef {Record<string, unknown>} InventoryUpdate
 */

/**
 * @param {unknown} row
 * @returns {unknown | null}
 */
function mapRow(row) {
  return row || null;
}

/**
 * @param {DbClient} tx
 * @param {string} id
 * @returns {Promise<unknown | null>}
 */
async function getForUpdateById(tx, id) {
  const { rows } = await tx.query('SELECT * FROM inventory WHERE id = $1 FOR UPDATE', [id]);
  return mapRow(rows[0]);
}

/**
 * @param {DbClient} tx
 * @param {InventoryInput} item
 * @returns {Promise<unknown | null>}
 */
async function insert(tx, item) {
  const {
    id,
    category,
    name,
    keyword,
    sku,
    quantity,
    cost,
    price,
    location,
    status,
    notes,
    metadata,
  } = item;

  const { rows } = await tx.query(
    `INSERT INTO inventory (
      id, category, name, keyword, sku, quantity, cost, price, location, status, notes, metadata, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()
    ) RETURNING *`,
    [
      id,
      category || null,
      name || null,
      keyword || null,
      sku || null,
      Number(quantity ?? 0),
      Number(cost ?? 0),
      Number(price ?? 0),
      location || null,
      status || null,
      notes || null,
      metadata || {},
    ],
  );

  return mapRow(rows[0]);
}

/**
 * @param {DbClient} tx
 * @param {string} id
 * @param {InventoryUpdate} fields
 * @returns {Promise<unknown | null>}
 */
async function update(tx, id, fields) {
  const allowed = [
    'category',
    'name',
    'keyword',
    'sku',
    'quantity',
    'cost',
    'price',
    'location',
    'status',
    'notes',
    'metadata',
  ];

  const sets = [];
  const values = [];
  let idx = 1;

  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) {
      sets.push(`${k} = $${idx++}`);
      values.push(fields[k]);
    }
  }

  if (sets.length === 0) {
    const { rows } = await tx.query(
      'UPDATE inventory SET updated_at = NOW() WHERE id = $1 RETURNING *',
      [id],
    );
    return mapRow(rows[0]);
  }

  values.push(id);
  const q = `UPDATE inventory SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  const { rows } = await tx.query(q, values);
  return mapRow(rows[0]);
}

module.exports = {
  getForUpdateById,
  insert,
  update,
};
