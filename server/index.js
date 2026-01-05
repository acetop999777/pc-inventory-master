const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());

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
    realName: r.real_name, trackingNumber: r.tracking_number,
    xhsName: r.xhs_name, xhsId: r.xhs_id,
    orderDate: r.order_date, deliveryDate: r.delivery_date,
    address: r.address_line, zip: r.zip_code,
    totalPrice: parseFloat(r.total_price), actualCost: parseFloat(r.actual_cost), profit: parseFloat(r.profit)
});

// APIs
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

app.get('/api/clients', async (req, res) => {
    try { const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC'); res.json(rows.map(mapClient)); } catch (e) { res.status(500).send(e); }
});

app.post('/api/clients', async (req, res) => {
    const c = req.body;
    try {
        await pool.query(
            `INSERT INTO clients (
                id, wechat_name, wechat_id, real_name, xhs_name, xhs_id, 
                order_date, delivery_date, pcpp_link, is_shipping, tracking_number,
                address_line, city, state, zip_code, status,
                total_price, actual_cost, profit, specs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO UPDATE SET
                wechat_name=EXCLUDED.wechat_name, wechat_id=EXCLUDED.wechat_id, real_name=EXCLUDED.real_name,
                xhs_name=EXCLUDED.xhs_name, xhs_id=EXCLUDED.xhs_id,
                order_date=EXCLUDED.order_date, delivery_date=EXCLUDED.delivery_date,
                pcpp_link=EXCLUDED.pcpp_link, is_shipping=EXCLUDED.is_shipping, tracking_number=EXCLUDED.tracking_number,
                address_line=EXCLUDED.address_line, city=EXCLUDED.city, state=EXCLUDED.state, zip_code=EXCLUDED.zip_code,
                status=EXCLUDED.status, total_price=EXCLUDED.total_price, actual_cost=EXCLUDED.actual_cost, profit=EXCLUDED.profit, specs=EXCLUDED.specs`,
            [
                c.id, c.wechatName, c.wechatId, c.realName, c.xhsName, c.xhsId,
                c.orderDate, c.deliveryDate, c.pcppLink, c.isShipping, c.trackingNumber,
                c.address, c.city, c.state, c.zip, c.status,
                c.totalPrice, c.actualCost, c.profit, JSON.stringify(c.specs)
            ]
        );
        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).send(e); }
});

app.get('/api/logs', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200'); res.json(rows); } catch (e) { res.status(500).send(e); } });
app.post('/api/logs', async (req, res) => { const { id, timestamp, type, title, msg, meta } = req.body; try { await pool.query('INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)', [id, timestamp, type, title, msg, meta]); res.json({success:true}); } catch (e) { res.status(500).send(e); } });

app.listen(5000, () => console.log('Server on 5000'));