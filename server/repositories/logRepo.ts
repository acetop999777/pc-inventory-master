import type { PoolClient } from 'pg';

type DbClient = PoolClient;
type LogInput = {
  id: string;
  timestamp: unknown;
  type: unknown;
  title: unknown;
  msg: unknown;
  meta: unknown;
};

async function insert(tx: DbClient, log: LogInput): Promise<void> {
  const { id, timestamp, type, title, msg, meta } = log;
  await tx.query(
    'INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, timestamp, type, title, msg, meta],
  );
}

export { insert };
