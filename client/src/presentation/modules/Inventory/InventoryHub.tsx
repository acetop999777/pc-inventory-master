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
