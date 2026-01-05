import React, { useState, useMemo } from 'react';
import { Plus, Minus, X, Trash2, ArrowRight } from 'lucide-react';
import { InlineEdit } from '../components/Shared';
import { ALL_CATS, formatMoney, apiCall } from '../utils';
import { AppData, InventoryItem } from '../types';

interface Props {
    data: AppData;
    refresh: () => void;
    notify: (msg: string, type?: string) => void;
    log: (type: string, title: string, msg: string) => void;
}

export default function StockVault({ data, refresh, notify, log }: Props) {
    const [cat, setCat] = useState('All');
    
    // Modal State
    const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
    const [addQty, setAddQty] = useState(1);
    const [addCost, setAddCost] = useState(0);

    // 逻辑回归纯粹：直接匹配，无需转换
    const filtered = data.inv.filter(i => cat === 'All' || i.category === cat);

    const quickUpdate = async (item: InventoryItem, field: keyof InventoryItem, val: string) => {
        let parsedVal: string | number = val;
        if (field === 'quantity') parsedVal = parseInt(val) || 0;
        if (field === 'cost') parsedVal = parseFloat(val) || 0;
        // 如果改的是类目，用户输入什么就是什么，也可以在这里强行大写
        if (field === 'category') parsedVal = val.toUpperCase(); 

        await apiCall('/inventory/batch', 'POST', [{ ...item, [field]: parsedVal }]);
        refresh();
        notify(`${field.toUpperCase()} Updated`);
    };

    const handleQuickMinus = async (item: InventoryItem) => {
        if (item.quantity <= 0) return;
        if (window.confirm(`Decrease stock of ${item.name} by 1?`)) {
            const newQty = item.quantity - 1;
            await apiCall('/inventory/batch', 'POST', [{ ...item, quantity: newQty }]);
            log('STOCK_OUT', 'Manual Decrease', `${item.name} -1`);
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
        const newCost = ((modalItem.quantity * modalItem.cost) + (addQty * addCost)) / newQty;
        await apiCall('/inventory/batch', 'POST', [{ ...modalItem, quantity: newQty, cost: parseFloat(newCost.toFixed(2)) }]);
        notify(`Stock Added (+${addQty})`); setModalItem(null); refresh();
    };

    const deleteItem = async (item: InventoryItem) => {
        if (window.confirm(`Permanently delete ${item.name}?`)) {
            await apiCall(`/inventory/${item.id}`, 'DELETE');
            notify('Item Deleted'); refresh();
        }
    };

    const projectedWAC = useMemo(() => {
        if (!modalItem) return 0;
        const totalVal = (modalItem.quantity * modalItem.cost) + (addQty * addCost);
        const totalQty = modalItem.quantity + addQty;
        return totalQty > 0 ? totalVal / totalQty : 0;
    }, [modalItem, addQty, addCost]);

    return (
        <div className="p-4 md:p-6 max-w-[95rem] mx-auto pb-32">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-2">
                {['All', ...ALL_CATS].map(c => (
                    <button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border ${cat===c?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{c}</button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header - Ultra Compact */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest items-center">
                    <div className="col-span-1">Cat</div>
                    <div className="col-span-5">Product Name</div>
                    <div className="col-span-2">SKU</div>
                    <div className="col-span-1">Key</div>
                    <div className="col-span-3 text-right pr-2">Control (Cost / Qty / Action)</div>
                </div>

                {filtered.map(i => (
                    <div key={i.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2 border-b border-slate-50 hover:bg-slate-50/80 transition-colors items-center group">
                        
                        {/* 1. Category */}
                        <div className="md:col-span-1 flex justify-between md:block">
                            <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">{i.category}</span>
                            <span className="md:hidden font-black text-slate-700 text-sm">{i.quantity} <span className="text-[10px] font-normal text-slate-400">units</span></span>
                        </div>
                        
                        {/* 2. Name */}
                        <div className="md:col-span-5 font-bold text-[13px] text-slate-700 truncate pr-4 cursor-pointer hover:text-blue-600 transition-colors" title={i.name}>
                            <InlineEdit value={i.name} onSave={(v)=>quickUpdate(i, 'name', v)} className="hover:bg-white" />
                        </div>

                        {/* 3. SKU */}
                        <div className="md:col-span-2 text-[10px] font-mono text-slate-400 truncate">
                            <div className="md:hidden text-[9px] font-bold text-slate-300 uppercase mt-1 inline-block mr-2">SKU</div>
                            <InlineEdit value={i.sku} onSave={(v)=>quickUpdate(i, 'sku', v)} className="hover:text-slate-600" />
                        </div>

                        {/* 4. Keywords */}
                        <div className="md:col-span-1 text-[10px] text-slate-300 truncate">
                            <div className="md:hidden text-[9px] font-bold text-slate-300 uppercase mt-1 inline-block mr-2">Key</div>
                            <InlineEdit value={i.keyword} onSave={(v)=>quickUpdate(i, 'keyword', v)} className="hover:text-blue-400 italic" />
                        </div>

                        {/* 5. The "Control Cluster" */}
                        <div className="hidden md:flex md:col-span-3 justify-end items-center gap-3">
                            
                            {/* Cost Edit */}
                            <div className="flex items-center gap-1 group/cost cursor-pointer">
                                <span className="text-[10px] text-slate-300 font-bold group-hover/cost:text-emerald-400 transition-colors">@</span>
                                <div className="font-bold text-[12px] text-emerald-600 w-14 text-right">
                                    <InlineEdit value={i.cost} onSave={(v)=>quickUpdate(i, 'cost', v)} />
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="w-px h-3 bg-slate-200"></div>

                            {/* Qty Controls */}
                            <div className="flex items-center bg-white border border-slate-200 rounded-md h-7 shadow-sm">
                                <button onClick={()=>handleQuickMinus(i)} className="w-6 h-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-l-md transition-all active:bg-red-100">
                                    <Minus size={10} strokeWidth={4}/>
                                </button>
                                <div className="w-10 text-center font-black text-slate-700 text-xs border-x border-slate-50 h-full flex items-center justify-center bg-slate-50/50">
                                    <InlineEdit value={i.quantity} onSave={(v)=>quickUpdate(i, 'quantity', v)} className="text-center bg-transparent" />
                                </div>
                                <button onClick={()=>openAddModal(i)} className="w-6 h-full flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-r-md transition-all active:bg-blue-100">
                                    <Plus size={10} strokeWidth={4}/>
                                </button>
                            </div>

                            {/* Delete (Subtle) */}
                            <button onClick={()=>deleteItem(i)} className="p-1.5 text-slate-200 hover:text-red-400 transition-colors ml-1">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {modalItem && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-800">Add Stock</h3>
                            <button onClick={()=>setModalItem(null)}><X size={20} className="text-slate-300 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-5">
                            <div className="font-bold text-slate-700 text-xs leading-tight text-center">{modalItem.name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Qty Add</label>
                                <input type="number" className="w-full bg-slate-100 p-2.5 rounded-lg font-black text-lg outline-none focus:ring-2 focus:ring-blue-500 text-center" value={addQty} onChange={e=>setAddQty(parseInt(e.target.value)||0)} autoFocus onFocus={e=>e.target.select()}/>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Unit Cost</label>
                                <input type="number" className="w-full bg-slate-100 p-2.5 rounded-lg font-black text-lg outline-none focus:ring-2 focus:ring-emerald-500 text-center text-emerald-600" value={addCost} onChange={e=>setAddCost(parseFloat(e.target.value)||0)} onFocus={e=>e.target.select()}/>
                            </div>
                        </div>
                        <div className="mb-6 flex items-center justify-between px-2 text-xs">
                            <div className="text-slate-400 font-medium">New Avg Cost:</div>
                            <div className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">{formatMoney(projectedWAC)}</div>
                        </div>
                        <button onClick={commitAdd} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Confirm Update</button>
                    </div>
                </div>
            )}
        </div>
    );
}