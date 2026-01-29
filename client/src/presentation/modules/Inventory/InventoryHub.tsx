import React, { useEffect, useMemo, useRef, useState } from 'react';
import { History, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { ALL_CATS, apiCallOrThrow } from '../../../utils';
import { InventoryItem } from '../../../types';
import { useInventoryQuery } from '../../../app/queries/inventory';
import { useInventoryWriteBehind } from '../../../app/writeBehind/inventoryWriteBehind';
import { useAlert, useConfirm } from '../../../app/confirm/ConfirmProvider';
import { StockAdjustModal } from './components/StockAdjustModal';

type InlineEditorProps = {
  value: any;
  onChange: (v: any) => void;
  type?: 'text' | 'number';
};

type MovementLog = {
  id: number;
  inventoryId: string;
  qtyDelta: number;
  reason: string;
  unitCost: number | null;
  unitCostUsed: number | null;
  onHandAfter: number;
  avgCostAfter: number;
  occurredAt: string;
  refType?: string | null;
  refId?: string | null;
  vendor?: string | null;
  receiptReceivedAt?: string | null;
  prevQty: number;
  prevCost: number;
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
  const alert = useAlert();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove'>('add');

  const [logOpen, setLogOpen] = useState(false);
  const [logItem, setLogItem] = useState<InventoryItem | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logMoves, setLogMoves] = useState<MovementLog[]>([]);

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
      `${i.name} ${i.category} ${i.sku ?? ''} ${i.keyword ?? ''}`.toLowerCase().includes(q),
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

  const formatUnitMoney = (n: number) =>
    n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const catTabs = ['ALL', ...ALL_CATS];

  const updateItem = (item: InventoryItem, fields: Partial<InventoryItem>) => {
    update(item.id, fields);
  };

  const readMetaValue = (item: InventoryItem | null, key: string) => {
    if (!item?.metadata || typeof item.metadata !== 'object') return '';
    const val = (item.metadata as any)[key];
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map((entry) => String(entry)).join(', ');
    if (val != null && typeof val !== 'object') return String(val);
    return '';
  };

  const updateMetaValue = (item: InventoryItem, key: string, raw: string) => {
    const base =
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? item.metadata
        : {};
    const next = { ...base } as Record<string, any>;
    const cleaned = String(raw || '').trim();
    if (cleaned) next[key] = cleaned;
    else delete next[key];
    update(item.id, { metadata: next });
    setLogItem((prev) => (prev && prev.id === item.id ? { ...prev, metadata: next } : prev));
  };

  const closeLog = () => {
    setLogOpen(false);
    setLogItem(null);
    setLogMoves([]);
    setLogError(null);
  };

  const openLog = async (item: InventoryItem) => {
    setLogItem(item);
    setLogOpen(true);
    setLogLoading(true);
    setLogError(null);
    try {
      const data = await apiCallOrThrow<MovementLog[]>(`/inventory/${item.id}/movements`);
      setLogMoves(data);
    } catch (err: any) {
      const msg = err?.userMessage || 'Failed to load history.';
      setLogError(msg);
      await alert({ title: 'Inventory History', message: msg });
    } finally {
      setLogLoading(false);
    }
  };

  const confirmDelete = (item: InventoryItem) => {
    void (async () => {
      const ok = await confirmDialog({
        title: 'Delete Item',
        message: `Delete ${item.name}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger',
      });
      if (ok) remove(item.id);
    })();
  };

  const chartMoves = useMemo(() => [...logMoves].slice().reverse(), [logMoves]);
  const chartValues = useMemo(() => {
    const vals: number[] = [];
    chartMoves.forEach((m) => {
      if (Number.isFinite(m.avgCostAfter)) vals.push(m.avgCostAfter);
      if (m.unitCost != null && Number.isFinite(m.unitCost)) vals.push(m.unitCost);
    });
    return vals;
  }, [chartMoves]);
  const logNeweggItem = logItem ? readMetaValue(logItem, 'neweggItem') : '';
  const logSerialNumber = logItem ? readMetaValue(logItem, 'sn') : '';

  const Chart = () => {
    if (chartMoves.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
          No history yet
        </div>
      );
    }

    const width = 520;
    const height = 180;
    const padX = 28;
    const padY = 24;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const min = Math.min(...chartValues, 0);
    const max = Math.max(...chartValues, 1);
    const range = max - min || 1;
    const scaleX = (i: number) =>
      padX + innerW * (chartMoves.length <= 1 ? 0.5 : i / (chartMoves.length - 1));
    const scaleY = (v: number) => padY + innerH * (1 - (v - min) / range);

    const wacPoints = chartMoves.map((m, i) => ({
      x: scaleX(i),
      y: scaleY(m.avgCostAfter),
    }));

    const unitPoints = chartMoves.map((m, i) =>
      m.unitCost != null ? { x: scaleX(i), y: scaleY(m.unitCost) } : null,
    );

    const buildPath = (pts: Array<{ x: number; y: number } | null>) => {
      let d = '';
      let started = false;
      pts.forEach((p) => {
        if (!p) {
          started = false;
          return;
        }
        if (!started) {
          d += `M ${p.x} ${p.y}`;
          started = true;
          return;
        }
        d += ` L ${p.x} ${p.y}`;
      });
      return d;
    };

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Cost History (WAC vs Unit)
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              WAC
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Unit
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
          {[0.25, 0.5, 0.75].map((p) => {
            const y = padY + innerH * p;
            return (
              <line
                key={p}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}
          <path d={buildPath(wacPoints)} fill="none" stroke="#0f172a" strokeWidth="2.5" />
          <path
            d={buildPath(unitPoints)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-2">
          <span>{formatUnitMoney(min)}</span>
          <span>{formatUnitMoney(max)}</span>
        </div>
      </div>
    );
  };

  const movementLabel = (m: MovementLog) => {
    if (m.reason === 'RECEIVE') return 'Received';
    if (m.reason === 'CONSUME') return 'Consumed';
    if (m.reason === 'ADJUST') return 'Adjusted';
    return m.reason || 'Updated';
  };

  const movementSource = (m: MovementLog) => {
    if (m.vendor) return m.vendor;
    if (m.refType === 'RECEIPT') return 'Receipt';
    if (m.refType === 'ADJUST') return 'Manual Adjust';
    if (m.refType === 'BATCH') return 'Batch';
    return m.refType || 'Update';
  };

  return (
    <div className="relative">
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

      <div className="md:hidden min-h-full bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="px-4 pt-6 pb-32">
          <div className="relative overflow-hidden rounded-[28px] bg-slate-900 p-5 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Inventory
                </div>
                <div className="mt-1 text-2xl font-black tracking-tight">Inventory Hub</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {activeCat === 'ALL' ? 'Total value' : `${activeCat} value`}
                </div>
                <div className="mt-1 text-xl font-black">{formatMoney(totalValue)}</div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-200">
              <span className="text-white">{filtered.length}</span> items
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-emerald-400/20 blur-3xl" />
          </div>

          <div className="mt-5 -mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {catTabs.map((c) => {
                const active = activeCat === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCat(c)}
                    className={[
                      'whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border transition',
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/30'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                placeholder="Search components..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {filtered.map((i) => (
              <div
                key={i.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Component
                      </div>
                      <div className="mt-1 text-base font-black text-slate-900 truncate">
                        <InlineEditor value={i.name} onChange={(v) => updateItem(i, { name: v })} />
                      </div>
                    </div>
                    <div className="shrink-0">
                      <select
                        className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 outline-none"
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        SKU
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        <InlineEditor value={i.sku ?? ''} onChange={(v) => updateItem(i, { sku: v })} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Keyword
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        <InlineEditor
                          value={i.keyword ?? ''}
                          onChange={(v) => updateItem(i, { keyword: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Avg Cost
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-700">
                        <span className="text-slate-400">$</span>
                        <InlineEditor
                          type="number"
                          value={Number(i.cost ?? 0)}
                          onChange={(v) => updateItem(i, { cost: Number(v) })}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        In Stock
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 items-center">
                        <button
                          onClick={() => openModal(i, 'remove')}
                          className="h-10 rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                          title="Remove stock"
                        >
                          <Minus size={16} strokeWidth={3} className="mx-auto" />
                        </button>
                        <button
                          onClick={() => openModal(i, 'add')}
                          className="h-10 rounded-xl border border-slate-200 bg-white font-mono text-sm font-black text-slate-700 shadow-sm"
                          title="Open stock dialog"
                        >
                          {Number(i.quantity ?? 0)}
                        </button>
                        <button
                          onClick={() => openModal(i, 'add')}
                          className="h-10 rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-emerald-50 hover:text-emerald-600"
                          title="Add stock"
                        >
                          <Plus size={16} strokeWidth={3} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openLog(i)}
                        className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500"
                        title="Logs"
                      >
                        <History size={14} />
                        Logs
                      </button>
                      <button
                        onClick={() => confirmDelete(i)}
                        className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                No inventory items found
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:block p-8 max-w-[1600px] mx-auto pb-40">
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
            <div className="col-span-4">Component Name</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">SKU / Keyword</div>
            <div className="col-span-2 text-center">Stock</div>
            <div className="col-span-1 text-right">Avg. Cost</div>
            <div className="col-span-1"></div>
          </div>

          {filtered.map((i) => (
            <div
              key={i.id}
              className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-50 hover:bg-slate-50 items-center text-sm"
            >
              <div className="col-span-4 font-bold text-slate-700 truncate">
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

              <div className="col-span-2 text-[11px] text-slate-600 space-y-1">
                <InlineEditor value={i.sku ?? ''} onChange={(v) => updateItem(i, { sku: v })} />
                <InlineEditor
                  value={i.keyword ?? ''}
                  onChange={(v) => updateItem(i, { keyword: v })}
                />
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

              <div className="col-span-1 text-right font-mono text-slate-600 font-bold">
                <div className="flex justify-end items-center gap-1">
                  <span className="text-slate-400">$</span>
                  <div className="min-w-[72px] text-right">
                    <InlineEditor
                      type="number"
                      value={Number(i.cost ?? 0)}
                      onChange={(v) => updateItem(i, { cost: Number(v) })}
                    />
                  </div>
                </div>
              </div>

            <div className="col-span-1 flex justify-end gap-2">
              <button
                onClick={() => openLog(i)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-slate-600 hover:bg-slate-50"
                title="Logs"
              >
                <History size={14} />
              </button>
              <button
                onClick={() => confirmDelete(i)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-200 hover:text-red-400 hover:bg-red-50"
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

      {logOpen && logItem ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeLog} />
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[2rem] bg-slate-50 border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Inventory Logs
                </div>
                <div className="text-xl font-black text-slate-900">{logItem.name}</div>
              </div>
              <button
                onClick={closeLog}
                className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {logLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                Loading history...
              </div>
            ) : logError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
                {logError}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Internal Codes
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Newegg Item #
                      </div>
                      <div className="mt-1">
                        <InlineEditor
                          value={logNeweggItem}
                          onChange={(val) => {
                            if (logItem) updateMetaValue(logItem, 'neweggItem', String(val));
                          }}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Serial Number (SN)
                      </div>
                      <div className="mt-1">
                        <InlineEditor
                          value={logSerialNumber}
                          onChange={(val) => {
                            if (logItem) updateMetaValue(logItem, 'sn', String(val));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Chart />

                <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {logMoves.length === 0 ? (
                    <div className="p-6 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                      No movements found
                    </div>
                  ) : (
                    logMoves.map((m) => (
                      <div key={m.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {movementSource(m)}
                            </div>
                            <div className="text-sm font-bold text-slate-800">
                              {movementLabel(m)} {m.qtyDelta >= 0 ? '+' : ''}
                              {m.qtyDelta}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Date
                            </div>
                            <div className="text-xs font-bold text-slate-600">
                              {formatDate(m.receiptReceivedAt || m.occurredAt)}
                            </div>
                            <div className="text-[10px] font-medium text-slate-400">
                              {formatDateTime(m.occurredAt)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-semibold text-slate-600">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Before
                            </div>
                            <div className="mt-1">Qty: {m.prevQty}</div>
                            <div>Cost: {formatUnitMoney(m.prevCost)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              This Cost
                            </div>
                            <div className="mt-1">
                              {m.unitCost != null
                                ? formatUnitMoney(m.unitCost)
                                : '—'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              After (WAC)
                            </div>
                            <div className="mt-1">Qty: {m.onHandAfter}</div>
                            <div>Cost: {formatUnitMoney(m.avgCostAfter)}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
