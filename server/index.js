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

// --- Data Migration / Cleanup ---
const cleanUpDuplicates = async () => {
    try {
        console.log('Running data cleanup...');
        const { rows } = await pool.query("SELECT id, specs FROM clients");
        for (const client of rows) {
            let specs = client.specs || {};
            let changed = false;

            // 1. Fix: Merge 'Video Card' into 'GPU'
            if (specs['Video Card']) {
                console.log(`Fixing Video Card for client ${client.id}`);
                // If GPU doesn't exist or is empty, take Video Card data
                if (!specs['GPU'] || !specs['GPU'].name) {
                    specs['GPU'] = specs['Video Card'];
                }
                delete specs['Video Card'];
                changed = true;
            }

            // 2. Fix: Ensure standard keys exist (Prevent null errors)
            // Optional: You can add other cleanup logic here

            if (changed) {
                await pool.query("UPDATE clients SET specs = $1 WHERE id = $2", [JSON.stringify(specs), client.id]);
            }
        }
        console.log('Data cleanup complete.');
    } catch (e) {
        console.error('Cleanup failed:', e);
    }
};

const initDB = async () => {
    try {
                await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY, wechat_name TEXT, wechat_id TEXT, real_name TEXT,
                xhs_name TEXT, xhs_id TEXT, order_date DATE, deposit_date DATE, delivery_date DATE,
                pcpp_link TEXT, is_shipping BOOLEAN DEFAULT FALSE, tracking_number TEXT,
                address_line TEXT, city TEXT, state TEXT, zip_code TEXT, status TEXT,
                total_price NUMERIC(10, 2) DEFAULT 0,
                actual_cost NUMERIC(10, 2) DEFAULT 0,
                profit NUMERIC(10, 2) DEFAULT 0,
                paid_amount NUMERIC(10, 2) DEFAULT 0,
                specs JSONB, photos JSONB, rating INTEGER DEFAULT 0, notes TEXT
            );
        `);
        await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0;`);

        await pool.query(`CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, category TEXT, name TEXT, keyword TEXT, sku TEXT, quantity INTEGER DEFAULT 0, cost NUMERIC(10,2) DEFAULT 0, price NUMERIC(10,2) DEFAULT 0, location TEXT, status TEXT, notes TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;`);
        await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location TEXT;`);
        await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status TEXT;`);
        await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS notes TEXT;`);
        await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);

        await pool.query(`CREATE TABLE IF NOT EXISTS product_cache (barcode VARCHAR(50) PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, sku TEXT, name TEXT, type TEXT, qty_change INTEGER, unit_cost NUMERIC, total_value NUMERIC, ref_id TEXT, operator TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await pool.query(`CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, timestamp BIGINT, type TEXT, title TEXT, msg TEXT, meta JSONB);`);
        
        console.log('Database initialized.');
        
        // Execute Cleanup
        await cleanUpDuplicates();
        
    } catch (err) { console.error('DB init error:', err); }
};
initDB();

const fmtDate = (d) => d ? new Date(d).toISOString() : '';

const mapClient = r => ({
    id: r.id,
    wechatName: r.wechat_name,
    wechatId: r.wechat_id || '',
    realName: r.real_name || '',
    xhsName: r.xhs_name || '',
    xhsId: r.xhs_id || '',
    orderDate: fmtDate(r.order_date || r.deposit_date), // Fallback logic
    deliveryDate: fmtDate(r.delivery_date),
    isShipping: r.is_shipping,
    trackingNumber: r.tracking_number || '',
    pcppLink: r.pcpp_link || '',
    address: r.address_line || '',
    city: r.city || '',
    state: r.state || '',
    zip: r.zip_code || '',
    status: r.status,
    rating: r.rating || 0,
    notes: r.notes || '',
    totalPrice: parseFloat(r.total_price || 0),
    actualCost: parseFloat(r.actual_cost || 0),
    profit: parseFloat(r.profit || 0),
    paidAmount: parseFloat(r.paid_amount || 0),
    specs: r.specs || {},
    photos: r.photos || []
});

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const invRes = await pool.query('SELECT SUM(cost * quantity) as total_inv_value, SUM(quantity) as total_items FROM inventory');
        const clientRes = await pool.query('SELECT COUNT(*) as total_clients, SUM(profit) as total_profit, SUM(total_price - paid_amount) as total_balance FROM clients');
        res.json({
            inventoryValue: parseFloat(invRes.rows[0].total_inv_value || 0),
            totalItems: parseInt(invRes.rows[0].total_items || 0),
            totalClients: parseInt(clientRes.rows[0].total_clients || 0),
            totalProfit: parseFloat(clientRes.rows[0].total_profit || 0),
            totalBalanceDue: parseFloat(clientRes.rows[0].total_balance || 0)
        });
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/dashboard/profit', async (req, res) => {
    const { start, end, group } = req.body;
    let trunc = 'day', fmt = 'YYYY-MM-DD';
    if (group === 'week') trunc = 'week';
    if (group === 'month') { trunc = 'month'; fmt = 'YYYY-MM'; }
    try {
        const { rows } = await pool.query(`SELECT to_char(date_trunc($1, order_date), $2) as label, SUM(profit) as value FROM clients WHERE order_date BETWEEN $3 AND $4 GROUP BY 1 ORDER BY 1 ASC`, [trunc, fmt, start, end]);
        res.json(rows.map(r => ({ date: r.label, profit: parseFloat(r.value) })));
    } catch (err) { res.status(500).send(err); }
});

