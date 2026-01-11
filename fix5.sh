set -euo pipefail
cd ~/pc-inventory-master

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: need docker compose v2 or docker-compose v1" >&2
  exit 1
fi

# ✅ 补齐缺失目录（你现在缺的就是这个）
mkdir -p client/src/app/writeBehind
mkdir -p client/src/app/queries
mkdir -p client/src/presentation/modules/Inventory
mkdir -p client/src/presentation/modules/Inbound

# 1) 覆盖 inventory query（把 quantity/cost 强制 normalize 为 number）
cat > client/src/app/queries/inventory.ts <<'EOF'
import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { InventoryItem } from '../../types';

export const inventoryQueryKey = ['inventory'] as const;

export function normalizeInventoryRow(row: any): InventoryItem {
  const cost = Number(row?.cost ?? 0);
  const quantity = Number(row?.quantity ?? 0);

  return {
    id: String(row?.id ?? ''),
    sku: String(row?.sku ?? ''),
    name: String(row?.name ?? ''),
    category: String(row?.category ?? ''),
    cost: Number.isFinite(cost) ? cost : 0,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    lastUpdated: Number(row?.lastUpdated ?? row?.last_updated ?? row?.updated_at ?? Date.now()),
    keyword: row?.keyword ?? undefined,
    price: row?.price !== undefined ? Number(row.price) : undefined,
    location: row?.location ?? undefined,
    status: row?.status ?? undefined,
    notes: row?.notes ?? undefined,
    photos: Array.isArray(row?.photos) ? row.photos : undefined,
  };
}

export function useInventoryQuery() {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>('/inventory');
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map(normalizeInventoryRow);
    },
  });
}
EOF

# 2) 覆盖 inventory write-behind：写入成功后用后端返回 row 直接 set 到 cache（保证不刷新也能看到）
cat > client/src/app/writeBehind/inventoryWriteBehind.ts <<'EOF'
import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { InventoryItem } from '../../types';
import { inventoryQueryKey, normalizeInventoryRow } from '../queries/inventory';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';

type InventoryWrite =
  | { op: 'patch'; fields: Partial<InventoryItem> }
  | { op: 'delete' };

function mergeInventoryWrite(a: InventoryWrite, b: InventoryWrite): InventoryWrite {
  if (a.op === 'delete' || b.op === 'delete') return { op: 'delete' };
  return { op: 'patch', fields: { ...a.fields, ...b.fields } };
}

function coerceFields(fields: Partial<InventoryItem>): Partial<InventoryItem> {
  const f: any = { ...fields };
  if (Object.prototype.hasOwnProperty.call(f, 'cost')) f.cost = Number(f.cost ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'quantity')) f.quantity = Number(f.quantity ?? 0);
  return f;
}

export function useInventoryWriteBehind() {
  const qc = useQueryClient();
  const { queue } = useSaveQueue();

  const applyOptimistic = (id: string, fields: Partial<InventoryItem>) => {
    const nextFields = coerceFields(fields);
    qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) =>
      old.map((it) => (it.id === id ? { ...it, ...nextFields, lastUpdated: Date.now() } : it))
    );
  };

  const removeOptimistic = (id: string) => {
    qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) => old.filter((it) => it.id !== id));
  };

  const update = (id: string, fields: Partial<InventoryItem>) => {
    applyOptimistic(id, fields);

    void queue.enqueue<InventoryWrite>({
      key: `inventory:${id}`,
      label: 'Inventory',
      patch: { op: 'patch', fields: coerceFields(fields) },
      merge: mergeInventoryWrite,
      write: async (w) => {
        if (w.op === 'delete') {
          await apiCallOrThrow(`/inventory/${id}`, 'DELETE');
          return;
        }
        const updatedRow = await apiCallOrThrow<any>(`/inventory/${id}`, 'PUT', w.fields);
        const normalized = normalizeInventoryRow(updatedRow);

        qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) =>
          old.map((it) => (it.id === id ? { ...it, ...normalized } : it))
        );
      },
      debounceMs: 500,
    });
  };

  const remove = (id: string) => {
    removeOptimistic(id);
    void queue.enqueue<InventoryWrite>({
      key: `inventory:${id}`,
      label: 'Inventory',
      patch: { op: 'delete' },
      merge: mergeInventoryWrite,
      write: async () => {
        await apiCallOrThrow(`/inventory/${id}`, 'DELETE');
      },
      debounceMs: 0,
    });
  };

  return { update, remove };
}
EOF

