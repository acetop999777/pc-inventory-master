set -euo pipefail
cd ~/pc-inventory-master

# 选择 docker compose 命令
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: need docker compose v2 or docker-compose v1" >&2
  exit 1
fi

# 1) 用 python 补丁：如果 route 不存在，就插入到 app.delete('/api/inventory/:id') 之前
python3 - <<'PY'
from pathlib import Path
import re, textwrap

p = Path("server/index.js")
if not p.exists():
    raise SystemExit("ERROR: server/index.js not found")

txt = p.read_text(encoding="utf-8")

# 如果已经有该 route，就不重复插入
if "app.put('/api/inventory/:id'" in txt or 'app.put("/api/inventory/:id"' in txt:
    print("PUT /api/inventory/:id already exists, skip patch.")
else:
    block = textwrap.dedent(r"""
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
            // try last_updated first, fallback to updated_at
            try {
                await pool.query(`UPDATE inventory SET last_updated = NOW() WHERE id = $1`, [id]);
                const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
                return res.json(rows[0] || { success: true });
            } catch (e) {
                try {
                    await pool.query(`UPDATE inventory SET updated_at = NOW() WHERE id = $1`, [id]);
                    const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
                    return res.json(rows[0] || { success: true });
                } catch (e2) {
                    return res.status(500).send(e2);
                }
            }
        }

        values.push(id);

        // Try schema with last_updated, fallback to updated_at (for older DB)
        const q1 = `UPDATE inventory SET ${sets.join(', ')}, last_updated = NOW() WHERE id = $${idx} RETURNING *`;
        const q2 = `UPDATE inventory SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;

        try {
            const r = await pool.query(q1, values);
            return res.json(r.rows[0] || { success: true });
        } catch (e) {
            try {
                const r2 = await pool.query(q2, values);
                return res.json(r2.rows[0] || { success: true });
            } catch (e2) {
                return res.status(500).send(e2);
            }
        }
    });
    """).strip("\n") + "\n\n"

    # 插入到 inventory delete route 前面
    m = re.search(r"app\.delete\('/api/inventory/:id'.*?\);\s*", txt)
    if not m:
        raise SystemExit("ERROR: can't find app.delete('/api/inventory/:id') to insert before")

    txt = txt[:m.start()] + block + txt[m.start():]
    p.write_text(txt, encoding="utf-8")
    print("Inserted PUT /api/inventory/:id into", p)

PY

git add server/index.js
git commit -m "phase4.1: backend add PUT /api/inventory/:id (partial update + schema fallback)"
git tag -a phase4_1-$(date +%Y%m%d) -m "phase4.1: inventory PUT endpoint"

# 2) 只重建 server（更快），然后重启
$DC build --no-cache server
$DC up -d

# 3) 快速验证 endpoint 是否存在
curl -i -X PUT "http://localhost:5001/api/inventory/__does_not_exist__" \
  -H "Content-Type: application/json" \
  -d '{"name":"_probe_"}' | head -n 5

# 4) smoke
./scripts/smoke.sh
