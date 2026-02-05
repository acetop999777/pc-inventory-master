import { Pool, type PoolConfig } from 'pg';

const config: PoolConfig = {
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'inventory_db',
  // ✅ 默认对齐你现在的 compose/.env，避免 securepassword 导致 28P01
  password: process.env.POSTGRES_PASSWORD || 'change_me',
  port: 5432,
};

const pool = new Pool(config);

export { pool };
