import React, { useState } from 'react';
import { Search, Plus, MapPin, Tag } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { formatMoney } from '../../../utils';

interface Props {
    inventory: InventoryItem[];
}

export default function InventoryHub({ inventory }: Props) {
    const [search, setSearch] = useState('');
    const filtered = inventory.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="flex gap-4 mb-6 items-center">
                 <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                    <Search size={16} className="ml-2 text-slate-400"/>
                    <input className="w-full text-xs font-bold outline-none" placeholder="Search Inventory..." value={search} onChange={e=>setSearch(e.target.value)}/>
                 </div>
                 <button className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95"><Plus size={16}/></button>
             </div>

            <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-6">Component</div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-2 text-center">Stock</div>
                    <div className="col-span-2 text-right">Cost</div>
                </div>
                {filtered.map(item => (
                    <div key={item.id} className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-50 hover:bg-slate-50 items-center text-sm group cursor-pointer transition-colors">
                        <div className="col-span-6 font-bold text-slate-700 group-hover:text-blue-600 truncate">{item.name}</div>
                        <div className="col-span-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{item.category}</span>
                        </div>
                        <div className="col-span-2 text-center">
                            <span className={`font-mono font-bold ${item.quantity > 0 ? 'text-slate-600' : 'text-red-400'}`}>{item.quantity}</span>
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-400">{formatMoney(item.cost)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
