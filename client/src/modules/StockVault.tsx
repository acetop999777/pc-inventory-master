import React, { useState, useMemo } from 'react';
import { Plus, X, Trash2, Edit3, ArrowRight } from 'lucide-react';
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
    const [modalItem, setModalItem] = useState<InventoryItem | null>(null); 
    const [mode, setMode] = useState<'adj'|'edit'>('adj');
    const [adjQty, setAdjQty] = useState(1);
    const [adjCost, setAdjCost] = useState(0);
    const [confirmOut, setConfirmOut] = useState(false);
    const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
    
    const filtered = data.inv.filter(i => cat === 'All' || i.category === cat);
    
    const openAdjust = (item: InventoryItem) => { 
        setModalItem(item); 
        setMode('adj'); 
        setAdjQty(1); 
        setAdjCost(item.cost); 
        setConfirmOut(false); 
    };
    
    const openEdit = (item: InventoryItem) => { 
        setModalItem(item); 
        setMode('edit'); 
        setEditForm({ ...item }); 
    };
    
    const commitAdd = async () => { 
        if (!modalItem) return;
        const newQty = modalItem.quantity + adjQty; 
        const newCost = ((modalItem.quantity * modalItem.cost) + (adjQty * adjCost)) / newQty; 
        await apiCall('/inventory/batch', 'POST', [{ ...modalItem, quantity: newQty, cost: parseFloat(newCost.toFixed(2)) }]); 
        notify('Stock Added'); setModalItem(null); refresh(); 
    };
    
    const commitSub = async () => { 
        if (!modalItem) return;
        if (modalItem.quantity < adjQty) { notify('Insufficient Stock', 'error'); return; } 
        await apiCall('/inventory/batch', 'POST', [{ ...modalItem, quantity: modalItem.quantity - adjQty, cost: modalItem.cost }]); 
        log('STOCK_OUT', 'Stock Removed', `${modalItem.name} -${adjQty}`); 
        notify('Stock Removed'); setModalItem(null); refresh(); 
    };
    
    const saveEdit = async () => { 
        await apiCall('/inventory/batch', 'POST', [editForm]); 
        notify('Item Updated'); setModalItem(null); refresh(); 
    };
    
    const deleteItem = async () => { 
        if (modalItem && window.confirm(`Permanently delete ${editForm.name}?`)) { 
            await apiCall(`/inventory/${modalItem.id}`, 'DELETE'); 
            notify('Item Deleted'); setModalItem(null); refresh(); 
        } 
    };

    const projectedWAC = useMemo(() => {
        if (!modalItem || mode !== 'adj') return 0;
        const totalVal = (modalItem.quantity * modalItem.cost) + (adjQty * adjCost);
        const totalQty = modalItem.quantity + adjQty;
        return totalQty > 0 ? totalVal / totalQty : 0;
    }, [modalItem, adjQty, adjCost, mode]);

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar">{['All', ...ALL_CATS].map(c => <button key={c} onClick={()=>setCat(c)} className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${cat===c?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{c}</button>)}</div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="col-span-1">Cat</div><div className="col-span-5">Product (Click to Edit)</div><div className="col-span-2">SKU / Keyword</div><div className="col-span-2 text-right">Stock</div><div className="col-span-2 text-right">Actions</div></div>
                {filtered.map(i => (
                    <div key={i.id} className="grid grid-cols-12 gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 items-center transition-colors">
                        <div className="col-span-1"><InlineEdit className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold uppercase w-fit" value={i.category} onSave={(v) => apiCall('/inventory/batch', 'POST', [{...i, category:v}]).then(refresh)}/></div>
                        <div className="col-span-5"><InlineEdit className="font-bold text-sm text-slate-800 truncate block" value={i.name} onSave={(v) => apiCall('/inventory/batch', 'POST', [{...i, name:v}]).then(refresh)}/></div>
                        <div className="col-span-2"><InlineEdit className="text-xs font-mono text-slate-400 truncate block" value={i.sku || i.keyword} confirm={true} onSave={(v) => apiCall('/inventory/batch', 'POST', [{...i, sku:v, keyword:v}]).then(refresh)}/></div>
                        <div className="col-span-2 text-right"><div className="font-black text-sm">{i.quantity}</div><div className="text-[10px] text-slate-400">@ {formatMoney(i.cost)}</div></div>
                        <div className="col-span-2 flex justify-end gap-2"><button onClick={()=>openEdit(i)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={16}/></button><button onClick={()=>openAdjust(i)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"><Plus size={16}/></button></div>
                    </div>
                ))}
            </div>
            {modalItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-slate-800">{mode==='adj' ? (confirmOut ? 'Confirm Stock Out' : 'Adjust Stock') : 'Edit Item'}</h3><button onClick={()=>setModalItem(null)}><X size={20} className="text-slate-400"/></button></div>
                        {mode === 'edit' ? (
                            <div className="space-y-4">
                                <div><label className="l">Product Name</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})}/></div>
                                <div><label className="l">SKU / UPC</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all" value={editForm.sku} onChange={e=>setEditForm({...editForm, sku:e.target.value})}/></div>
                                <div><label className="l">Keyword</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all" value={editForm.keyword||''} onChange={e=>setEditForm({...editForm, keyword:e.target.value})}/></div>
                                <div className="flex gap-3 pt-4"><button onClick={deleteItem} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"><Trash2 size={20}/></button><button onClick={saveEdit} className="flex-1 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs hover:bg-slate-800 transition-colors">Save Changes</button></div>
                            </div>
                        ) : (
                            <div>
                                <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100"><div className="text-xs text-slate-500 font-bold uppercase mb-1">Product</div><div className="font-bold text-slate-800">{modalItem.name}</div></div>
                                {!confirmOut ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 mb-6"><div><label className="l">Add Qty</label><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 outline-none focus:bg-white focus:border-blue-400 transition-all" value={adjQty} onChange={e=>setAdjQty(parseInt(e.target.value)||0)}/></div><div><label className="l">Unit Cost ($)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 outline-none focus:bg-white focus:border-blue-400 transition-all" value={adjCost} onChange={e=>setAdjCost(parseFloat(e.target.value)||0)}/></div></div>
                                        <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs text-blue-400 font-bold uppercase tracking-widest"><span>Current</span><ArrowRight size={12}/><span>After Add</span></div>
                                            <div className="flex justify-between items-center"><div><div className="text-lg font-black text-slate-400">{modalItem.quantity} units</div><div className="text-xs font-bold text-slate-400">@ {formatMoney(modalItem.cost)}</div></div><div className="text-right"><div className="text-xl font-black text-blue-600">{modalItem.quantity + adjQty} units</div><div className="text-xs font-bold text-blue-600">@ {formatMoney(projectedWAC)} (Avg)</div></div></div>
                                        </div>
                                        <div className="flex gap-3"><button onClick={()=>setConfirmOut(true)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-2xl font-bold text-sm uppercase">Stock Out</button><button onClick={commitAdd} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-sm uppercase shadow-lg">Add Stock</button></div>
                                    </>
                                ) : (
                                    <div className="space-y-4"><div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center"><div className="text-xs font-bold text-red-400 uppercase mb-2">Removing</div><div className="text-3xl font-black text-red-600">-{adjQty} Units</div></div><button onClick={commitSub} className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-sm uppercase shadow-lg">Confirm</button><button onClick={()=>setConfirmOut(false)} className="w-full py-3 text-slate-400 font-bold text-xs uppercase">Back</button></div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}