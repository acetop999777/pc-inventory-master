import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ALL_CATS } from '../../../utils';
import { InventoryItem } from '../../../types';
import { useInventoryQuery } from '../../../app/queries/inventory';
import { useInventoryWriteBehind } from '../../../app/writeBehind/inventoryWriteBehind';
import { useConfirm } from '../../../app/confirm/ConfirmProvider';
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
  const inventory: InventoryItem[] = useMemo(() => data ?? [], [data]);
  const { update, remove } = useInventoryWriteBehind();
  const confirmDialog = useConfirm();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove'>('add');

  const openModal = (item: InventoryItem, mode: 'add' | 'remove') => {
    setModalItem(item);
    setModalMode(mode);
    setModalOpen(true);
  };

  const filtered = useMemo(() => {
    const base =
      activeCat === 'ALL' ? inventory : inventory.filter((i) => i.category === activeCat);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) =>
      `${i.name} ${i.category} ${i.sku ?? ''}`.toLowerCase().includes(q),
    );
  }, [inventory, search, activeCat]);

  const totalValue = useMemo(
    () =>
      filtered.reduce(
        (sum, i) => sum + Number(i.cost ?? 0) * Number(i.quantity ?? 0),
        0,
      ),
    [filtered],
  );

  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const catTabs = ['ALL', ...ALL_CATS];

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

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {catTabs.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                className={[
                  'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition',
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {c}
              </button>
            );
          })}

          <div className="ml-auto text-[11px] font-black uppercase tracking-widest text-slate-400">
            {activeCat === 'ALL' ? 'All inventory value' : `${activeCat} value`}
            <span className="mx-2 text-slate-300">•</span>
            <span className="text-slate-700">{formatMoney(totalValue)}</span>
          </div>
        </div>

        <div className="flex gap-4 items-center">
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
              <div className="flex justify-end items-center gap-1">
                <span className="text-slate-400">$</span>
                <div className="min-w-[88px] text-right">
                  <InlineEditor
                    type="number"
                    value={Number(i.cost ?? 0)}
                    onChange={(v) => updateItem(i, { cost: Number(v) })}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-1 flex justify-end">
              <button
                onClick={() => {
                  void (async () => {
                    const ok = await confirmDialog({
                      title: 'Delete Item',
                      message: `Delete ${i.name}?`,
                      confirmText: 'Delete',
                      cancelText: 'Cancel',
                      tone: 'danger',
                    });
                    if (ok) remove(i.id);
                  })();
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
