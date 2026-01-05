const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db', // Docker service name
  database: process.env.POSTGRES_DB || 'inventory_db',
  password: process.env.POSTGRES_PASSWORD || 'securepassword',
  port: 5432,
});

// --- Helper: DB Mapping ---
const mapInv = r => ({ ...r, cost: parseFloat(r.cost), quantity: parseInt(r.quantity) });
const mapClient = r => ({
    id: r.id, wechatName: r.wechat_name, wechatId: r.wechat_id,
    xhsName: r.xhs_name, xhsId: r.xhs_id, payerName: r.payer_name,
    source: r.source, status: r.status,
    orderDate: r.order_date, depositDate: r.deposit_date, deliveryDate: r.delivery_date,
    address: r.address_line, city: r.city, state: r.state, zip: r.zip_code,
    totalPrice: parseFloat(r.total_price||0), actualCost: parseFloat(r.actual_cost||0),
    laborCost: parseFloat(r.labor_cost||0), profit: parseFloat(r.profit||0),
    specs: r.specs || {}
});

// --- API Routes ---

// 1. Inventory GET
app.get('/api/inventory', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM inventory ORDER BY category, name');
        res.json(rows.map(mapInv));
    } catch (e) { res.status(500).json(e); }
});

// 2. Inventory Batch Update (Stock In/Out with WAC Logic)
app.post('/api/inventory/batch', async (req, res) => {
    const items = req.body; // Array of operations
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            // Check existing
            const { rows } = await client.query('SELECT * FROM inventory WHERE id = $1', [item.id]);
            const existing = rows[0];

            if (existing) {
                // Update Logic
                let newQty = item.quantity; // item.quantity here means FINAL quantity from frontend
                let newCost = item.cost;    // item.cost means FINAL WAC from frontend

                // Update DB
                await client.query(
                    `UPDATE inventory SET 
                     quantity = $1, cost = $2, name = $3, keyword = $4, category = $5, sku = $6, updated_at = NOW()
                     WHERE id = $7`,
                    [newQty, newCost, item.name, item.keyword, item.category, item.sku, item.id]
                );
            } else {
                // Insert New
                await client.query(
                    `INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [item.id, item.category, item.name, item.keyword, item.sku, item.quantity, item.cost]
                );
            }
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json(e);
    } finally { client.release(); }
});

// 3. Clients GET
app.get('/api/clients', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC');
        res.json(rows.map(mapClient));
    } catch (e) { res.status(500).json(e); }
});

// 4. Clients Upsert (Full Profile)
app.post('/api/clients', async (req, res) => {
    const c = req.body;
    try {
        await pool.query(
            `INSERT INTO clients (
                id, wechat_name, wechat_id, xhs_name, xhs_id, payer_name, source,
                status, order_date, deposit_date, delivery_date,
                address_line, city, state, zip_code,
                total_price, actual_cost, labor_cost, profit, specs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO UPDATE SET
                wechat_name=EXCLUDED.wechat_name, wechat_id=EXCLUDED.wechat_id,
                xhs_name=EXCLUDED.xhs_name, xhs_id=EXCLUDED.xhs_id, payer_name=EXCLUDED.payer_name,
                source=EXCLUDED.source, status=EXCLUDED.status,
                order_date=EXCLUDED.order_date, deposit_date=EXCLUDED.deposit_date, delivery_date=EXCLUDED.delivery_date,
                address_line=EXCLUDED.address_line, city=EXCLUDED.city, state=EXCLUDED.state, zip_code=EXCLUDED.zip_code,
                total_price=EXCLUDED.total_price, actual_cost=EXCLUDED.actual_cost, 
                labor_cost=EXCLUDED.labor_cost, profit=EXCLUDED.profit, specs=EXCLUDED.specs`,
            [
                c.id, c.wechatName, c.wechatId, c.xhsName, c.xhsId, c.payerName, c.source,
                c.status, c.orderDate || null, c.depositDate || null, c.deliveryDate || null,
                c.address, c.city, c.state, c.zip,
                c.totalPrice, c.actualCost, c.laborCost, c.profit, JSON.stringify(c.specs)
            ]
        );
        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).json(e); }
});

// 5. Logs
app.get('/api/logs', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500');
        res.json(rows.map(r => ({ ...r, timestamp: parseInt(r.timestamp) })));
    } catch (e) { res.status(500).json(e); }
});

app.post('/api/logs', async (req, res) => {
    const { id, timestamp, type, title, msg, meta } = req.body;
    try {
        await pool.query(
            'INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, timestamp, type, title, msg, meta]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json(e); }
});

app.listen(port, () => console.log(`Server running on ${port}`));