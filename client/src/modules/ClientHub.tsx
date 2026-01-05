import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Calendar, Link as LinkIcon, User, ChevronLeft, Truck, Star, Camera, X, DollarSign, Cpu, ChevronDown } from 'lucide-react';
import { generateId, CORE_CATS, ALL_CATS, STATUS_STEPS, formatMoney, apiCall, compressImage, findBestMatch } from '../utils';
import { AppData, Client, InventoryItem } from '../types';

interface Props {
    data: AppData;
    refresh: () => void;
    notify: (msg: string, type?: string) => void;
    log: (type: string, title: string, msg: string) => void;
}

const INPUT_STYLE = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300";
const LABEL_STYLE = "text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1";

export default function ClientHub({ data, refresh, notify, log }: Props) {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [active, setActive] = useState<Client | null>(null);
    const [search, setSearch] = useState('');
    const [activeDrop, setActiveDrop] = useState<string | null>(null); 
    const [viewPhoto, setViewPhoto] = useState<string | null>(null); 
    const fileRef = useRef<HTMLInputElement>(null);

    const financialData = useMemo(() => {
        if (!active) return { cost: 0, profit: 0 };
        let totalCost = 0;
        Object.values(active.specs || {}).forEach(item => { totalCost += (Number(item.cost) || 0); });
        const salePrice = Number(active.totalPrice) || 0;
        return { cost: totalCost, profit: salePrice - totalCost };
    }, [active]);

    const filtered = (data.clients || []).filter(c => JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));
    
    const handleNew = () => {
        const initSpecs: any = {};
        CORE_CATS.forEach(c => { initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 }; });
        const newClient: Client = { 
            id: generateId(), wechatName: 'New Client', isShipping: false, specs: initSpecs, status: STATUS_STEPS[0], 
            orderDate: new Date().toISOString().split('T')[0], depositDate: '', deliveryDate: '',
            realName: '', wechatId: '', xhsId: '', xhsName: '', pcppLink: '', trackingNumber: '',
            totalPrice: 0, actualCost: 0, profit: 0, photos: [], rating: 2, notes: ''
        };
        setActive(newClient);
        setView('detail');
    };

    const save = async () => {
        if (!active) return;
        const { cost, profit } = financialData;
        await apiCall('/clients', 'POST', { ...active, actualCost: cost, profit: profit });
        notify('Profile Saved'); refresh(); setView('list');
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && active) {
            const newPhotos: string[] = [];
            for (let i = 0; i < e.target.files.length; i++) {
                const base64 = await compressImage(e.target.files[i]);
                newPhotos.push(base64);
            }
            setActive(prev => prev ? ({ ...prev, photos: [...(prev.photos || []), ...newPhotos] }) : null);
        }
    };

    const removePhoto = (index: number) => {
        setActive(prev => prev ? ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }) : null);
    };

    const parsePCPP = (text: string) => {
        if(!text || !active) return;
        const lines = text.split('\n');
        const newSpecs = { ...active.specs };
        let link = '';
        lines.forEach(l => {
            if(l.includes('pcpartpicker.com/list/')) link = l.match(/(https?:\/\/\S+)/)?.[0] || '';
            const splitIdx = l.indexOf(': ');
            if(splitIdx > -1) {
                const catRaw = l.substring(0, splitIdx).trim();
                const rest = l.substring(splitIdx + 2).trim();
                const cat = ALL_CATS.find(c => c.toLowerCase() === catRaw.toLowerCase()) || (catRaw==='Video Card'?'Video Card':null);
                if(cat) {
                    const rawName = rest.split('($')[0].trim();
                    const dbItem = findBestMatch(rawName, data.inv);
                    newSpecs[cat] = { 
                        name: dbItem ? dbItem.name : rawName, 
                        sku: dbItem?.sku || '', 
                        cost: dbItem?.cost || 0, 
                        qty: 1 
                    };
                }
            }
        });
        setActive(p => p ? ({ ...p, specs: newSpecs, pcppLink: link || p.pcppLink }) : null);
        notify('PCPP Parsed');
    };

    const displayCats = useMemo(() => {
        if(!active || !active.specs) return [];
        return ALL_CATS.filter(c => CORE_CATS.includes(c) || (active.specs[c] && active.specs[c].name));
    }, [active]);

    const selectInventoryItem = (cat: string, item: InventoryItem) => {
        setActive(p => p ? ({ 
            ...p, 
            specs: { 
                ...p.specs, 
                [cat]: { 
                    ...p.specs[cat], 
                    name: item.name, 
                    sku: item.sku || '', 
                    cost: item.cost 
                } 
            } 
        }) : null);
        setActiveDrop(null);
    };

    // Helper for safe updates to avoid TS partial type errors in lambdas
    const updateActive = (field: keyof Client, val: any) => {
        setActive(prev => prev ? { ...prev, [field]: val } : null);
    };

    const updateSpec = (cat: string, field: 'name' | 'sku' | 'cost', val: any) => {
        setActive(prev => {
            if (!prev) return null;
            const currentSpec = prev.specs[cat] || { name: '', sku: '', cost: 0, qty: 1 };
            return {
                ...prev,
                specs: {
                    ...prev.specs,
                    [cat]: { ...currentSpec, [field]: val }
                }
            };
        });
    };

    if(view === 'detail' && active) {
        return (
            <div className="p-8 max-w-7xl mx-auto pb-32 animate-in slide-in-from-right" onClick={() => setActiveDrop(null)}>
                <div className="flex justify-between items-center mb-6">
                    <button onClick={()=>setView('list')} className="text-slate-400 font-bold text-xs flex items-center gap-1 hover:text-slate-600"><ChevronLeft size={16}/> BACK TO HUB</button>
                    <div className="flex gap-3">
                        {active.pcppLink && <a href={active.pcppLink} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-100 transition-colors"><LinkIcon size={14}/> PCPartPicker</a>}
                        {active.trackingNumber && <a href={`https://www.ups.com/track?tracknum=${active.trackingNumber}`} target="_blank" rel="noreferrer" className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-100 transition-colors"><Truck size={14}/> Track Package</a>}
                        <button onClick={save} className="bg-slate-900 text-white px-8 py-2 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-slate-800 transition-colors">Save Profile</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="mb-6">
                                <input className="text-2xl font-black text-slate-800 bg-transparent outline-none w-full placeholder:text-slate-300 mb-2" placeholder="Client Name" value={active.wechatName} onChange={e=>updateActive('wechatName', e.target.value)}/>
                                <div className="flex gap-1 mb-4">{[1,2,3].map(s => (<button key={s} onClick={()=>updateActive('rating', s)} className={`transition-all ${s <= active.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}><Star size={16} fill="currentColor"/></button>))}</div>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group" onClick={()=>fileRef.current?.click()}>
                                        <Camera size={24} className="text-slate-300 group-hover:text-slate-400"/><input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={handlePhoto}/>
                                    </div>
                                    {active.photos && active.photos.map((p, idx) => (
                                        <div key={idx} className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 relative group border border-slate-100">
                                            <img src={p} alt="" className="w-full h-full object-cover cursor-pointer" onClick={()=>setViewPhoto(p)}/>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1 cursor-pointer" onClick={(e)=>{e.stopPropagation(); removePhoto(idx);}}><X size={10} className="text-white"/></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>WeChat ID</label><input className={INPUT_STYLE} value={active.wechatId||''} onChange={e=>updateActive('wechatId', e.target.value)}/></div><div><label className={LABEL_STYLE}>Real Name</label><input className={INPUT_STYLE} value={active.realName||''} onChange={e=>updateActive('realName', e.target.value)}/></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>XHS Name</label><input className={INPUT_STYLE} value={active.xhsName||''} onChange={e=>updateActive('xhsName', e.target.value)}/></div><div><label className={LABEL_STYLE}>XHS ID</label><input className={INPUT_STYLE} value={active.xhsId||''} onChange={e=>updateActive('xhsId', e.target.value)}/></div></div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                            <h3 className="font-black uppercase text-xs mb-6 text-slate-400 tracking-widest flex items-center gap-2"><Calendar size={14}/> Workflow Status</h3>
                            <div className="flex justify-between items-center relative mb-8 px-2">
                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10"/>
                                {STATUS_STEPS.map((s, i) => {
                                    const currentIdx = STATUS_STEPS.indexOf(active.status);
                                    const isCompleted = i <= currentIdx;
                                    return (
                                        <div key={s} onClick={()=>updateActive('status', s)} className="group flex flex-col items-center gap-2 cursor-pointer">
                                            <div className={`w-4 h-4 rounded-full border-2 transition-all ${isCompleted ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-300'}`}/>
                                            <span className={`text-[8px] font-bold uppercase transition-colors ${active.status===s ? 'text-blue-600' : 'text-slate-300'}`}>{s.split(' ')[0]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>Deposit Date</label><input type="date" className={INPUT_STYLE} value={active.depositDate?.split('T')[0]||''} onChange={e=>updateActive('depositDate', e.target.value)}/></div><div><label className={LABEL_STYLE}>Delivery Date</label><input type="date" className={INPUT_STYLE} value={active.deliveryDate?.split('T')[0]||''} onChange={e=>updateActive('deliveryDate', e.target.value)}/></div></div>
                                <div className="pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={()=>updateActive('isShipping', !active.isShipping)}><div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${active.isShipping?'bg-blue-600':'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${active.isShipping?'translate-x-4':''}`}/></div><span className="text-[10px] font-bold uppercase text-slate-500">Shipping Required</span></div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3"><div><label className={LABEL_STYLE}>City</label><input className={INPUT_STYLE} value={active.city||''} onChange={e=>updateActive('city', e.target.value)}/></div><div><label className={LABEL_STYLE}>Zip Code</label><input className={INPUT_STYLE} value={active.zip||''} onChange={e=>updateActive('zip', e.target.value)}/></div></div>
                                        {active.isShipping && (<div className="space-y-3 animate-in fade-in"><div><label className={LABEL_STYLE}>Street Address</label><input className={INPUT_STYLE} value={active.address||''} onChange={e=>updateActive('address', e.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div><label className={LABEL_STYLE}>State</label><input className={INPUT_STYLE} value={active.state||''} onChange={e=>updateActive('state', e.target.value)}/></div><div><label className={LABEL_STYLE}>Tracking</label><input className={INPUT_STYLE} value={active.trackingNumber||''} onChange={e=>updateActive('trackingNumber', e.target.value)}/></div></div></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100"><label className={LABEL_STYLE}>Internal Notes</label><textarea className={`${INPUT_STYLE} h-24 resize-none`} placeholder="e.g. No RGB, White Cables..." value={active.notes||''} onChange={e=>updateActive('notes', e.target.value)}/></div>
                    </div>

                    <div className="xl:col-span-2 space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"><label className={LABEL_STYLE}><span className="flex items-center gap-1"><DollarSign size={12}/> Total Sale Price</span></label><input className="text-2xl font-black text-slate-800 bg-transparent outline-none w-full placeholder:text-slate-200" placeholder="0.00" value={active.totalPrice||''} onChange={e=>updateActive('totalPrice', parseFloat(e.target.value))}/></div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between"><label className={LABEL_STYLE}>Total Cost (Auto)</label><div className="text-2xl font-black text-slate-500">{formatMoney(financialData.cost)}</div></div>
                            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${financialData.profit >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}><label className={`text-[10px] font-extrabold uppercase tracking-widest mb-1.5 block ml-1 ${financialData.profit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>Net Profit</label><div className={`text-2xl font-black ${financialData.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatMoney(financialData.profit)}</div></div>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><Cpu size={20}/></div><h3 className="font-black text-sm text-slate-800">Build Configuration</h3></div></div>
                            <div className="bg-slate-50 rounded-xl p-4 mb-6"><textarea className="w-full h-20 bg-transparent text-xs font-mono outline-none resize-none placeholder:text-slate-400" placeholder="Paste PCPartPicker list here to auto-fill..." onChange={e=>parsePCPP(e.target.value)}/></div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-4 px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="col-span-2">Type</div><div className="col-span-6">Model</div><div className="col-span-2">SKU</div><div className="col-span-2 text-right">Cost</div></div>
                                {displayCats.map(cat => {
                                    const item = active.specs[cat] || { name: '', sku: '', cost: 0 };
                                    const dropdownOpen = activeDrop === cat;
                                    const suggestions = dropdownOpen ? data.inv.filter(invItem => { if(cat !== 'Custom' && invItem.category !== cat && invItem.category !== 'Other') return false; if(!item.name) return true; return invItem.name.toLowerCase().includes(item.name.toLowerCase()) || (invItem.keyword && invItem.keyword.toLowerCase().includes(item.name.toLowerCase())); }).slice(0, 5) : [];
                                    return (
                                        <div key={cat} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors px-4 -mx-4 relative">
                                            <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">{cat}</div>
                                            <div className="col-span-6 relative">
                                                <div className="flex items-center"><input className="w-full text-sm font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.name||''} onChange={e=>updateSpec(cat, 'name', e.target.value)} onFocus={() => setActiveDrop(cat)} onClick={(e) => { e.stopPropagation(); setActiveDrop(cat); }} /><button onClick={(e)=>{e.stopPropagation(); setActiveDrop(dropdownOpen ? null : cat)}} className="text-slate-300 hover:text-slate-500"><ChevronDown size={14}/></button></div>
                                                {dropdownOpen && (<div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl border border-slate-100 z-50 mt-2 p-1 animate-in fade-in zoom-in-95">{suggestions.length > 0 ? suggestions.map(s => (<div key={s.id} onClick={(e)=>{ e.stopPropagation(); selectInventoryItem(cat, s); }} className="px-3 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center group"><div className="truncate pr-2 font-bold text-slate-700 group-hover:text-blue-600">{s.name}</div><div className="text-slate-400 font-mono text-[10px] whitespace-nowrap">${s.cost}</div></div>)) : <div className="px-3 py-2 text-[10px] text-slate-300 text-center">No inventory match</div>}</div>)}
                                            </div>
                                            <div className="col-span-2"><input className="w-full text-[10px] font-mono text-slate-400 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.sku||''} onChange={e=>updateSpec(cat, 'sku', e.target.value)}/></div>
                                            <div className="col-span-2 flex justify-end"><div className="bg-slate-100 rounded-lg px-2 py-1 flex items-center"><span className="text-[10px] text-slate-400 mr-1">$</span><input type="number" className="w-16 text-xs font-bold text-right text-emerald-600 bg-transparent outline-none placeholder:text-slate-300" placeholder="0" value={item.cost||''} onChange={e=>updateSpec(cat, 'cost', parseFloat(e.target.value))}/></div></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {viewPhoto && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8 animate-in fade-in cursor-pointer" onClick={()=>setViewPhoto(null)}>
                        <img src={viewPhoto} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl scale-100"/>
                    </div>
                )}
            </div>
        );
    }

    // LIST VIEW (Default Return)
    return (
        <div className="p-8 max-w-7xl mx-auto">
             <div className="flex gap-4 mb-6 items-center">
                 <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2"><Search size={16} className="ml-2 text-slate-400"/><input className="w-full text-xs font-bold outline-none" placeholder="Search Clients..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
                 <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95"><Plus size={16}/></button>
             </div>
             
             <div className="space-y-4">
                 {filtered.map(c => (
                     <div key={c.id} onClick={()=>{setActive(c); setView('detail');}} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
                         <div className="flex gap-4 items-center">
                             <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs overflow-hidden border border-slate-100">
                                 {c.photos && c.photos.length > 0 ? <img src={c.photos[0]} alt="" className="w-full h-full object-cover"/> : c.wechatName.substring(0,2).toUpperCase()}
                             </div>
                             <div>
                                 <div className="font-black text-base text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">{c.wechatName} {c.rating > 0 && <div className="flex text-yellow-400">{[...Array(c.rating)].map((_,i)=><Star key={i} size={10} fill="currentColor"/>)}</div>}</div>
                                 <div className="flex gap-3 mt-1.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${c.status==='Delivered'?'bg-emerald-50 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{c.status}</span><span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {c.orderDate ? new Date(c.orderDate).toLocaleDateString() : 'No Date'}</span></div>
                             </div>
                         </div>
                         <div className="text-right"><div className="font-black text-lg text-slate-900">{formatMoney(c.totalPrice)}</div><div className="text-[10px] font-bold text-emerald-500">Net: {formatMoney(c.profit)}</div></div>
                     </div>
                 ))}
             </div>
        </div>
    );
}