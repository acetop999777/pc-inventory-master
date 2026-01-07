import React, { useState } from 'react';
import { Search, Plus, Calendar, Truck, Star } from 'lucide-react';
import { generateId, CORE_CATS, STATUS_STEPS, formatMoney, apiCall } from '../utils';
import { AppData, Client } from '../types';
import ClientEditor from './ClientEditor';

interface Props {
    data: AppData;
    refresh: () => void;
    notify: (msg: string, type?: string) => void;
    log: (type: string, title: string, msg: string) => void;
}

export default function ClientHub({ data, refresh, notify, log }: Props) {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [active, setActive] = useState<Client | null>(null);
    const [search, setSearch] = useState('');

    const filtered = (data.clients || []).filter(c => JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));
    
    // 创建新客户 (默认 Rating 为 0)
    const handleNew = () => {
        const initSpecs: any = {};
        CORE_CATS.forEach(c => { initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 }; });
        
        // 修复点：补全缺失的 city, zip, state, address 字段
        const newClient: Client = { 
            id: generateId(), wechatName: 'New Client', isShipping: false, specs: initSpecs, status: STATUS_STEPS[0], 
            orderDate: new Date().toISOString().split('T')[0], depositDate: '', deliveryDate: '',
            realName: '', wechatId: '', xhsId: '', xhsName: '', pcppLink: '', trackingNumber: '',
            
            // --- 这里是之前缺少的字段 ---
            city: '', zip: '', state: '', address: '',
            // -------------------------

            totalPrice: 0, actualCost: 0, profit: 0, photos: [], 
            rating: 0, 
            notes: ''
        };
        setActive(newClient);
        setView('detail');
    };

    // --- 核心修改：保存逻辑 ---
    // 移除 setView('list')，实现"原地静默保存"
    const handleSave = async (finalClient: Client, cost: number, profit: number) => {
        await apiCall('/clients', 'POST', { ...finalClient, actualCost: cost, profit: profit });
        
        // notify('Profile Saved'); // 注释掉，因为 Editor 内部已有 Saving.../Saved 状态指示，避免重复打扰
        
        refresh(); // 刷新后台数据，但不跳转页面
    };

    // 如果是详情模式，直接渲染编辑器组件
    if(view === 'detail' && active) {
        return (
            <ClientEditor 
                client={active} 
                inventory={data.inv}
                onUpdate={setActive} 
                onSave={handleSave} 
                onBack={() => setView('list')} // 只有点击返回按钮时，才回到列表
                notify={notify}
            />
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="p-4 md:p-8 max-w-[95rem] mx-auto pb-32">
             <div className="flex gap-4 mb-6 items-center">
                 <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2"><Search size={16} className="ml-2 text-slate-400"/><input className="w-full text-xs font-bold outline-none" placeholder="Search Clients..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
                 <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95"><Plus size={16}/></button>
             </div>
             
             <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                 <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center">
                     <div className="col-span-3">Client (WeChat)</div>
                     <div className="col-span-2">Status</div>
                     <div className="col-span-2">Order Date</div>
                     <div className="col-span-2">Delivery Date</div>
                     <div className="col-span-3 text-right">Financials (Rev / Profit)</div>
                 </div>

                 {filtered.map(c => {
                     const isDelivered = c.status === 'Delivered';
                     const isPaid = c.status === 'Deposit Paid';
                     const statusColor = isDelivered ? 'bg-emerald-100 text-emerald-700' : (isPaid ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600');

                     return (
                        <div key={c.id} onClick={()=>{setActive(c); setView('detail');}} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-6 py-3 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors items-center group">
                            
                            {/* 1. Client Name + Indicators */}
                            <div className="md:col-span-3">
                                <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                    {c.wechatName}
                                    {c.rating === 1 && <Star size={10} className="text-yellow-400 fill-yellow-400"/>}
                                    {c.rating === -1 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" title="Attention" />}
                                </div>
                                <div className="md:hidden text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded ${statusColor}`}>{c.status}</span>
                                    <span className="font-mono text-emerald-600 font-bold">{formatMoney(c.profit)}</span>
                                </div>
                            </div>
                            
                            {/* 2. Status */}
                            <div className="hidden md:block md:col-span-2"><span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${statusColor}`}>{c.status}</span></div>
                            
                            {/* 3. Order Date */}
                            <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400"><Calendar size={12} className="text-slate-300"/>{c.orderDate ? c.orderDate.split('T')[0] : <span className="text-slate-200">-</span>}</div>
                            
                            {/* 4. Delivery Date */}
                            <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400"><Truck size={12} className="text-slate-300"/>{c.deliveryDate ? c.deliveryDate.split('T')[0] : <span className="text-slate-200">-</span>}</div>
                            
                            {/* 5. Financials */}
                            <div className="hidden md:block md:col-span-3 text-right">
                                <div className="flex items-center justify-end gap-3"><div className="text-[11px] font-bold text-slate-400">{formatMoney(c.totalPrice)}</div><div className="w-px h-3 bg-slate-200"></div><div className="font-black text-sm text-emerald-600">{formatMoney(c.profit)}</div></div>
                            </div>
                        </div>
                     );
                 })}
                 {filtered.length === 0 && <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase italic">No clients found</div>}
             </div>
        </div>
    );
}