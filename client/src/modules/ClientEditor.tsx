import React, { useMemo, useRef, useState } from 'react';
import { Camera, X, DollarSign, Cpu, ChevronDown, ChevronUp, Link as LinkIcon, Truck, Calendar, ChevronLeft, Cloud, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { CORE_CATS, ALL_CATS, STATUS_STEPS, formatMoney, compressImage, findBestMatch } from '../utils';
import { Client, InventoryItem } from '../types';

interface Props {
    client: Client;
    inventory: InventoryItem[];
    onUpdate: (c: Client) => void;
    onSave: (finalClient: Client, cost: number, profit: number) => Promise<void>;
    onBack: () => void;
    notify: (msg: string) => void;
}

const INPUT_STYLE = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-300";
const LABEL_STYLE = "text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1";

export default function ClientEditor({ client, inventory, onUpdate, onSave, onBack, notify }: Props) {
    const [activeDrop, setActiveDrop] = useState<string | null>(null); 
    const [viewPhoto, setViewPhoto] = useState<string | null>(null); 
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const fileRef = useRef<HTMLInputElement>(null);

    const calculateFinancials = (c: Client) => {
        let totalCost = 0;
        Object.values(c.specs || {}).forEach(item => { totalCost += (Number(item.cost) || 0); });
        const salePrice = Number(c.totalPrice) || 0;
        return { cost: totalCost, profit: salePrice - totalCost };
    };

    const financialData = useMemo(() => calculateFinancials(client), [client]);

    // --- Auto Save Logic ---
    const handleBlur = async () => {
        setSaveStatus('saving');
        const { cost, profit } = calculateFinancials(client);
        await onSave(client, cost, profit);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const immediateSave = async (updatedClient: Client) => {
        onUpdate(updatedClient); 
        setSaveStatus('saving');
        const { cost, profit } = calculateFinancials(updatedClient);
        await onSave(updatedClient, cost, profit);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const updateLocal = (field: keyof Client, val: any) => { onUpdate({ ...client, [field]: val }); };
    
    const updateImmediate = (field: keyof Client, val: any) => {
        const newClient = { ...client, [field]: val };
        immediateSave(newClient);
    };

    const updateSpec = (cat: string, field: 'name' | 'sku' | 'cost', val: any) => {
        const currentSpec = client.specs[cat] || { name: '', sku: '', cost: 0, qty: 1 };
        onUpdate({ ...client, specs: { ...client.specs, [cat]: { ...currentSpec, [field]: val } } });
    };

    const selectInventoryItem = (cat: string, item: InventoryItem) => {
        const newClient = {
            ...client,
            specs: { ...client.specs, [cat]: { ...client.specs[cat], name: item.name, sku: item.sku || '', cost: item.cost } }
        };
        immediateSave(newClient);
        setActiveDrop(null);
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newPhotos: string[] = [];
            for (let i = 0; i < e.target.files.length; i++) {
                newPhotos.push(await compressImage(e.target.files[i]));
            }
            updateImmediate('photos', [...(client.photos || []), ...newPhotos]);
        }
    };

    // --- PCPartPicker Parser (Fix: Non-inventory cost is 0) ---
    const parsePCPP = (text: string) => {
        if(!text) return;
        
        // 1. Reset Specs
        const initSpecs: any = {};
        CORE_CATS.forEach(c => { initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 }; });
        const newSpecs = { ...initSpecs };
        
        const map: Record<string, string> = { 
            'CPU':'CPU', 'CPU Cooler':'COOLER', 'Motherboard':'MB', 'Memory':'RAM', 
            'Storage':'SSD', 'Video Card':'GPU', 'Case':'CASE', 'Power Supply':'PSU',
            'Case Fan': 'FAN', 'Monitor': 'MONITOR', 'Operating System': 'OTHER'
        };

        const lines = text.split('\n');
        let link = '';

        lines.forEach(l => {
            const line = l.trim();
            if (!line) return;
            if (line.startsWith('Custom:')) return; 
            if(line.includes('pcpartpicker.com/list/')) link = line.match(/(https?:\/\/\S+)/)?.[0] || '';
            
            for (const [pcppLabel, internalCat] of Object.entries(map)) {
                if (line.startsWith(pcppLabel + ':')) {
                    const content = line.substring(pcppLabel.length + 1).trim(); 
                    const namePart = content.split('($')[0].trim();
                    const dbMatch = findBestMatch(namePart, inventory);

                    // --- Cost Logic: Strictly 0 if not in inventory ---
                    const costToUse = dbMatch ? dbMatch.cost : 0;

                    // --- Grouping Logic ---
                    let targetKey = internalCat;
                    let counter = 2;

                    while (newSpecs[targetKey] && newSpecs[targetKey].name) {
                        if (newSpecs[targetKey].name === (dbMatch ? dbMatch.name : namePart)) break;
                        targetKey = `${internalCat} ${counter}`;
                        counter++;
                    }

                    if (!newSpecs[targetKey]) {
                        newSpecs[targetKey] = { name: '', sku: '', cost: 0, qty: 0 };
                    }

                    // Assign Data
                    if (newSpecs[targetKey].name) {
                        // Aggregate existing
                        newSpecs[targetKey].cost += costToUse;
                        newSpecs[targetKey].qty = (newSpecs[targetKey].qty || 1) + 1;
                    } else {
                        // Create new
                        newSpecs[targetKey] = {
                            name: dbMatch ? dbMatch.name : namePart,
                            sku: dbMatch?.sku || '',
                            cost: costToUse, 
                            qty: 1
                        };
                    }
                    break; 
                }
            }
        });
        
        const newClient = { ...client, specs: newSpecs, pcppLink: link || client.pcppLink };
        immediateSave(newClient);
        notify('PCPP Reset & Parsed');
    };

    // --- Dynamic List Rendering ---
    const displayCats = useMemo(() => {
        const keys = new Set([...CORE_CATS, ...Object.keys(client.specs)]);
        return Array.from(keys).sort((a, b) => {
            const baseA = a.split(' ')[0];
            const baseB = b.split(' ')[0];
            const idxA = ALL_CATS.indexOf(baseA);
            const idxB = ALL_CATS.indexOf(baseB);
            if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            return a.localeCompare(b); 
        });
    }, [client.specs]);

    return (
        <div className="p-8 max-w-7xl mx-auto pb-32 animate-in slide-in-from-right" onClick={() => setActiveDrop(null)}>
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="text-slate-400 font-bold text-xs flex items-center gap-1 hover:text-slate-600"><ChevronLeft size={16}/> BACK TO HUB</button>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all">
                        {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin text-slate-400"/> <span className="text-slate-400">Syncing...</span></>}
                        {saveStatus === 'saved' && <><CheckCircle2 size={12} className="text-emerald-500"/> <span className="text-emerald-600">Saved</span></>}
                        {saveStatus === 'idle' && <><Cloud size={12} className="text-slate-300"/> <span className="text-slate-300">Ready</span></>}
                    </div>
                    {client.pcppLink && <a href={client.pcppLink} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-100 transition-colors"><LinkIcon size={14}/> PCPartPicker</a>}
                    {client.trackingNumber && <a href={`https://www.ups.com/track?tracknum=${client.trackingNumber}`} target="_blank" rel="noreferrer" className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-100 transition-colors"><Truck size={14}/> Track</a>}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <input className="text-2xl font-black text-slate-800 bg-transparent outline-none flex-1 placeholder:text-slate-300 min-w-0" placeholder="Client Name" value={client.wechatName} onChange={e=>updateLocal('wechatName', e.target.value)} onBlur={handleBlur}/>
                                <div className="flex items-center bg-slate-50 rounded-lg p-1 h-8 border border-slate-100 shrink-0">
                                    <button onClick={() => updateImmediate('rating', client.rating === 1 ? 0 : 1)} className={`w-7 h-full flex items-center justify-center rounded-md transition-all ${client.rating === 1 ? 'bg-white shadow-sm text-yellow-400' : 'text-slate-300 hover:text-yellow-400 hover:bg-slate-100'}`}><ChevronUp size={16} strokeWidth={3} /></button>
                                    <div className="w-px h-3 bg-slate-200 mx-0.5" />
                                    <button onClick={() => updateImmediate('rating', client.rating === -1 ? 0 : -1)} className={`w-7 h-full flex items-center justify-center rounded-md transition-all ${client.rating === -1 ? 'bg-white shadow-sm text-red-500' : 'text-slate-300 hover:text-red-500 hover:bg-slate-100'}`}><ChevronDown size={16} strokeWidth={3} /></button>
                                </div>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group" onClick={()=>fileRef.current?.click()}>
                                    <Camera size={24} className="text-slate-300 group-hover:text-slate-400"/><input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={handlePhoto}/>
                                </div>
                                {client.photos && client.photos.map((p, idx) => (
                                    <div key={idx} className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 relative group border border-slate-100">
                                        <img src={p} alt="" className="w-full h-full object-cover cursor-pointer" onClick={()=>setViewPhoto(p)}/>
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1 cursor-pointer" onClick={(e)=>{e.stopPropagation(); updateImmediate('photos', client.photos.filter((_, i) => i !== idx));}}><X size={10} className="text-white"/></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>WeChat ID</label><input className={INPUT_STYLE} value={client.wechatId||''} onChange={e=>updateLocal('wechatId', e.target.value)} onBlur={handleBlur}/></div><div><label className={LABEL_STYLE}>Real Name</label><input className={INPUT_STYLE} value={client.realName||''} onChange={e=>updateLocal('realName', e.target.value)} onBlur={handleBlur}/></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>XHS Name</label><input className={INPUT_STYLE} value={client.xhsName||''} onChange={e=>updateLocal('xhsName', e.target.value)} onBlur={handleBlur}/></div><div><label className={LABEL_STYLE}>XHS ID</label><input className={INPUT_STYLE} value={client.xhsId||''} onChange={e=>updateLocal('xhsId', e.target.value)} onBlur={handleBlur}/></div></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="font-black uppercase text-xs mb-6 text-slate-400 tracking-widest flex items-center gap-2"><Calendar size={14}/> Workflow Status</h3>
                        <div className="flex justify-between items-center relative mb-8 px-2">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10"/>
                            {STATUS_STEPS.map((s, i) => (
                                <div key={s} onClick={()=>updateImmediate('status', s)} className="group flex flex-col items-center gap-2 cursor-pointer">
                                    <div className={`w-4 h-4 rounded-full border-2 transition-all ${i <= STATUS_STEPS.indexOf(client.status) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-300'}`}/>
                                    <span className={`text-[8px] font-bold uppercase transition-colors ${client.status===s ? 'text-blue-600' : 'text-slate-300'}`}>{s.split(' ')[0]}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4"><div><label className={LABEL_STYLE}>Deposit Date</label><input type="date" className={INPUT_STYLE} value={client.depositDate?.split('T')[0]||''} onChange={e=>updateLocal('depositDate', e.target.value)} onBlur={handleBlur}/></div><div><label className={LABEL_STYLE}>Delivery Date</label><input type="date" className={INPUT_STYLE} value={client.deliveryDate?.split('T')[0]||''} onChange={e=>updateLocal('deliveryDate', e.target.value)} onBlur={handleBlur}/></div></div>
                            <div className="pt-4 border-t border-slate-50">
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div><label className={LABEL_STYLE}>City</label><input className={INPUT_STYLE} value={client.city||''} onChange={e=>updateLocal('city', e.target.value)} onBlur={handleBlur}/></div>
                                    <div><label className={LABEL_STYLE}>Zip Code</label><input className={INPUT_STYLE} value={client.zip||''} onChange={e=>updateLocal('zip', e.target.value)} onBlur={handleBlur}/></div>
                                </div>
                                <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={()=>updateImmediate('isShipping', !client.isShipping)}>
                                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${client.isShipping?'bg-blue-600':'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${client.isShipping?'translate-x-4':''}`}/></div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Truck size={12}/> Shipping Required</span>
                                </div>
                                {client.isShipping && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                                        <div><label className={LABEL_STYLE}>Street Address</label><input className={INPUT_STYLE} value={client.address||''} onChange={e=>updateLocal('address', e.target.value)} onBlur={handleBlur}/></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className={LABEL_STYLE}>State</label><input className={INPUT_STYLE} value={client.state||''} onChange={e=>updateLocal('state', e.target.value)} onBlur={handleBlur}/></div>
                                            <div><label className={LABEL_STYLE}>Tracking</label><input className={INPUT_STYLE} value={client.trackingNumber||''} onChange={e=>updateLocal('trackingNumber', e.target.value)} onBlur={handleBlur}/></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100"><label className={LABEL_STYLE}>Notes</label><textarea className={`${INPUT_STYLE} h-24 resize-none`} value={client.notes||''} onChange={e=>updateLocal('notes', e.target.value)} onBlur={handleBlur}/></div>
                </div>

                <div className="xl:col-span-2 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"><label className={LABEL_STYLE}><span className="flex items-center gap-1"><DollarSign size={12}/> Total Sale</span></label><input className="text-2xl font-black text-slate-800 bg-transparent outline-none w-full" placeholder="0.00" value={client.totalPrice||''} onChange={e=>updateLocal('totalPrice', parseFloat(e.target.value))} onBlur={handleBlur}/></div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between"><label className={LABEL_STYLE}>Cost (Auto)</label><div className="text-2xl font-black text-slate-500">{formatMoney(financialData.cost)}</div></div>
                        <div className={`p-5 rounded-2xl border flex flex-col justify-between ${financialData.profit>=0?'bg-emerald-50/50 border-emerald-100':'bg-red-50/50 border-red-100'}`}><label className={`text-[10px] font-extrabold uppercase tracking-widest mb-1.5 block ml-1 ${financialData.profit>=0?'text-emerald-500':'text-red-400'}`}>Profit</label><div className={`text-2xl font-black ${financialData.profit>=0?'text-emerald-600':'text-red-500'}`}>{formatMoney(financialData.profit)}</div></div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><Cpu size={20}/></div><h3 className="font-black text-sm text-slate-800">Configuration</h3></div></div>
                        <div className="bg-slate-50 rounded-xl p-4 mb-6"><textarea className="w-full h-20 bg-transparent text-xs font-mono outline-none resize-none placeholder:text-slate-400" placeholder="Paste PCPartPicker list here..." onChange={e=>parsePCPP(e.target.value)}/></div>
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-4 px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="col-span-2">Type</div><div className="col-span-6">Model</div><div className="col-span-2">SKU</div><div className="col-span-2 text-right">Cost</div></div>
                            {displayCats.map(cat => {
                                const item = client.specs[cat] || { name: '', sku: '', cost: 0 };
                                const dropdownOpen = activeDrop === cat;
                                const suggestions = dropdownOpen ? inventory.filter(invItem => { 
                                    const baseCat = cat.split(' ')[0]; 
                                    if(baseCat!=='CUSTOM' && invItem.category!==baseCat && invItem.category!=='OTHER') return false; 
                                    if(!item.name) return true; 
                                    return invItem.name.toLowerCase().includes(item.name.toLowerCase()); 
                                }).slice(0, 5) : [];
                                return (
                                    <div key={cat} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors px-4 -mx-4 relative">
                                        <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            {cat} 
                                            {item.qty > 1 && <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">x{item.qty}</span>}
                                        </div>
                                        <div className="col-span-6 relative">
                                            <div className="flex items-center"><input className="w-full text-sm font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.name||''} onChange={e=>updateSpec(cat, 'name', e.target.value)} onBlur={handleBlur} onFocus={() => setActiveDrop(cat)} onClick={(e) => { e.stopPropagation(); setActiveDrop(cat); }} /><button onClick={(e)=>{e.stopPropagation(); setActiveDrop(dropdownOpen ? null : cat)}} className="text-slate-300 hover:text-slate-500"><ChevronDown size={14}/></button></div>
                                            {dropdownOpen && (<div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl border border-slate-100 z-50 mt-2 p-1 animate-in fade-in zoom-in-95">{suggestions.length > 0 ? suggestions.map(s => (<div key={s.id} onClick={(e)=>{ e.stopPropagation(); selectInventoryItem(cat, s); }} className="px-3 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center group"><div className="truncate pr-2 font-bold text-slate-700 group-hover:text-blue-600">{s.name}</div><div className="text-slate-400 font-mono text-[10px] whitespace-nowrap">${s.cost}</div></div>)) : <div className="px-3 py-2 text-[10px] text-slate-300 text-center">No inventory match</div>}</div>)}
                                        </div>
                                        <div className="col-span-2"><input className="w-full text-[10px] font-mono text-slate-400 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.sku||''} onChange={e=>updateSpec(cat, 'sku', e.target.value)} onBlur={handleBlur}/></div>
                                        <div className="col-span-2 flex justify-end"><div className="bg-slate-100 rounded-lg px-2 py-1 flex items-center"><span className="text-[10px] text-slate-400 mr-1">$</span><input type="number" className="w-16 text-xs font-bold text-right text-emerald-600 bg-transparent outline-none placeholder:text-slate-300" placeholder="0" value={item.cost||''} onChange={e=>updateSpec(cat, 'cost', parseFloat(e.target.value))} onBlur={handleBlur}/></div></div>
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