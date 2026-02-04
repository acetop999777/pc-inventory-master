import type { PoolClient } from 'pg';

type DbClient = PoolClient;
type DbRow = Record<string, unknown>;
type MovementInput = {
  inventoryId: string;
  qtyDelta?: unknown;
  reason?: unknown;
  unitCost?: unknown;
  unitCostUsed?: unknown;
  refType?: unknown;
  refId?: unknown;
  onHandAfter?: unknown;
  avgCostAfter?: unknown;
  requestId?: unknown;
  operationId?: unknown;
  occurredAt?: unknown;
};

async function insert(tx: DbClient, movement: MovementInput): Promise<DbRow> {
  const {
    inventoryId,
    qtyDelta,
    reason,
    unitCost,
    unitCostUsed,
    refType,
    refId,
    onHandAfter,
    avgCostAfter,
    requestId,
    operationId,
    occurredAt,
  } = movement;

  const { rows } = await tx.query(
    `INSERT INTO inventory_movements (
      inventory_id, qty_delta, reason, unit_cost, unit_cost_used,
      ref_type, ref_id, on_hand_after, avg_cost_after, request_id, operation_id, occurred_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      inventoryId,
      Number(qtyDelta ?? 0),
      reason,
      unitCost != null ? unitCost : null,
      unitCostUsed != null ? unitCostUsed : null,
      refType || null,
      refId || null,
      Number(onHandAfter ?? 0),
      avgCostAfter,
      requestId || null,
      operationId,
      occurredAt || new Date(),
    ],
  );

  return rows[0];
}

async function getByOperationId(tx: DbClient, operationId: string): Promise<DbRow | null> {
  const { rows } = await tx.query(
    'SELECT * FROM inventory_movements WHERE operation_id = $1',
    [operationId],
  );
  return rows[0] || null;
}

export { insert, getByOperationId };
