const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'inventory_db',
  password: process.env.POSTGRES_PASSWORD || 'securepassword',
  port: 5432,
});

// --- Init DB ---
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                sku TEXT NOT NULL,
                name TEXT,
                type TEXT NOT NULL,
                qty_change INTEGER NOT NULL,
                unit_cost NUMERIC(10, 2) DEFAULT 0,
                total_value NUMERIC(10, 2) DEFAULT 0,
                ref_id TEXT,
                operator TEXT DEFAULT 'Admin',
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables checked/initialized.');
    } catch (err) {
        console.error('Database init error:', err);
    }
};
initDB();

// --- Audit Helper ---
const logInventoryChange = async (dbClient, sku, name, oldQty, newQty, cost, refId = 'MANUAL_ADJUST') => {
    const qtyChange = newQty - oldQty;
    if (qtyChange === 0) return; 

    const finalType = refId === 'MANUAL_ADJUST' || refId === 'BATCH_EDIT' 
        ? (qtyChange > 0 ? 'IN' : 'ADJUST') 
        : (qtyChange > 0 ? 'IN' : 'OUT');

    const totalValue = Number((Math.abs(qtyChange) * cost).toFixed(2));
    const logId = Math.random().toString(36).substr(2, 9);

    try {
        await dbClient.query(
            `INSERT INTO audit_logs (id, sku, name, type, qty_change, unit_cost, total_value, ref_id, date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [logId, sku, name, finalType, qtyChange, cost, totalValue, refId]
        );
        console.log(`[Audit] Logged ${finalType} for ${sku}: ${qtyChange} units`);
    } catch (err) {
        console.error('Failed to write audit log:', err);
    }
};

const mapClient = r => ({
    ...r,
    isShipping: r.is_shipping,
    pcppLink: r.pcpp_link,
    wechatName: r.wechat_name, wechatId: r.wechat_id,
    realName: r.real_name, payerName: r.payer_name,
    xhsName: r.xhs_name, xhsId: r.xhs_id,
    trackingNumber: r.tracking_number,
    orderDate: r.order_date, depositDate: r.deposit_date, deliveryDate: r.delivery_date,
    address: r.address_line, zip: r.zip_code,
    totalPrice: parseFloat(r.total_price), actualCost: parseFloat(r.actual_cost), profit: parseFloat(r.profit),
    specs: r.specs || {},
    photos: r.photos || [], 
    rating: r.rating || 2, notes: r.notes || ''
});

// --- APIs ---

// 1. Dashboard Stats & Chart API
app.get('/api/dashboard/chart', async (req, res) => {
    try {
        // A. 基础统计
        // 修正点：COUNT(*) 改为 SUM(quantity)，这样统计的就是所有配件的总个数
        const invRes = await pool.query('SELECT SUM(cost * quantity) as total_inv_value, SUM(quantity) as total_items FROM inventory');
        const clientRes = await pool.query('SELECT COUNT(*) as total_clients, SUM(profit) as total_profit FROM clients');
        
        // B. 图表数据：过去 14 天的资金流动
        const chartRes = await pool.query(`
            SELECT 
                to_char(date, 'YYYY-MM-DD') as day,
                SUM(CASE WHEN type = 'IN' THEN total_value ELSE 0 END) as value_in,
                SUM(CASE WHEN type = 'OUT' THEN total_value ELSE 0 END) as value_out
            FROM audit_logs
            WHERE date > NOW() - INTERVAL '14 days'
            GROUP BY day
            ORDER BY day ASC
        `);

        res.json({
            stats: {
                inventoryValue: parseFloat(invRes.rows[0].total_inv_value || 0),
                totalItems: parseInt(invRes.rows[0].total_items || 0), // 这里现在是总数量了
                totalClients: parseInt(clientRes.rows[0].total_clients || 0),
                totalProfit: parseFloat(clientRes.rows[0].total_profit || 0)
            },
            chart: chartRes.rows.map(r => ({
                date: r.day,
                in: parseFloat(r.value_in),
                out: parseFloat(r.value_out)
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});

app.get('/api/audit/:sku', async (req, res) => {
    try {
        const { sku } = req.params;
        const { rows } = await pool.query('SELECT * FROM audit_logs WHERE sku = $1 ORDER BY date DESC LIMIT 50', [sku]);
        const camelRows = rows.map(r => ({
            id: r.id, sku: r.sku, name: r.name, type: r.type,
            qtyChange: r.qty_change, unitCost: parseFloat(r.unit_cost),
            totalValue: parseFloat(r.total_value), refId: r.ref_id, operator: r.operator, date: r.date
        }));
        res.json(camelRows);
    } catch (e) { res.status(500).send(e); }
});

app.get('/api/lookup/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const apiRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        if (!apiRes.ok) throw new Error('API Failed');
        const data = await apiRes.json();
        res.json(data);
    } catch (e) { res.json({ items: [] }); }
});

app.get('/api/inventory', async (req, res) => {
    try { const { rows } = await pool.query('SELECT * FROM inventory ORDER BY category, name'); res.json(rows); } catch (e) { res.status(500).send(e); }
});

app.post('/api/inventory/batch', async (req, res) => {
    const items = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            const { rows } = await client.query('SELECT * FROM inventory WHERE id = $1', [item.id]);
            const oldItem = rows.length > 0 ? rows[0] : null;
            const oldQty = oldItem ? Number(oldItem.quantity) : 0;

            if (oldItem) {
                await client.query(
                    `UPDATE inventory SET quantity=$1, cost=$2, name=$3, keyword=$4, sku=$5, category=$6 WHERE id=$7`,
                    [item.quantity, item.cost, item.name, item.keyword, item.sku, item.category, item.id]
                );
            } else {
                await client.query(
                    `INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [item.id, item.category, item.name, item.keyword, item.sku, item.quantity, item.cost]
                );
            }

            const refId = oldItem ? 'BATCH_EDIT' : 'INITIAL_STOCK';
            await logInventoryChange(client, item.sku || 'NO-SKU', item.name, oldQty, Number(item.quantity), Number(item.cost), refId);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).send(e); } finally { client.release(); }
});

