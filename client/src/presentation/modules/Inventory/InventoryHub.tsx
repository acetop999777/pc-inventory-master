import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Search, Trash2 } from 'lucide-react';
import { ALL_CATS, apiCall } from '../../../utils';
import { AppData, InventoryItem } from '../../../types';

interface Props {
    inventory?: InventoryItem[];
    data?: any;
    refresh?: (() => void) | (() => Promise<void>);
    notify?: (...args: any[]) => void;
}

const InlineEditor = ({ value, onSave, type = "text" }: { value: any, onSave: (v: any) => void, type?: string }) => {
    const [editing, setEditing] = useState(false);
    const [tempVal, setTempVal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTempVal(value); }, [value]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    const handleBlur = () => {
        setEditing(false);
        if (tempVal !== value) onSave(type === 'number' ? Number(tempVal) : tempVal);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={type}
                className="w-full bg-blue-50 border border-blue-300 rounded px-1 text-slate-900 outline-none font-bold"
                value={tempVal}
                onChange={e => setTempVal(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={e => e.key === 'Enter' && handleBlur()}
                onClick={e => e.stopPropagation()}
            />
        );
    }

    return (
        <div onClick={() => setEditing(true)} className="cursor-pointer hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200 rounded px-1 transition-all min-h-[1.2rem]">
            {type === 'number' ? value : (value || <span className="text-slate-300 italic">Empty</span>)}
        </div>
    );
};


  // --- Optimistic save ---
  const handleFieldChange = async (itemId: string, field: string, value: any) => {
    setInventory(prev =>
      prev.map(it => it.id === itemId ? { ...it, [field]: value } : it)
    );
    try {
      await apiCall(`/inventory/${itemId}`, 'PUT', { [field]: value });
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  // --- Optimistic delete ---
  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Delete this item?')) return;
    const prev = inventory;
    setInventory(prev => prev.filter(it => it.id !== itemId));
    try {
      await apiCall(`/inventory/${itemId}`, 'DELETE');
    } catch (err) {
      alert('Delete failed');
      setInventory(prev); // rollback
    }
  };

export default function InventoryHub(props: Props) {
    
    const inventory: InventoryItem[] =
        props.inventory ??
        (Array.isArray(props.data) ? props.data : (props.inventory ?? []));

    const refresh = props.refresh ?? (async () => {});
    const notify = props.notify ?? (() => {});

const [search, setSearch] = useState('');

    const updateItem = async (item: InventoryItem, fields: Partial<InventoryItem>) => {
        try {
            await apiCall(`/inventory/${item.id}`, 'PUT', fields);
            
            notify("Inventory Updated");
        } catch (e) {
            notify("Update failed", "error");
        }
    };

    const filtered = inventory.filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase()) || 
        i.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto pb-40">
            <div className="flex gap-4 mb-6 items-center">
                <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
                    <Search size={16} className="ml-2 text-slate-400" />
                    <input className="w-full text-xs font-bold outline-none" placeholder="Search components..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-5">Component Name</div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-2 text-center">Stock Control</div>
                    <div className="col-span-2 text-right">Avg. Cost</div>
                    <div className="col-span-1"></div>
                </div>

                {filtered.map(i => (
                    <div key={i.id} className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-50 hover:bg-slate-50 items-center text-sm">
                        <div className="col-span-5 font-bold text-slate-700 truncate">
                            <InlineEditor value={i.name} onSave={v => updateItem(i, { name: v })} />
                        </div>
                        <div className="col-span-2">
                            <select className="bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase px-2 py-1 outline-none" value={i.category} onChange={e => updateItem(i, { category: e.target.value })}>
                                {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-3">
                            <button onClick={() => updateItem(i, { quantity: Math.max(0, i.quantity - 1) })} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500"><Minus size={12} strokeWidth={3} /></button>
                            <span className="font-mono font-bold w-12 text-center text-slate-700"><InlineEditor type="number" value={i.quantity} onSave={v => updateItem(i, { quantity: v })} /></span>
                            <button onClick={() => updateItem(i, { quantity: i.quantity + 1 })} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"><Plus size={12} strokeWidth={3} /></button>
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-600 font-bold">
                            <div className="flex justify-end items-center gap-1"><span>$</span><InlineEditor type="number" value={i.cost} onSave={v => updateItem(i, { cost: v })} /></div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                            <button onClick={async () => { if(window.confirm('Delete?')) { await apiCall(`/inventory/${i.id}`, 'DELETE');  } }} className="text-slate-200 hover:text-red-400"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
