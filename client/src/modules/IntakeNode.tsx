import React, { useState, useEffect } from 'react';
import { Scan, Box, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { generateId, ALL_CATS, apiCall, lookupBarcode, findBestMatch, guessCategory } from '../utils';
import { AppData, InventoryItem } from '../types';

interface Props {
    data: AppData;
    refresh: () => void;
    notify: (msg: string, type?: string) => void;
    log: (type: string, title: string, msg: string) => void;
}

// 定义暂存区物品的类型 (扩展了 InventoryItem)
interface StagedItem extends InventoryItem {
    qtyInput: number;
    costInput: number;
    isMatch?: boolean;
    isApi?: boolean;
    tempSubtotal?: number; // 用于计算 WAC
    isGift?: boolean;
}

export default function IntakeNode({ data, refresh, notify, log }: Props) {
    const [scanVal, setScanVal] = useState('');
    const [neweggTxt, setNeweggTxt] = useState('');
    const [batch, setBatch] = useState<StagedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeDrop, setActiveDrop] = useState<number | null>(null); 

    useEffect(() => { 
        const close = () => setActiveDrop(null); 
        window.addEventListener('click', close); 
        return () => window.removeEventListener('click', close); 
    }, []);

    // 1. 扫码逻辑 - 已经包含初步匹配
    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault(); 
        const code = scanVal.trim(); 
        if(!code) return;
        
        // A. 检查当前暂存区是否已有重复扫描
        const batchIdx = batch.findIndex(i => i.sku === code);
        if(batchIdx >= 0) { 
            const newBatch = [...batch]; 
            newBatch[batchIdx].qtyInput += 1; 
            setBatch(newBatch); 
            setScanVal(''); 
            notify(`Quantity updated`); 
            return; 
        }
        
        // B. 检查现有库存 (完全匹配 SKU)
        const match = data.inv.find(i => (i.sku && i.sku === code) || (i.keyword && i.keyword === code));
        if(match) { 
            setBatch(p => [{ ...match, qtyInput: 1, costInput: match.cost, isMatch: true } as StagedItem, ...p]); 
            setScanVal(''); 
            return; 
        }
        
        // C. API 查询
        setLoading(true); 
        const apiData = await lookupBarcode(code); 
        setLoading(false);
        
        // D. 尝试根据 API 名字模糊匹配现有库存
        let fuzzyMatch: InventoryItem | null = null;
        if(apiData) {
            fuzzyMatch = findBestMatch(apiData.name, data.inv);
        }

        const newItem: StagedItem = {
            id: fuzzyMatch ? fuzzyMatch.id : generateId(), 
            name: fuzzyMatch ? fuzzyMatch.name : (apiData ? apiData.name : 'New Item (Manual Entry)'),
            category: fuzzyMatch ? fuzzyMatch.category : (apiData ? apiData.category : 'Other'),
            sku: code,
            keyword: fuzzyMatch ? (fuzzyMatch.keyword || '') : '',
            quantity: fuzzyMatch ? fuzzyMatch.quantity : 0,
            cost: fuzzyMatch ? fuzzyMatch.cost : 0,
            
            // 【修复】补全 lastUpdated 字段
            lastUpdated: fuzzyMatch ? fuzzyMatch.lastUpdated : Date.now(),
            
            // 补全 InventoryItem 必填字段
            price: fuzzyMatch ? fuzzyMatch.price : 0,
            location: fuzzyMatch ? fuzzyMatch.location : '',
            status: fuzzyMatch ? fuzzyMatch.status : 'In Stock',
            notes: fuzzyMatch ? fuzzyMatch.notes : '',
            photos: fuzzyMatch ? fuzzyMatch.photos : [],
            
            qtyInput: 1,
            costInput: 0,
            isMatch: !!fuzzyMatch, 
            isApi: !!apiData
        };

        setBatch(p => [newItem, ...p]); 
        setScanVal('');
        
        if(fuzzyMatch) notify(`Matched existing: ${fuzzyMatch.name}`);
        else if(apiData) notify('Found in Global DB (New Entry)');
        else notify('Not Found - Please Enter Details', 'error');
    };

    // 2. Newegg 解析逻辑
    const parseNewegg = () => {
        try {
            const text = neweggTxt;
            const gtMatch = text.match(/Grand Total\s*\n?\$?([\d,]+\.\d{2})/);
            const grandTotal = gtMatch ? parseFloat(gtMatch[1].replace(/,/g,'')) : 0;

            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const items: StagedItem[] = [];

            for(let i=0; i<lines.length; i++) {
                if(lines[i].startsWith('Item #:')) {
                    const rawSku = lines[i].split(':')[1].trim(); 
                    
                    let name = "Unknown Item";
                    let k = i - 1;
                    while(k >= 0) {
                        const line = lines[k];
                        if (line.includes('Return Policy') || line.startsWith('COMBO') || line.includes('Free Gift') || line.includes('Warranty')) {
                            k--; continue;
                        }
                        name = line; break;
                    }

                    let qty = 1;
                    let subtotal = 0;
                    for(let j=1; j<8; j++) {
                        const l = lines[i+j];
                        if(!l) continue;
                        if(l.includes('ea.)')) {
                            const priceMatch = lines[i+j-1].match(/\$?([\d,]+\.\d{2})/);
                            if (priceMatch) subtotal = parseFloat(priceMatch[1].replace(/,/g, ''));
                            const qtyLine = lines[i+j-2];
                            if (qtyLine && /^\d+$/.test(qtyLine)) qty = parseInt(qtyLine);
                            break; 
                        }
                        if (l.startsWith('$') && !l.includes('ea.')) {
                            const possiblePrice = parseFloat(l.replace(/[$,]/g, ''));
                            const prevLine = lines[i+j-1];
                            if (/^\d+$/.test(prevLine)) {
                                qty = parseInt(prevLine);
                                subtotal = possiblePrice;
                                break;
                            }
                        }
                    }

                    const dbMatch = findBestMatch(name, data.inv);
                    const autoCat = dbMatch?.category || guessCategory(name);
                    
                    const isGift = lines.slice(Math.max(0, i-6), i).some(l => l.includes('Free Gift Item'));

                    items.push({
                        id: dbMatch?.id || generateId(),
                        name: dbMatch?.name || name,
                        category: autoCat,
                        sku: dbMatch?.sku || '', 
                        keyword: dbMatch?.keyword || '',
                        
                        quantity: dbMatch?.quantity || 0,
                        cost: dbMatch?.cost || 0,
                        
                        // 【修复】补全 lastUpdated 字段
                        lastUpdated: dbMatch ? dbMatch.lastUpdated : Date.now(),
                        
                        // 补全 InventoryItem 必填字段
                        price: dbMatch?.price || 0,
                        location: dbMatch?.location || '',
                        status: dbMatch?.status || 'In Stock',
                        notes: dbMatch?.notes || '',
                        photos: dbMatch?.photos || [],
                        
                        qtyInput: qty,
                        tempSubtotal: subtotal, 
                        isGift: isGift,
                        isMatch: !!dbMatch,
                        costInput: 0 
                    });
                }
            }

            const validItems = items.filter(i => !i.isGift);
            const sumSubtotals = validItems.reduce((a, b) => a + (b.tempSubtotal || 0), 0);

            const finalBatch = items.map(item => {
                let finalCost = 0;
                if (!item.isGift && sumSubtotals > 0 && grandTotal > 0) {
                    const weight = (item.tempSubtotal || 0) / sumSubtotals;
                    finalCost = (weight * grandTotal) / item.qtyInput;
                }
                return { ...item, costInput: parseFloat(finalCost.toFixed(2)) };
            });

            if (finalBatch.length === 0) notify('No items found', 'error');
            else {
                setBatch(p => [...finalBatch, ...p]);
                setNeweggTxt('');
                notify(`Parsed ${finalBatch.length} items. Matched ${finalBatch.filter(i=>i.isMatch).length} existing.`);
            }

        } catch(e) { console.error(e); notify('Parse Error', 'error'); }
    };

    // 3. 手动选择匹配逻辑
    const matchToLocal = (batchIdx: number, localItem: InventoryItem) => {
        const newBatch = [...batch];
        newBatch[batchIdx] = { 
            ...newBatch[batchIdx], 
            id: localItem.id, 
            name: localItem.name, 
            sku: localItem.sku, 
            keyword: localItem.keyword, 
            category: localItem.category, 
            quantity: localItem.quantity, 
            cost: localItem.cost, 
            
            // 【修复】补全 lastUpdated 字段
            lastUpdated: localItem.lastUpdated,
            
            // 补全 InventoryItem 必填字段
            price: localItem.price,
            location: localItem.location,
            status: localItem.status,
            notes: localItem.notes,
            photos: localItem.photos,

            isMatch: true 
        };
        setBatch(newBatch); 
        setActiveDrop(null);
    };

    // 4. 提交入库
    const commit = async () => {
        const payloadMap = new Map<string, InventoryItem>();

        batch.forEach(item => {
            const existing = payloadMap.get(item.id);
            
            if (existing) {
                const runningQty = existing.quantity + item.qtyInput;
                const runningVal = (existing.quantity * existing.cost) + (item.qtyInput * item.costInput);
                const runningCost = runningQty > 0 ? runningVal / runningQty : 0;

                payloadMap.set(item.id, {
                    ...existing,
                    quantity: runningQty,
                    cost: parseFloat(runningCost.toFixed(2)),
                    lastUpdated: Date.now() // 更新时间
                });

            } else {
                const finalQty = item.quantity + item.qtyInput;
                const finalVal = (item.quantity * item.cost) + (item.qtyInput * item.costInput);
                const finalCost = finalQty > 0 ? finalVal / finalQty : 0;

                payloadMap.set(item.id, {
                    ...item,
                    quantity: finalQty,
                    cost: parseFloat(finalCost.toFixed(2)),
                    lastUpdated: Date.now()
                });
            }
        });

        const payload = Array.from(payloadMap.values());
        
        await apiCall('/inventory/batch', 'POST', payload);
        notify(`Inventory Updated: ${payload.length} items merged`); 
        setBatch([]); 
        refresh();
    };

    return (
        <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-8rem)]">
            <div className="space-y-6 h-full flex flex-col">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex-shrink-0">
                    <h3 className="font-black uppercase text-xs mb-4 text-slate-400 tracking-widest flex items-center gap-2"><Scan size={14}/> Scanner Input</h3>
                    <form onSubmit={handleScan} className="relative">
                        {loading ? <Loader2 className="absolute left-4 top-3.5 text-blue-500 animate-spin" size={20}/> : <Scan className="absolute left-4 top-3.5 text-slate-400" size={20}/>}
                        <input autoFocus className="w-full bg-slate-50 pl-12 pr-4 py-3.5 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Scan SKU / UPC..." value={scanVal} onChange={e=>setScanVal(e.target.value)}/>
                    </form>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                    <h3 className="font-black uppercase text-xs mb-4 text-slate-400 tracking-widest flex items-center gap-2"><Box size={14}/> Newegg Import</h3>
                    <textarea className="flex-1 bg-slate-50 rounded-xl p-4 text-xs font-mono mb-4 outline-none resize-none focus:ring-2 focus:ring-blue-100 transition-all leading-relaxed" placeholder="Paste Newegg Order Summary..." value={neweggTxt} onChange={e=>setNeweggTxt(e.target.value)}/>
                    <button onClick={parseNewegg} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex-shrink-0">Analyze & Extract</button>
                </div>
            </div>
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-6 flex-shrink-0"><h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Staging ({batch.length})</h3>{batch.length>0 && <button onClick={commit} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all">Commit All</button>}</div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar pb-10">
                    {batch.map((item, i) => {
                        const suggestions = activeDrop === i ? data.inv.filter(inv => {
                            const searchStr = item.name.toLowerCase();
                            const invName = inv.name.toLowerCase();
                            const invKey = (inv.keyword || '').toLowerCase();
                            if (invName.includes(searchStr)) return true;
                            if (invKey && searchStr.includes(invKey)) return true;
                            return false; 
                        }).slice(0, 5) : [];

                        return (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-blue-200 transition-colors animate-in slide-in-from-bottom-2 relative">
                                <div className="flex justify-between items-start relative">
                                    <div className="w-full relative">
                                        <input 
                                            className="font-bold text-sm w-full bg-transparent outline-none text-slate-800" 
                                            value={item.name} 
                                            onChange={e=>{const n=[...batch];n[i].name=e.target.value;setBatch(n)}}
                                            onFocus={() => setActiveDrop(i)}
                                            onClick={(e) => { e.stopPropagation(); setActiveDrop(i); }}
                                        />
                                        {activeDrop === i && suggestions.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl border border-slate-100 z-50 mt-2 p-1">
                                                {suggestions.map(s => (
                                                    <div key={s.id} onClick={(e)=>{ e.stopPropagation(); matchToLocal(i, s); }} className="px-3 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center">
                                                        <div className="truncate pr-2 font-bold text-slate-700">{s.name}</div>
                                                        <div className="text-slate-400 font-mono text-[10px] whitespace-nowrap">LINK ID</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={()=>setBatch(batch.filter((_,idx)=>idx!==i))}><Trash2 size={16} className="text-slate-300 hover:text-red-500 transition-colors"/></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.isMatch?'bg-emerald-50 text-emerald-600': (item.isApi ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}`}>{item.isMatch?'Matched': (item.isApi ? 'API Found' : 'New')}</span>
                                    {item.isGift && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase bg-purple-50 text-purple-600">Gift</span>}
                                    <select className="text-[10px] font-bold bg-slate-50 text-slate-500 rounded-lg px-2 py-1 outline-none uppercase" value={item.category} onChange={e=>{const n=[...batch];n[i].category=e.target.value;setBatch(n)}}>{ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-1">
                                    <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span><input type="number" className="bg-transparent text-right font-black text-sm w-12 outline-none" value={item.qtyInput} onChange={e=>{const n=[...batch];n[i].qtyInput=parseInt(e.target.value)||0;setBatch(n)}}/></div>
                                    <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Cost</span><input type="number" className="bg-transparent text-right font-black text-sm w-20 outline-none text-emerald-600" value={item.costInput} onChange={e=>{const n=[...batch];n[i].costInput=parseFloat(e.target.value)||0;setBatch(n)}}/></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <input className="text-[10px] font-mono text-slate-400 bg-transparent outline-none w-full" placeholder="SKU/UPC" value={item.sku} onChange={e=>{const n=[...batch];n[i].sku=e.target.value;setBatch(n)}} />
                                    {item.isMatch && <span className="text-[9px] text-slate-300 font-bold ml-2">ID_LINKED</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
