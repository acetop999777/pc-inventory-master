async function insertReceipt(tx, receipt) {
  const { receivedAt, vendor, mode, notes, requestId, operationId, images } = receipt;
  const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
  const { rows } = await tx.query(
    `INSERT INTO inbound_receipts (
      received_at, vendor, mode, notes, request_id, operation_id, images
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
    RETURNING *`,
    [
      receivedAt || new Date(),
      vendor || null,
      mode || 'MANUAL',
      notes || null,
      requestId || null,
      operationId,
      imagesJson,
    ],
  );
  return rows[0];
}

async function insertReceiptItem(tx, item) {
  const { receiptId, inventoryId, qtyReceived, unitCost } = item;
  const { rows } = await tx.query(
    `INSERT INTO inbound_receipt_items (
      receipt_id, inventory_id, qty_received, unit_cost
    ) VALUES ($1,$2,$3,$4)
    RETURNING *`,
    [receiptId, inventoryId, qtyReceived, unitCost],
  );
  return rows[0];
}

async function listReceipts(tx, limit) {
  const lim = Number(limit || 50);
  const { rows } = await tx.query(
    `SELECT r.*, COALESCE(SUM(i.line_total), 0) as total_amount
     FROM inbound_receipts r
     LEFT JOIN inbound_receipt_items i ON i.receipt_id = r.id
     GROUP BY r.id
     ORDER BY r.received_at DESC
     LIMIT $1`,
    [lim],
  );
  return rows;
}

async function getReceipt(tx, id) {
  const { rows } = await tx.query('SELECT * FROM inbound_receipts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getReceiptByOperationId(tx, operationId) {
  const { rows } = await tx.query('SELECT * FROM inbound_receipts WHERE operation_id = $1', [operationId]);
  return rows[0] || null;
}

async function getReceiptItems(tx, receiptId) {
  const { rows } = await tx.query(
    `SELECT i.*, inv.name as inventory_name, inv.sku as inventory_sku
     FROM inbound_receipt_items i
     LEFT JOIN inventory inv ON inv.id = i.inventory_id
     WHERE i.receipt_id = $1
     ORDER BY i.id ASC`,
    [receiptId],
  );
  return rows;
}

async function updateReceipt(tx, receiptId, fields) {
  const sets = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(fields, 'receivedAt')) {
    sets.push(`received_at = $${idx++}`);
    values.push(fields.receivedAt ? new Date(fields.receivedAt) : null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'vendor')) {
    const vendor = fields.vendor;
    sets.push(`vendor = $${idx++}`);
    values.push(typeof vendor === 'string' && vendor.trim() ? vendor.trim() : null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'mode')) {
    const mode = fields.mode;
    sets.push(`mode = $${idx++}`);
    values.push(typeof mode === 'string' && mode.trim() ? mode.trim() : 'MANUAL');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'notes')) {
    const notes = fields.notes;
    sets.push(`notes = $${idx++}`);
    values.push(typeof notes === 'string' && notes.trim() ? notes : null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'images')) {
    const imagesJson = JSON.stringify(Array.isArray(fields.images) ? fields.images : []);
    sets.push(`images = $${idx++}::jsonb`);
    values.push(imagesJson);
  }

  if (sets.length === 0) {
    const { rows } = await tx.query('SELECT * FROM inbound_receipts WHERE id = $1', [receiptId]);
    return rows[0] || null;
  }

  values.push(receiptId);
  const { rows } = await tx.query(
    `UPDATE inbound_receipts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0] || null;
}

async function updateReceiptItem(tx, itemId, qtyReceived, unitCost) {
  const { rows } = await tx.query(
    `UPDATE inbound_receipt_items
     SET qty_received = $2, unit_cost = $3
     WHERE id = $1
     RETURNING *`,
    [itemId, qtyReceived, unitCost],
  );
  return rows[0] || null;
}

async function deleteReceiptItem(tx, itemId) {
  const { rows } = await tx.query(
    'DELETE FROM inbound_receipt_items WHERE id = $1 RETURNING *',
    [itemId],
  );
  return rows[0] || null;
}

async function updateReceiptImages(tx, receiptId, images) {
  const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
  const { rows } = await tx.query(
    `UPDATE inbound_receipts
     SET images = $2::jsonb
     WHERE id = $1
     RETURNING *`,
    [receiptId, imagesJson],
  );
  return rows[0] || null;
}

module.exports = {
  insertReceipt,
  insertReceiptItem,
  listReceipts,
  getReceipt,
  getReceiptByOperationId,
  getReceiptItems,
  updateReceipt,
  updateReceiptItem,
  updateReceiptImages,
  deleteReceiptItem,
};