app.get('/api/inventory', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM inventory ORDER BY category, name'); res.json(rows); } catch (e) { res.status(500).send(e); } });

app.post('/api/inventory/batch', async (req, res) => {
    const items = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            const { rows } = await client.query('SELECT * FROM inventory WHERE id = $1', [item.id]);
            if (rows.length > 0) {
                await client.query(`UPDATE inventory SET quantity=$1, cost=$2, name=$3, keyword=$4, sku=$5, category=$6, price=$7, location=$8, status=$9, notes=$10, updated_at=NOW() WHERE id=$11`, 
                    [item.quantity, item.cost, item.name, item.keyword, item.sku, item.category, item.price||0, item.location||'', item.status||'In Stock', item.notes||'', item.id]);
            } else {
                await client.query(`INSERT INTO inventory (id, category, name, keyword, sku, quantity, cost, price, location, status, notes, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`, 
                    [item.id, item.category, item.name, item.keyword, item.sku, item.quantity, item.cost, item.price||0, item.location||'', item.status||'In Stock', item.notes||'']);
            }
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).send(e); } finally { client.release(); }
});

// Partial update for a single inventory item (supports patch-style body)
// Body can include any subset of: category, name, keyword, sku, quantity, cost, price, location, status, notes
app.put('/api/inventory/:id', async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    const allowed = ['category','name','keyword','sku','quantity','cost','price','location','status','notes'];

    const sets = [];
    const values = [];
    let idx = 1;

    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, k)) {
            sets.push(`${k} = $${idx++}`);
            values.push(body[k]);
        }
    }

    // If nothing to update, still bump timestamp
    if (sets.length === 0) {
        await pool.query(`UPDATE inventory SET updated_at = NOW() WHERE id = $1`, [id]);
        const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
        return res.json(rows[0] || { success: true });
    }

    values.push(id);

    // Update timestamp for any inventory update
    const q = `UPDATE inventory SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;

    try {
        const r = await pool.query(q, values);
        return res.json(r.rows[0] || { success: true });
    } catch (e) {
        return res.status(500).send(e);
    }
});

app.delete('/api/inventory/:id', async (req, res) => { try { await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).send(e); } });

app.get('/api/clients', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM clients ORDER BY order_date DESC'); res.json(rows.map(mapClient)); } catch (e) { res.status(500).send(e); } });

app.post('/api/clients', async (req, res) => {
    const c = req.body;
    try {
        await pool.query(
            `INSERT INTO clients (
                id, wechat_name, wechat_id, real_name, xhs_name, xhs_id, 
                order_date, deposit_date, delivery_date, pcpp_link, is_shipping, tracking_number,
                address_line, city, state, zip_code, status,
                total_price, actual_cost, profit, paid_amount, specs, photos, rating, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (id) DO UPDATE SET
                wechat_name=EXCLUDED.wechat_name, wechat_id=EXCLUDED.wechat_id, real_name=EXCLUDED.real_name,
                xhs_name=EXCLUDED.xhs_name, xhs_id=EXCLUDED.xhs_id,
                order_date=EXCLUDED.order_date, deposit_date=EXCLUDED.deposit_date, delivery_date=EXCLUDED.delivery_date,
                pcpp_link=EXCLUDED.pcpp_link, is_shipping=EXCLUDED.is_shipping, tracking_number=EXCLUDED.tracking_number,
                address_line=EXCLUDED.address_line, city=EXCLUDED.city, state=EXCLUDED.state, zip_code=EXCLUDED.zip_code,
                status=EXCLUDED.status, total_price=EXCLUDED.total_price, actual_cost=EXCLUDED.actual_cost, profit=EXCLUDED.profit, paid_amount=EXCLUDED.paid_amount,
                specs=EXCLUDED.specs, photos=EXCLUDED.photos, rating=EXCLUDED.rating, notes=EXCLUDED.notes`,
            [
                c.id, c.wechatName, c.wechatId, c.realName, c.xhsName, c.xhsId,
                c.orderDate || null, c.orderDate || null, c.deliveryDate || null, c.pcppLink, c.isShipping, c.trackingNumber,
                c.address, c.city, c.state, c.zip, c.status,
                c.totalPrice, c.actualCost, c.profit, c.paidAmount, 
                JSON.stringify(c.specs), JSON.stringify(c.photos || []), c.rating, c.notes
            ]
        );
        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).send(e); }
});

app.delete('/api/clients/:id', async (req, res) => { try { await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { console.error(e); res.status(500).send(e); } });
app.get('/api/lookup/:code', async (req, res) => { 
    try { 
        const code = req.params.code;
        const cacheRes = await pool.query('SELECT data FROM product_cache WHERE barcode = $1', [code]);
        if (cacheRes.rows.length > 0) return res.json(cacheRes.rows[0].data);
        const apiRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        if (!apiRes.ok) throw new Error('API Failed');
        const data = await apiRes.json();
        if (data.items && data.items.length > 0) await pool.query(`INSERT INTO product_cache (barcode, data) VALUES ($1, $2) ON CONFLICT (barcode) DO UPDATE SET data = EXCLUDED.data`, [code, data]);
        res.json(data);
    } catch (e) { res.json({ items: [] }); }
}); 
app.get('/api/logs', async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200'); res.json(rows); } catch (e) { res.status(500).send(e); } });
app.post('/api/logs', async (req, res) => { const { id, timestamp, type, title, msg, meta } = req.body; try { await pool.query('INSERT INTO logs (id, timestamp, type, title, msg, meta) VALUES ($1,$2,$3,$4,$5,$6)', [id, timestamp, type, title, msg, meta]); res.json({success:true}); } catch (e) { res.status(500).send(e); } });

app.listen(5000, () => console.log('Server on 5000'));