# 3) 覆盖 InventoryHub：- confirm；+ WAC（输入 add qty + unit cost）
cat > client/src/presentation/modules/Inventory/InventoryHub.tsx <<'EOF'
import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ALL_CATS } from '../../../utils';
import { InventoryItem } from '../../../types';
import { useInventoryQuery } from '../../../app/queries/inventory';
import { useInventoryWriteBehind } from '../../../app/writeBehind/inventoryWriteBehind';

type InlineEditorProps = {
  value: any;
  onChange: (v: any) => void;
  type?: 'text' | 'number';
};

const InlineEditor = ({ value, onChange, type = 'text' }: InlineEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempVal(String(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = (raw: string) => {
    if (type === 'number') {
      if (raw.trim() === '') {
        onChange(0);
        return;
      }
      const n = Number(raw);
      if (Number.isFinite(n)) onChange(n);
      return;
    }
    onChange(raw);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="w-full bg-blue-50 border border-blue-300 rounded px-1 text-slate-900 outline-none font-bold"
        value={tempVal}
        onChange={(e) => {
          const next = e.target.value;
          setTempVal(next);
          commit(next);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200 rounded px-1 transition-all min-h-[1.2rem]"
    >
      {type === 'number' ? value : value || <span className="text-slate-300 italic">Empty</span>}
    </div>
  );
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function InventoryHub() {
  const { data } = useInventoryQuery();
  const inventory: InventoryItem[] = data ?? [];
  const { update, remove } = useInventoryWriteBehind();
  const [search, setSearch] = useState('');

  const filtered = inventory.filter((i) =>
    `${i.name} ${i.category} ${i.sku ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const updateItem = (item: InventoryItem, fields: Partial<InventoryItem>) => {
    update(item.id, fields);
  };

  const handleDecrement = (item: InventoryItem) => {
    const qty = Number(item.quantity ?? 0);
    if (qty <= 0) return;

    const ok = window.confirm(`Reduce stock by 1?\n\n${item.name}\n${qty} → ${qty - 1}`);
    if (!ok) return;

    updateItem(item, { quantity: qty - 1 });
  };

  const handleIncrementWithWac = (item: InventoryItem) => {
    const qty = Number(item.quantity ?? 0);
    const avg = Number(item.cost ?? 0);

    const addQtyStr = window.prompt('Add quantity (default 1):', '1');
    if (addQtyStr === null) return;
    const addQty = Math.max(1, Math.floor(Number(addQtyStr)));
    if (!Number.isFinite(addQty) || addQty <= 0) return;

    const unitCostStr = window.prompt('Unit cost for this inbound stock:', String(avg || 0));
    if (unitCostStr === null) return;
    const unitCost = Number(unitCostStr);
    if (!Number.isFinite(unitCost) || unitCost < 0) return;

    const newQty = qty + addQty;
    const newAvg = newQty > 0 ? ((qty * avg) + (addQty * unitCost)) / newQty : 0;

    updateItem(item, { quantity: newQty, cost: round2(newAvg) });
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-40">
      <div className="flex gap-4 mb-6 items-center">
        <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
          <Search size={16} className="ml-2 text-slate-400" />
          <input
            className="w-full text-xs font-bold outline-none"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-5">Component Name</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2 text-center">Stock Control</div>
          <div className="col-span-2 text-right">Avg. Cost (WAC)</div>
          <div className="col-span-1"></div>
        </div>

        {filtered.map((i) => (
          <div
            key={i.id}
            className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-50 hover:bg-slate-50 items-center text-sm"
          >
            <div className="col-span-5 font-bold text-slate-700 truncate">
              <InlineEditor value={i.name} onChange={(v) => updateItem(i, { name: v })} />
            </div>

            <div className="col-span-2">
              <select
                className="bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase px-2 py-1 outline-none"
                value={i.category}
                onChange={(e) => updateItem(i, { category: e.target.value })}
              >
                {ALL_CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex items-center justify-center gap-3">
              <button
                onClick={() => handleDecrement(i)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500"
                title="Decrement (confirm)"
              >
                <Minus size={12} strokeWidth={3} />
              </button>

              <span className="font-mono font-bold w-12 text-center text-slate-700">
                <InlineEditor
                  type="number"
                  value={i.quantity}
                  onChange={(v) => updateItem(i, { quantity: Number(v) })}
                />
              </span>

              <button
                onClick={() => handleIncrementWithWac(i)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"
                title="Increment (WAC)"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>

            <div className="col-span-2 text-right font-mono text-slate-600 font-bold">
              <div className="flex justify-end items-center gap-1">
                <span>$</span>
                <InlineEditor
                  type="number"
                  value={i.cost}
                  onChange={(v) => updateItem(i, { cost: Number(v) })}
                />
              </div>
            </div>

            <div className="col-span-1 flex justify-end">
              <button
                onClick={() => {
                  if (window.confirm('Delete?')) remove(i.id);
                }}
                className="text-slate-200 hover:text-red-400"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase italic">
            No inventory items found
          </div>
        )}
      </div>
    </div>
  );
}
EOF

# 4) AppLegacy：不要再给 InventoryHub / InboundHub 传 props inventory（避免双数据源导致必须刷新）
python3 - <<'PY'
from pathlib import Path
import re

p = Path("client/src/AppLegacy.tsx")
txt = p.read_text(encoding="utf-8")
txt = re.sub(r"return <InventoryHub\s+inventory=\{inventory\}\s*/>;", "return <InventoryHub />;", txt)
txt = re.sub(r"return <InboundHub\s+inventory=\{inventory\}\s*/>;", "return <InboundHub />;", txt)
p.write_text(txt, encoding="utf-8")
print("patched:", p)
PY

# 5) InboundHub：也改为用 useInventoryQuery（单一数据源）
cat > client/src/presentation/modules/Inbound/InboundHub.tsx <<'EOF'
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InboundScanner } from './components/InboundScanner';
import { StagingArea } from './components/StagingArea';
import { StagedItem, processScan, parseNeweggText } from '../../../domain/inventory/inbound.logic';
import { InventoryItem } from '../../../types';
import { apiCallOrThrow } from '../../../utils';
import { useInventoryQuery, inventoryQueryKey } from '../../../app/queries/inventory';

export default function InboundHub() {
  const qc = useQueryClient();
  const { data } = useInventoryQuery();
  const inventory: InventoryItem[] = data ?? [];

  const [batch, setBatch] = useState<StagedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleScan = async (code: string) => {
    setLoading(true);
    const res = await processScan(code, batch, inventory);
    setLoading(false);

    if (res.updatedBatch) setBatch(res.updatedBatch);
    else if (res.item) setBatch((prev) => [res.item!, ...prev]);
  };

  const handleParse = (text: string) => {
    const res = parseNeweggText(text, inventory);
    if (res.items.length > 0) setBatch((prev) => [...res.items, ...prev]);
    else alert('No items found or parse error');
  };

  const handleCommit = async () => {
    if (!window.confirm(`Commit ${batch.length} items to inventory?`)) return;

    const payloadMap = new Map<string, InventoryItem>();

    batch.forEach((item) => {
      const existingInMap = payloadMap.get(item.id);
      const existingInDb = inventory.find((i) => i.id === item.id);
      const base = existingInMap || existingInDb || ({ ...item, quantity: 0, cost: 0 } as any);

      const baseQty = Number((base as any).quantity ?? 0);
      const baseCost = Number((base as any).cost ?? 0);
      const inQty = Number((item as any).qtyInput ?? 0);
      const inCost = Number((item as any).costInput ?? 0);

      const currentTotalVal = baseQty * baseCost;
      const newTotalVal = inQty * inCost;

      const totalQty = baseQty + inQty;
      const newAvgCost = totalQty > 0 ? (currentTotalVal + newTotalVal) / totalQty : 0;

      payloadMap.set(item.id, {
        ...(base as any),
        name: item.name,
        category: item.category,
        quantity: totalQty,
        cost: Math.round(newAvgCost * 100) / 100,
        sku: (item as any).sku,
        keyword: (item as any).keyword,
        lastUpdated: Date.now(),
        price: (base as any).price || 0,
        location: (base as any).location || '',
        status: (base as any).status || 'In Stock',
        notes: (base as any).notes || '',
        photos: (base as any).photos || [],
      });
    });

    try {
      await apiCallOrThrow('/inventory/batch', 'POST', Array.from(payloadMap.values()));
      setBatch([]);
      alert('Inventory Updated Successfully!');
      await qc.invalidateQueries({ queryKey: inventoryQueryKey });
    } catch (e) {
      console.error(e);
      alert('Failed to commit batch');
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <InboundScanner onScan={handleScan} onParse={handleParse} loading={loading} />
        <StagingArea batch={batch} inventory={inventory} setBatch={setBatch} onCommit={handleCommit} />
      </div>
    </div>
  );
}
EOF

# 6) commit + tag（tag 若已存在就自动换一个名字）
git add -A
git commit -m "phase4.2: inventory realtime cache sync + qty confirm + WAC increment + normalize numbers + single source" || true

TAG="phase4_2-$(date +%Y%m%d)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG="${TAG}b"
fi
git tag -a "$TAG" -m "phase4.2: inventory realtime + WAC + qty controls"

# 7) rebuild client + restart
$DC build --no-cache client
$DC up -d

$DC logs --tail=120 client
$DC logs --tail=120 server


./scripts/smoke.sh
