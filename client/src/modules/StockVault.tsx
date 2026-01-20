import React, { useState, useMemo } from 'react';
import { Plus, Minus, X, Trash2, History } from 'lucide-react';
import { InlineEdit } from '../components/Shared';
import { ALL_CATS, formatMoney, apiCall } from '../utils';
import { AppData, InventoryItem, AuditLog } from '../types';
import { apiFetch } from './lib/api';
import { useConfirm } from '../app/confirm/ConfirmProvider';

interface Props {
  data: AppData;
  refresh: () => void;
  notify: (msg: string, type?: string) => void;
  log: (type: string, title: string, msg: string) => void;
}

export default function StockVault({ data, refresh, notify, log: _log }: Props) {
  const confirmDialog = useConfirm();
  const [cat, setCat] = useState('All');

  // --- Add Stock Modal State ---
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addCost, setAddCost] = useState(0);

  // --- History Modal State ---
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const filtered = data.inv.filter((i) => cat === 'All' || i.category === cat);

  // --- Actions ---

  const quickUpdate = async (item: InventoryItem, field: keyof InventoryItem, val: string) => {
    let parsedVal: string | number = val;
    if (field === 'quantity') parsedVal = parseInt(val) || 0;
    if (field === 'cost') parsedVal = parseFloat(val) || 0;
    if (field === 'category') parsedVal = val.toUpperCase();

    await apiCall('/inventory/batch', 'POST', [{ ...item, [field]: parsedVal }]);
    refresh();
    notify(`${field.toUpperCase()} Updated`);
  };

  const handleQuickMinus = async (item: InventoryItem) => {
    if (item.quantity <= 0) return;
    const ok = await confirmDialog({
      title: 'Decrease Stock',
      message: `Decrease stock of ${item.name} by 1?`,
      confirmText: 'Decrease',
      cancelText: 'Cancel',
    });
    if (ok) {
      const newQty = item.quantity - 1;
      await apiCall('/inventory/batch', 'POST', [{ ...item, quantity: newQty }]);
      refresh();
      notify('Stock Decreased');
    }
  };

  const openAddModal = (item: InventoryItem) => {
    setModalItem(item);
    setAddQty(1);
    setAddCost(item.cost);
  };

  const commitAdd = async () => {
    if (!modalItem) return;
    const newQty = modalItem.quantity + addQty;
    const newCost = (modalItem.quantity * modalItem.cost + addQty * addCost) / newQty;
    await apiCall('/inventory/batch', 'POST', [
      { ...modalItem, quantity: newQty, cost: parseFloat(newCost.toFixed(2)) },
    ]);
    notify(`Stock Added (+${addQty})`);
    setModalItem(null);
    refresh();
  };

  const deleteItem = async (item: InventoryItem) => {
    const ok = await confirmDialog({
      title: 'Delete Item',
      message: `Permanently delete ${item.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (ok) {
      await apiCall(`/inventory/${item.id}`, 'DELETE');
      notify('Item Deleted');
      refresh();
    }
  };

  // --- 修复点：添加时间戳防止缓存 ---
  const handleViewHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setLoadingLogs(true);
    setHistoryLogs([]);
    try {
      const target = item.sku || 'NO-SKU';
      // 技巧：加一个随机参数 ?_=${Date.now()} 强制浏览器不读缓存
      const res = await apiFetch(`/api/audit/${target}?_=${Date.now()}`);

      if (!res.ok) {
        const txt = await res.text();
        console.error('API Error:', txt);
        throw new Error('Server Error');
      }

      const logs = await res.json();
      setHistoryLogs(logs);
    } catch (e) {
      console.error(e);
      notify('Failed to load history', 'error');
    }
    setLoadingLogs(false);
  };

  const projectedWAC = useMemo(() => {
    if (!modalItem) return 0;
    const totalVal = modalItem.quantity * modalItem.cost + addQty * addCost;
    const totalQty = modalItem.quantity + addQty;
    return totalQty > 0 ? totalVal / totalQty : 0;
  }, [modalItem, addQty, addCost]);

  return (
    <div className="p-4 md:p-6 max-w-[95rem] mx-auto pb-32">
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-2">
        {['All', ...ALL_CATS].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border ${cat === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest items-center">
          <div className="col-span-1">Cat</div>
          <div className="col-span-5">Product Name</div>
          <div className="col-span-2">SKU</div>
          <div className="col-span-1">Key</div>
          <div className="col-span-3 text-right pr-2">Control (Cost / Qty / Action)</div>
        </div>

        {filtered.map((i) => (
          <div
            key={i.id}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2 border-b border-slate-50 hover:bg-slate-50/80 transition-colors items-center group"
          >
            {/* 1. Category */}
            <div className="md:col-span-1 flex justify-between md:block">
              <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                {i.category}
              </span>
              <span className="md:hidden font-black text-slate-700 text-sm">
                {i.quantity} <span className="text-[10px] font-normal text-slate-400">units</span>
              </span>
            </div>

            {/* 2. Name */}
            <div
              className="md:col-span-5 font-bold text-[13px] text-slate-700 truncate pr-4"
              title={i.name}
            >
              <InlineEdit
                value={i.name}
                onSave={(v) => quickUpdate(i, 'name', v)}
                className="hover:bg-white"
              />
            </div>

            {/* 3. SKU */}
            <div className="md:col-span-2 text-[10px] font-mono text-slate-400 truncate">
              <InlineEdit
                value={i.sku}
                onSave={(v) => quickUpdate(i, 'sku', v)}
                className="hover:text-slate-600"
              />
            </div>

            {/* 4. Keywords */}
            <div className="md:col-span-1 text-[10px] text-slate-300 truncate">
              <InlineEdit
                value={i.keyword}
                onSave={(v) => quickUpdate(i, 'keyword', v)}
                className="hover:text-blue-400 italic"
              />
            </div>

            {/* 5. Control Cluster */}
            <div className="hidden md:flex md:col-span-3 justify-end items-center gap-3">
              {/* Cost */}
              <div className="flex items-center gap-1 group/cost cursor-pointer">
                <span className="text-[10px] text-slate-300 font-bold group-hover/cost:text-emerald-400 transition-colors">
                  @
                </span>
                <div className="font-bold text-[12px] text-emerald-600 w-14 text-right">
                  <InlineEdit value={i.cost} onSave={(v) => quickUpdate(i, 'cost', v)} />
                </div>
              </div>

              <div className="w-px h-3 bg-slate-200"></div>

              {/* Qty Controls */}
              <div className="flex items-center bg-white border border-slate-200 rounded-md h-7 shadow-sm">
                <button
                  onClick={() => handleQuickMinus(i)}
                  className="w-6 h-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-l-md transition-all active:bg-red-100"
                >
                  <Minus size={10} strokeWidth={4} />
                </button>
                <div className="w-10 text-center font-black text-slate-700 text-xs border-x border-slate-50 h-full flex items-center justify-center bg-slate-50/50">
                  <InlineEdit
                    value={i.quantity}
                    onSave={(v) => quickUpdate(i, 'quantity', v)}
                    className="text-center bg-transparent"
                  />
                </div>
                <button
                  onClick={() => openAddModal(i)}
                  className="w-6 h-full flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-r-md transition-all active:bg-blue-100"
                >
                  <Plus size={10} strokeWidth={4} />
                </button>
              </div>

              {/* History & Delete */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => handleViewHistory(i)}
                  className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                  title="View Audit Log"
                >
                  <History size={14} />
                </button>
                <button
                  onClick={() => deleteItem(i)}
                  className="p-1.5 text-slate-200 hover:text-red-400 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Stock Modal */}
      {modalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800">Add Stock</h3>
              <button onClick={() => setModalItem(null)}>
                <X size={20} className="text-slate-300 hover:text-slate-600" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-5">
              <div className="font-bold text-slate-700 text-xs leading-tight text-center">
                {modalItem.name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block ml-1">
                  Qty Add
                </label>
                <input
                  type="number"
                  className="w-full bg-slate-100 p-2.5 rounded-lg font-black text-lg outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  value={addQty}
                  onChange={(e) => setAddQty(parseInt(e.target.value) || 0)}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block ml-1">
                  Unit Cost
                </label>
                <input
                  type="number"
                  className="w-full bg-slate-100 p-2.5 rounded-lg font-black text-lg outline-none focus:ring-2 focus:ring-emerald-500 text-center text-emerald-600"
                  value={addCost}
                  onChange={(e) => setAddCost(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
            <div className="mb-6 flex items-center justify-between px-2 text-xs">
              <div className="text-slate-400 font-medium">New Avg Cost:</div>
              <div className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {formatMoney(projectedWAC)}
              </div>
            </div>
            <button
              onClick={commitAdd}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Confirm Update
            </button>
          </div>
        </div>
      )}

      {/* History Modal (Phase 2 UI) */}
      {historyItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <History size={20} /> Audit Log
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {historyItem.sku || 'NO-SKU'}
                </p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {loadingLogs ? (
                <div className="text-center py-10 text-slate-400 text-xs animate-pulse">
                  Loading trace data...
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-300 text-xs font-bold uppercase border-2 border-dashed border-slate-100 rounded-xl">
                  No history found
                </div>
              ) : (
                historyLogs.map((log) => {
                  const isIn = log.type === 'IN';
                  const isOut = log.type === 'OUT';
                  return (
                    <div key={log.id} className="flex gap-4 group">
                      {/* Time Column */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 ${isIn ? 'bg-emerald-400' : isOut ? 'bg-red-400' : 'bg-blue-400'}`}
                        />
                        <div className="w-px h-full bg-slate-100 group-last:hidden my-1" />
                      </div>

                      {/* Card */}
                      <div className="flex-1 pb-4">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isIn ? 'bg-emerald-100 text-emerald-600' : isOut ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}
                              >
                                {log.type}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {new Date(log.date).toLocaleString()}
                              </span>
                            </div>
                            <div
                              className={`font-mono font-bold text-sm ${isIn ? 'text-emerald-600' : isOut ? 'text-red-500' : 'text-blue-500'}`}
                            >
                              {isIn ? '+' : ''}
                              {log.qtyChange}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-400 block mb-0.5">Unit Cost</span>
                              <span className="font-bold text-slate-700">
                                {formatMoney(Number(log.unitCost))}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block mb-0.5">Reference</span>
                              <span
                                className="font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-100 truncate inline-block max-w-[80px]"
                                title={log.refId}
                              >
                                {log.refId}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
