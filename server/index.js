const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 数据库连接配置
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'inventory_db',
  password: process.env.POSTGRES_PASSWORD || 'securepassword',
  port: 5432,
});

// --- 辅助函数：将数据库下划线字段转为前端驼峰命名 ---
const mapInventory = (row) => ({
    id: row.id,
    category: row.category,
    name: row.name,
    keyword: row.keyword,
    sku: row.sku,
    quantity: row.quantity,
    cost: parseFloat(row.cost),
    barcode: row.barcode
});

// --- API 路由 ---

// 1. 获取所有库存
app.get('/api/inventory', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inventory ORDER BY name ASC');
        res.json(rows.map(mapInventory));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. 同步/更新单个库存项 (Upsert)
app.post('/api/inventory/sync', async (req, res) => {
    const { id, category, name, keyword, sku, quantity, cost, barcode } = req.body;
    try {
        await pool.query(
            `INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost, barcode)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
             quantity = EXCLUDED.quantity, 
             cost = EXCLUDED.cost, 
             name = EXCLUDED.name, 
             category = EXCLUDED.category, 
             keyword = EXCLUDED.keyword,
             barcode = EXCLUDED.barcode`,
            [id, category, name, keyword || '', sku || '', quantity || 0, cost || 0, barcode || '']
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 3. 批量更新库存 (用于 Scan 扫码入库)
app.post('/api/inventory/batch', async (req, res) => {
    const items = req.body; // Array of items
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            await client.query(
                `INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost, barcode)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                 quantity = EXCLUDED.quantity, 
                 cost = EXCLUDED.cost`,
                [item.id, item.category, item.name, item.keyword || '', item.sku || '', item.quantity, item.cost, item.barcode || '']
            );
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. 获取日志
app.get('/api/logs', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
        // JSONB 字段 pg 库会自动解析
        res.json(rows.map(r => ({...r, timestamp: parseInt(r.timestamp)}))); 
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});

// 5. 写入日志
app.post('/api/logs', async (req, res) => {
    const { id, timestamp, type, title, msg, meta } = req.body;
    try {
        await pool.query(
            'INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, timestamp, type, title, msg, meta]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});

// 6. 客户 CRUD
app.get('/api/clients', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
        res.json(rows.map(r => ({
            id: r.id, wechatName: r.wechat_name, status: r.status, orderDate: r.order_date
        })));
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/clients', async (req, res) => {
    const { id, wechatName, status, orderDate } = req.body;
    try {
        await pool.query(
            `INSERT INTO clients (id, wechat_name, status, order_date) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
            [id, wechatName, status, orderDate]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json(err); }
});

app.listen(port, () => {
    console.log(`Backend Server running on port ${port}`);
});