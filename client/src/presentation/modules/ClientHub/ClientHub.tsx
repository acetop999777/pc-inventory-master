import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { ClientRow } from './components/ClientRow';
import { ClientEntity } from '../../../domain/client/client.types';

interface Props {
    clients: ClientEntity[];
    onSelectClient: (client: ClientEntity) => void;
    onNewClient: () => void;
    onDeleteClient: (id: string, name: string) => void;
}

export default function ClientHub({ clients, onSelectClient, onNewClient, onDeleteClient }: Props) {
    const [search, setSearch] = useState('');
    
    const filtered = clients.filter(c => 
        (c.wechatName || '').toLowerCase().includes(search.toLowerCase()) || 
        (c.wechatId || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 max-w-[95rem] mx-auto pb-32">
             <div className="flex gap-4 mb-6 items-center">
                 <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                    <Search size={16} className="ml-2 text-slate-400"/>
                    <input className="w-full text-xs font-bold outline-none" placeholder="Search Clients..." value={search} onChange={e=>setSearch(e.target.value)}/>
                 </div>
                 <button onClick={onNewClient} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-transform"><Plus size={16}/></button>
             </div>
             
             <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                 <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center">
                     <div className="col-span-3">Client (WeChat)</div>
                     <div className="col-span-2">Status</div>
                     <div className="col-span-2">Order Date</div>
                     <div className="col-span-2">Delivery Date</div>
                     <div className="col-span-3 text-right">Financials</div>
                 </div>

                 {filtered.map(c => (
                     <ClientRow key={c.id} client={c} onSelect={() => onSelectClient(c)} onDelete={(e) => { e.stopPropagation(); onDeleteClient(c.id, c.wechatName); }}/>
                 ))}
                 
                 {filtered.length === 0 && <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase italic">No clients found</div>}
             </div>
        </div>
    );
}
