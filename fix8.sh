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

mkdir -p client/src/presentation/modules/Inventory/components

# 1) 新增：StockAdjustModal（Tailwind UI 风格）
cat > client/src/presentation/modules/Inventory/components/StockAdjustModal.tsx <<'EOF'
import React from 'react';
import { X } from 'lucide-react';
import { InventoryItem } from '../../../../types';

type Mode = 'add' | 'remove';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function StockAdjustModal(props: {
  open: boolean;
  item: InventoryItem | null;
  initialMode?: Mode;
  onClose: () => void;
  onApply: (payload: { quantity: number; cost: number }) => void;
}) {
  const { open, item, onClose, onApply } = props;

  const [mode, setMode] = React.useState<Mode>(props.initialMode ?? 'add');
  const [qtyInput, setQtyInput] = React.useState<string>('1');
  const [unitCostInput, setUnitCostInput] = React.useState<string>('0');

  React.useEffect(() => {
    if (!open || !item) return;
    setMode(props.initialMode ?? 'add');
    setQtyInput('1');
    setUnitCostInput(String(Number(item.cost ?? 0)));
  }, [open, item, props.initialMode]);

  if (!open || !item) return null;

  const currentQty = clampInt(Number(item.quantity ?? 0));
  const currentAvg = Number(item.cost ?? 0);

  const qty = clampInt(Number(qtyInput));
  const unitCost = Number(unitCostInput);

  const previewQty =
    mode === 'add'
      ? currentQty + qty
      : Math.max(0, currentQty - qty);

  const previewAvg =
    mode === 'add'
      ? (previewQty > 0
          ? ((currentQty * currentAvg) + (qty * (Number.isFinite(unitCost) ? unitCost : 0))) / previewQty
          : 0)
      : currentAvg; // remove doesn't change WAC

  const canApply =
    qty > 0 &&
    (mode === 'remove' || (Number.isFinite(unitCost) && unitCost >= 0));

  const apply = () => {
    if (!canApply) return;
    onApply({ quantity: previewQty, cost: round2(previewAvg) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <div className="text-sm font-black text-slate-900">Update Stock</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">
                {item.name} <span className="text-slate-300">·</span> {item.category}
              </div>
            </div>
            <button
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 grid grid-cols-12 gap-6">
            {/* left: form */}
            <div className="col-span-12 md:col-span-7 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</div>
                    <div className="mt-1 font-mono text-lg font-black text-slate-800">{currentQty}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">WAC Avg Cost</div>
                    <div className="mt-1 font-mono text-lg font-black text-slate-800">${round2(currentAvg)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('add')}
                    className={`px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider ${
                      mode === 'add'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Add Stock
                  </button>
                  <button
                    onClick={() => setMode('remove')}
                    className={`px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider ${
                      mode === 'remove'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Remove Stock
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {mode === 'add' ? 'Add Quantity' : 'Remove Quantity'}
                  </div>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    inputMode="numeric"
                  />
                  <div className="text-[11px] text-slate-400">
                    Integer ≥ 1
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Unit Cost (this update)
                  </div>
                  <input
                    className={`w-full px-3 py-2 rounded-xl border text-sm font-bold outline-none focus:ring-2 ${
                      mode === 'remove'
                        ? 'border-slate-200 bg-slate-50 text-slate-300'
                        : 'border-slate-200 bg-white text-slate-900 focus:ring-blue-200'
                    }`}
                    value={unitCostInput}
                    onChange={(e) => setUnitCostInput(e.target.value)}
                    inputMode="decimal"
                    disabled={mode === 'remove'}
                  />
                  <div className="text-[11px] text-slate-400">
                    Used to compute new WAC (only for Add)
                  </div>
                </div>
              </div>
            </div>

            {/* right: preview */}
            <div className="col-span-12 md:col-span-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sticky top-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview</div>

                <div className="mt-3 space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Quantity</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-800">{previewQty}</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">New WAC Avg Cost</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-800">${round2(previewAvg)}</div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      {mode === 'remove'
                        ? 'Removing stock keeps WAC unchanged.'
                        : 'WAC = (oldQty*oldAvg + addQty*unitCost) / (oldQty+addQty)'}
                    </div>
                  </div>

                  {!canApply && (
                    <div className="text-[11px] text-red-500 font-bold">
                      Please enter a valid quantity{mode === 'add' ? ' and unit cost' : ''}.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={apply}
                    disabled={!canApply}
                    className={`flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${
                      canApply
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Apply
                  </button>
                </div>

                <div className="mt-3 text-[10px] text-slate-400 font-bold">
                  Changes save in background (Syncing → Saved).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

# 2) 重写 InventoryHub 的库存控制：+/- 打开 modal；modal apply -> update(quantity,cost)
cat > client/src/presentation/modules/Inventory/InventoryHub.tsx <<'EOF'
import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ALL_CATS } from '../../../utils';
import { InventoryItem } from '../../../types';
import { useInventoryQuery } from '../../../app/queries/inventory';
import { useInventoryWriteBehind } from '../../../app/writeBehind/inventoryWriteBehind';
import { StockAdjustModal } from './components/StockAdjustModal';

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

export default function InventoryHub() {
  const { data } = useInventoryQuery();
  const inventory: InventoryItem[] = data ?? [];
  const { update, remove } = useInventoryWriteBehind();
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove'>('add');

  const openModal = (item: InventoryItem, mode: 'add' | 'remove') => {
    setModalItem(item);
    setModalMode(mode);
    setModalOpen(true);
  };

  const filtered = inventory.filter((i) =>
    `${i.name} ${i.category} ${i.sku ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const updateItem = (item: InventoryItem, fields: Partial<InventoryItem>) => {
    update(item.id, fields);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-40">
      <StockAdjustModal
        open={modalOpen}
        item={modalItem}
        initialMode={modalMode}
        onClose={() => setModalOpen(false)}
        onApply={(payload) => {
          if (!modalItem) return;
          updateItem(modalItem, payload);
        }}
      />

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
          <div className="col-span-2 text-center">Stock</div>
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
                onClick={() => openModal(i, 'remove')}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200"
                title="Remove stock"
              >
                <Minus size={14} strokeWidth={3} />
              </button>

              <button
                onClick={() => openModal(i, 'add')}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 font-mono font-black text-slate-700 min-w-[64px]"
                title="Open stock dialog"
              >
                {Number(i.quantity ?? 0)}
              </button>

              <button
                onClick={() => openModal(i, 'add')}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200"
                title="Add stock"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>

            <div className="col-span-2 text-right font-mono text-slate-600 font-bold">
              ${Number(i.cost ?? 0)}
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

git add -A
git commit -m "phase4.3: inventory stock update modal (tailwind ui) with realtime WAC preview" || true

TAG="phase4_3-$(date +%Y%m%d)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG="${TAG}b"
fi
git tag -a "$TAG" -m "phase4.3: inventory modal UI + WAC preview"

$DC build --no-cache client
$DC up -d
./scripts/smoke.sh
