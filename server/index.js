const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
// 提升到 50MB 以支持多图上传
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'inventory_db',
  password: process.env.POSTGRES_PASSWORD || 'securepassword',
  port: 5432,
});

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
    photos: r.photos || [], // 确保返回数组
    rating: r.rating || 2, notes: r.notes || ''
});

// --- APIs ---

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
            if (rows.length > 0) {
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
        // 这里的 photos 需要转为 JSON 字符串存储
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