app.delete('/api/inventory/:id', async (req, res) => {
    try { await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).send(e); }
});

app.get('/api/clients', async (req, res) => {
    try { const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC'); res.json(rows.map(mapClient)); } catch (e) { res.status(500).send(e); }
});

app.post('/api/clients', async (req, res) => {
    const c = req.body;
    try {
        await pool.query(
            `INSERT INTO clients (
                id, wechat_name, wechat_id, real_name, xhs_name, xhs_id, 
                order_date, deposit_date, delivery_date, pcpp_link, is_shipping, tracking_number,
                address_line, city, state, zip_code, status,
                total_price, actual_cost, profit, specs, photos, rating, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            ON CONFLICT (id) DO UPDATE SET
                wechat_name=EXCLUDED.wechat_name, wechat_id=EXCLUDED.wechat_id, real_name=EXCLUDED.real_name,
                xhs_name=EXCLUDED.xhs_name, xhs_id=EXCLUDED.xhs_id,
                order_date=EXCLUDED.order_date, deposit_date=EXCLUDED.deposit_date, delivery_date=EXCLUDED.delivery_date,
                pcpp_link=EXCLUDED.pcpp_link, is_shipping=EXCLUDED.is_shipping, tracking_number=EXCLUDED.tracking_number,
                address_line=EXCLUDED.address_line, city=EXCLUDED.city, state=EXCLUDED.state, zip_code=EXCLUDED.zip_code,
                status=EXCLUDED.status, total_price=EXCLUDED.total_price, actual_cost=EXCLUDED.actual_cost, profit=EXCLUDED.profit, specs=EXCLUDED.specs,
                photos=EXCLUDED.photos, rating=EXCLUDED.rating, notes=EXCLUDED.notes`,
            [
                c.id, c.wechatName, c.wechatId, c.realName, c.xhsName, c.xhsId,
                c.orderDate || null, c.depositDate || null, c.deliveryDate || null, c.pcppLink, c.isShipping, c.trackingNumber,
                c.address, c.city, c.state, c.zip, c.status,
                c.totalPrice, c.actualCost, c.profit, JSON.stringify(c.specs),
                JSON.stringify(c.photos || []), c.rating, c.notes
            ]
        );
        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).send(e); }
});

app.get('/api/logs', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200'); res.json(rows); } catch (e) { res.status(500).send(e); } });
app.post('/api/logs', async (req, res) => { const { id, timestamp, type, title, msg, meta } = req.body; try { await pool.query('INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)', [id, timestamp, type, title, msg, meta]); res.json({success:true}); } catch (e) { res.status(500).send(e); } });

app.listen(5000, () => console.log('Server on 5000'));