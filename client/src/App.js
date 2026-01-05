import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, Search, CheckCircle, AlertCircle, 
  Plus, Minus, Save, X, ExternalLink, Truck, ChevronLeft, Box, Cpu, Scan, 
  Trash2, ArrowRight
} from 'lucide-react';

/**
 * Project: PC Inventory Master
 * Version: 4.2.0 Critical Hotfix
 * Fixes: Newegg Cost Allocation Algorithm, PCPartPicker Text Parsing
 */

const API_BASE = `http://${window.location.hostname}:5001/api`;
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const SPEC_CATS = ['CPU', 'CPU Cooler', 'Motherboard', 'Memory', 'Storage', 'Video Card', 'Case', 'Power Supply', 'Case Fan', 'Monitor', 'Strimer', 'Labor', 'Custom'];
const STATUS_OPTS = ['Deposit Paid', 'Waiting Parts', 'Building', 'Ready', 'Delivered'];

// --- API ---
async function apiCall(url, method='GET', body=null) {
    try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if(body) opts.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${url}`, opts);
        return await res.json();
    } catch(e) { return null; }
}

// --- Fuzzy Match ---
function findBestMatch(targetName, inventory) {
    if(!targetName) return null;
    const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let best = null; let bestScore = 0;

    inventory.forEach(item => {
        let score = 0;
        const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanKey = (item.keyword || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if(cleanTarget.includes(cleanName) || cleanName.includes(cleanTarget)) score += 50;
        if(cleanKey && cleanTarget.includes(cleanKey)) score += 30;
        
        // Simple token match
        targetName.split(' ').forEach(t => { 
            if(t.length > 2 && item.name.toLowerCase().includes(t.toLowerCase())) score += 5; 
        });

        if(score > bestScore) { bestScore = score; best = item; }
    });
    return bestScore > 10 ? best : null;
}

export default function App() {
  const [tab, setTab] = useState('dash');
  const [data, setData] = useState({ inv: [], clients: [], logs: [] });
  const [toast, setToast] = useState([]);

  useEffect(() => { refresh(); }, []);
  const refresh = async () => {
    const [inv, cl, lg] = await Promise.all([apiCall('/inventory'), apiCall('/clients'), apiCall('/logs')]);
    setData({ inv: inv||[], clients: cl||[], logs: lg||[] });
  };
  const notify = (msg, type='success') => {
    const id = generateId(); setToast(p => [...p, {id, msg, type}]);
    setTimeout(() => setToast(p => p.filter(x => x.id !== id)), 3000);
  };
  const log = (type, title, msg) => apiCall('/logs', 'POST', { id: generateId(), timestamp: Date.now(), type, title, msg });

  return (
    <div className="flex h-screen bg-[#F1F5F9] text-slate-900 font-sans overflow-hidden select-none">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-full max-w-sm px-4">
         {toast.map(t => <div key={t.id} className={`px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-5 ${t.type==='error'?'bg-red-50/90 text-red-600':'bg-emerald-50/90 text-emerald-600'}`}>{t.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}{t.msg}</div>)}
      </div>

      <div className="flex-1 overflow-y-auto pb-28 no-scrollbar">{ 
         tab==='dash' ? <Dashboard data={data}/> : 
         tab==='clients' ? <ClientHub data={data} refresh={refresh} notify={notify} log={log}/> : 
         tab==='inbound' ? <IntakeNode data={data} refresh={refresh} notify={notify} log={log}/> : 
         <StockVault data={data} refresh={refresh} notify={notify} log={log}/> 
      }</div>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-6 py-3 flex gap-6">
           <NavIcon icon={LayoutDashboard} active={tab==='dash'} onClick={()=>setTab('dash')} label="Dash"/>
           <NavIcon icon={Users} active={tab==='clients'} onClick={()=>setTab('clients')} label="Clients"/>
           <NavIcon icon={ScanLine} active={tab==='inbound'} onClick={()=>setTab('inbound')} label="Inbound"/>
           <NavIcon icon={Package} active={tab==='stock'} onClick={()=>setTab('stock')} label="Stock"/>
        </div>
      </div>
    </div>
  );
}
const NavIcon = ({icon:I, active, onClick, label}) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active?'text-blue-600 scale-110':'text-slate-400'}`}><I size={22} strokeWidth={active?2.5:2}/><span className="text-[9px] font-black uppercase">{label}</span></button>);

// --- DASHBOARD ---
const Dashboard = ({ data }) => {
  const stockVal = data.inv.reduce((a, b) => a + (b.cost * b.quantity), 0);
  const pending = data.clients.filter(c => c.status !== 'Delivered').length;
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
       <header><h1 className="text-3xl font-black text-slate-900">Console</h1><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">v4.2.0 • Fixes Applied</p></header>
       <div className="grid grid-cols-2 gap-4">
          <Card label="Vault Value" val={formatMoney(stockVal)} color="text-blue-600" bg="bg-blue-50" icon={Package}/>
          <Card label="Pending Orders" val={pending} color="text-amber-600" bg="bg-amber-50" icon={Users}/>
       </div>
    </div>
  );
};
const Card = ({ label, val, color, bg, icon: Icon }) => (<div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm"><div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}><Icon size={20}/></div><div className="text-2xl font-black text-slate-800">{val}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</div></div>);

// --- STOCK VAULT ---
const StockVault = ({ data, refresh, notify, log }) => {
    const [cat, setCat] = useState('All');
    const [editItem, setEditItem] = useState(null);
    const [adjQty, setAdjQty] = useState(1);
    const [adjCost, setAdjCost] = useState(0);

    const filtered = data.inv.filter(i => cat === 'All' || i.category === cat);
    
    const commit = async (mode) => {
        const qtyChg = mode === 'add' ? adjQty : -adjQty;
        const newQty = editItem.quantity + qtyChg;
        let newCost = editItem.cost;
        if(mode === 'add' && newQty > 0) {
            newCost = ((editItem.quantity * editItem.cost) + (adjQty * adjCost)) / newQty;
        }
        await apiCall('/inventory/batch', 'POST', [{ ...editItem, quantity: newQty, cost: parseFloat(newCost.toFixed(2)) }]);
        log('STOCK', `Manual ${mode}`, `${editItem.name} ${qtyChg}`);
        notify('Stock Updated'); setEditItem(null); refresh();
    };

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">{['All', ...SPEC_CATS].map(c => <button key={c} onClick={()=>setCat(c)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${cat===c?'bg-slate-900 text-white':'bg-white text-slate-400'}`}>{c}</button>)}</div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {filtered.map(i => (
                    <div key={i.id} className="flex items-center p-3 border-b border-slate-50 hover:bg-slate-50">
                        <div className="w-12 text-[9px] font-black text-slate-400 uppercase">{i.category}</div>
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="font-bold text-xs text-slate-800 truncate">{i.name}</div>
                            <div className="flex gap-2 text-[9px] font-mono text-slate-400"><span>{i.keyword||'-'}</span><span>{i.sku}</span></div>
                        </div>
                        <div className="text-right mr-4"><div className="font-bold text-xs">{i.quantity}</div><div className="text-[9px] text-slate-400 font-bold">@ {formatMoney(i.cost)}</div></div>
                        <div className="flex gap-1"><button onClick={()=>{setEditItem(i);setAdjQty(1);}} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200"><Plus size={14}/></button></div>
                    </div>
                ))}
            </div>
            {editItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                        <h3 className="font-black uppercase text-xs mb-4">Adjust: {editItem.name}</h3>
                        <div className="bg-blue-50 p-3 rounded-xl mb-4 text-xs font-bold text-blue-800">Current: {editItem.quantity} units @ {formatMoney(editItem.cost)}</div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div><label className="l">Qty Change</label><input type="number" className="i text-center text-lg" value={adjQty} onChange={e=>setAdjQty(parseInt(e.target.value)||0)}/></div>
                            <div><label className="l">Unit Cost</label><input type="number" className="i text-center text-lg" value={adjCost} onChange={e=>setAdjCost(parseFloat(e.target.value)||0)}/></div>
                        </div>
                        {/* Real-time WAC Preview */}
                        <div className="mb-4 text-center">
                            <div className="text-[9px] uppercase font-bold text-slate-400">Projected WAC</div>
                            <div className="text-xl font-black text-slate-800">
                                {formatMoney( (editItem.quantity*editItem.cost + adjQty*adjCost) / (editItem.quantity+adjQty) )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={()=>commit('sub')} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-xs uppercase">Remove</button>
                             <button onClick={()=>commit('add')} className="flex-1 bg-emerald-50 text-emerald-600 py-3 rounded-xl font-bold text-xs uppercase">Add</button>
                        </div>
                        <button onClick={()=>setEditItem(null)} className="w-full mt-2 py-3 text-slate-400 text-xs font-bold">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTAKE NODE (NEWEGG FIX) ---
const IntakeNode = ({ data, refresh, notify, log }) => {
    const [scanVal, setScanVal] = useState('');
    const [neweggTxt, setNeweggTxt] = useState('');
    const [batch, setBatch] = useState([]);

    const handleScan = (e) => {
        e.preventDefault();
        if(!scanVal) return;
        const match = data.inv.find(i => i.sku === scanVal || i.keyword === scanVal);
        setBatch(p => [{
            id: match?.id || generateId(),
            name: match?.name || 'New Item',
            category: match?.category || 'Other',
            sku: scanVal,
            quantity: match?.quantity || 0, 
            cost: match?.cost || 0,
            qtyInput: 1, 
            costInput: 0,
            isMatch: !!match
        }, ...p]);
        setScanVal('');
    };

    const parseNewegg = () => {
        try {
            const text = neweggTxt;
            // 1. Get Grand Total
            const gtMatch = text.match(/Grand Total\s*\$?([\d,]+\.\d{2})/);
            const grandTotal = gtMatch ? parseFloat(gtMatch[1].replace(/,/g,'')) : 0;
            
            const lines = text.split('\n').map(l => l.trim());
            const items = [];
            
            for(let i=0; i<lines.length; i++) {
                if(lines[i].startsWith('Item #:')) {
                    const sku = lines[i].split(':')[1].trim();
                    let name = lines[i-1];
                    if(name.includes('Return Policy') || name.startsWith('COMBO')) name = lines[i-2]; 
                    
                    const isGift = lines.slice(Math.max(0,i-6), i).some(l => l.includes('Free Gift Item'));
                    
                    // 2. Precise Extraction of Subtotal and Quantity using "ea." anchor
                    let subtotal = 0;
                    let qty = 1;

                    // Look ahead for "($xxx.xx ea.)" pattern
                    for(let j=1; j<8; j++) {
                        const l = lines[i+j];
                        if(l && l.includes('ea.)')) {
                             // Line directly above 'ea.' is the Subtotal (e.g. $428.00)
                             const subLine = lines[i+j-1];
                             if(subLine && subLine.startsWith('$')) {
                                subtotal = parseFloat(subLine.replace(/[$,]/g, ''));
                             }
                             // Line above Subtotal is Quantity (e.g. 2)
                             const qtyLine = lines[i+j-2];
                             if(qtyLine && /^\d+$/.test(qtyLine)) {
                                qty = parseInt(qtyLine);
                             }
                             break;
                        }
                    }

                    const dbMatch = findBestMatch(name, data.inv);
                    
                    items.push({
                        id: dbMatch?.id || generateId(),
                        name: dbMatch?.name || name,
                        category: dbMatch?.category || 'Other',
                        sku: dbMatch?.sku || sku,
                        qtyInput: qty,
                        subtotal: subtotal, // Store raw subtotal for calc
                        isGift: isGift,
                        isMatch: !!dbMatch,
                        quantity: dbMatch?.quantity || 0,
                        cost: dbMatch?.cost || 0
                    });
                }
            }

            // 3. User's Requested Algorithm: (Subtotal / SumNonGiftSubtotals) * GrandTotal / Qty
            const validItems = items.filter(i => !i.isGift);
            const sumSubtotals = validItems.reduce((a, b) => a + b.subtotal, 0);
            
            const finalBatch = items.map(item => {
                let costInput = 0;
                if(!item.isGift && sumSubtotals > 0) {
                    // This is the specific math requested
                    costInput = (item.subtotal / sumSubtotals) * grandTotal / item.qtyInput;
                }
                return { ...item, costInput: parseFloat(costInput.toFixed(2)) };
            });

            setBatch(p => [...finalBatch, ...p]);
            setNeweggTxt('');
            notify(`Parsed ${items.length} items. Total: ${formatMoney(grandTotal)}`);
        } catch(e) { notify('Parse Error', 'error'); console.error(e); }
    };

    const commit = async () => {
        const payload = batch.map(b => {
            const finalQ = b.quantity + b.qtyInput;
            const finalC = finalQ > 0 ? ((b.quantity*b.cost) + (b.qtyInput*b.costInput))/finalQ : 0;
            return { ...b, quantity: finalQ, cost: parseFloat(finalC.toFixed(2)) };
        });
        await apiCall('/inventory/batch', 'POST', payload);
        log('INTAKE', 'Batch Added', `${batch.length} SKUs`);
        notify('Inventory Updated'); setBatch([]); refresh();
    };

    return (
        <div className="p-4 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                {/* Scan Box Always Visible */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="font-black uppercase text-xs mb-3 text-slate-400">Scanner / Manual</h3>
                    <form onSubmit={handleScan} className="relative">
                        <Scan className="absolute left-4 top-3 text-slate-300" size={20}/>
                        <input autoFocus className="w-full bg-slate-50 pl-12 pr-4 py-3 rounded-xl font-bold outline-none" placeholder="Enter SKU..." value={scanVal} onChange={e=>setScanVal(e.target.value)}/>
                    </form>
                </div>
                {/* Newegg Box Always Visible */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="font-black uppercase text-xs mb-3 text-slate-400">Newegg Import</h3>
                    <textarea className="w-full h-32 bg-slate-50 rounded-xl p-3 text-[10px] font-mono mb-3 outline-none resize-none" placeholder="Paste Newegg Order Summary..." value={neweggTxt} onChange={e=>setNeweggTxt(e.target.value)}/>
                    <button onClick={parseNewegg} className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold text-xs uppercase">Parse Text</button>
                </div>
            </div>

            <div className="space-y-3 pb-24">
                {batch.map((item, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-right">
                        <div className="flex justify-between items-start mb-2">
                            <input className="font-black text-xs w-full bg-transparent outline-none" value={item.name} onChange={e=>{const n=[...batch];n[i].name=e.target.value;setBatch(n)}}/>
                            <button onClick={()=>setBatch(batch.filter((_,idx)=>idx!==i))}><Trash2 size={16} className="text-slate-300 hover:text-red-500"/></button>
                        </div>
                        <div className="flex gap-2 mb-2">
                             <span className={`text-[9px] font-black px-1.5 rounded uppercase ${item.isMatch?'bg-emerald-100 text-emerald-600':'bg-blue-50 text-blue-500'}`}>{item.isMatch?'Matched':'New'}</span>
                             {item.isGift && <span className="text-[9px] font-black px-1.5 rounded uppercase bg-purple-100 text-purple-600">Gift</span>}
                             <select className="text-[9px] bg-slate-50 rounded outline-none" value={item.category} onChange={e=>{const n=[...batch];n[i].category=e.target.value;setBatch(n)}}>{SPEC_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="l">Add Qty</label><input type="number" className="i text-center" value={item.qtyInput} onChange={e=>{const n=[...batch];n[i].qtyInput=parseInt(e.target.value)||0;setBatch(n)}}/></div>
                             <div><label className="l">Unit Cost</label><input type="number" className="i text-center" value={item.costInput} onChange={e=>{const n=[...batch];n[i].costInput=parseFloat(e.target.value)||0;setBatch(n)}}/></div>
                        </div>
                        {item.isMatch && (
                            <div className="mt-2 text-[9px] text-slate-400 font-mono text-center">
                                Current: {item.quantity} units @ {formatMoney(item.cost)}
                            </div>
                        )}
                    </div>
                ))}
                {batch.length>0 && <button onClick={commit} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Commit All ({batch.length})</button>}
            </div>
        </div>
    );
};

// --- CLIENT HUB (PCPP FIXED) ---
const ClientHub = ({ data, refresh, notify, log }) => {
    const [view, setView] = useState('list');
    const [active, setActive] = useState(null);
    const [search, setSearch] = useState('');
    const [pcppText, setPcppText] = useState('');

    const handleNew = () => {
        setActive({ id: generateId(), wechatName: 'New Client', isShipping: false, specs: {}, status: 'Deposit Paid', orderDate: new Date().toISOString().split('T')[0] });
        setPcppText(''); setView('detail');
    };

    const save = async () => {
        let actual = 0;
        SPEC_CATS.forEach(c => { if(active.specs[c]) actual += (active.specs[c].cost || 0); });
        const profit = (active.totalPrice || 0) - actual;
        await apiCall('/clients', 'POST', { ...active, actualCost: actual, profit });
        log('CLIENT', 'Updated', active.wechatName);
        notify('Saved'); refresh(); setView('list');
    };

    const parsePCPP = () => {
        if(!pcppText) return;
        const lines = pcppText.split('\n');
        const newSpecs = { ...active.specs };
        let link = '';
        
        lines.forEach(l => {
            if(l.includes('pcpartpicker.com/list/')) link = l.match(/(https?:\/\/\S+)/)[0];
            
            // Fix: Simple Split by ': ' to find Category vs Name
            // Example: "CPU: AMD Ryzen 7..."
            const splitIdx = l.indexOf(': ');
            if(splitIdx > -1) {
                const catRaw = l.substring(0, splitIdx).trim();
                const rest = l.substring(splitIdx + 2).trim();
                
                // Match Category
                const cat = SPEC_CATS.find(c => c.toLowerCase() === catRaw.toLowerCase()) || (catRaw==='Video Card'?'Video Card':null);
                
                if(cat) {
                    // Extract Price from ($511.82 ...)
                    const priceMatch = rest.match(/\(\$([\d\.]+)/);
                    const priceEstimate = priceMatch ? parseFloat(priceMatch[1]) : 0;
                    
                    // Extract Name (everything before the price parenthesis)
                    const name = rest.split('($')[0].trim();
                    
                    // Auto Match with Inventory for COST
                    const dbItem = findBestMatch(name, data.inv);
                    
                    newSpecs[cat] = {
                        name: name,
                        sku: dbItem?.sku || '',
                        cost: dbItem?.cost || 0, // Fill actual cost from inventory if match
                        qty: 1
                    };
                }
            }
        });
        
        setActive(p => ({ ...p, specs: newSpecs, pcppLink: link || p.pcppLink }));
        notify('PCPP Data Applied');
    };

    if(view === 'detail') return (
        <div className="p-4 max-w-4xl mx-auto pb-32 animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-4">
                <button onClick={()=>setView('list')} className="text-slate-400 font-bold text-xs flex items-center gap-1"><ChevronLeft size={16}/> BACK</button>
                <div className="flex gap-2">
                    {active.trackingNumber && <a href={`https://www.ups.com/track?tracknum=${active.trackingNumber}`} target="_blank" className="bg-amber-100 text-amber-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1"><Truck size={14}/> Track UPS</a>}
                    <button onClick={save} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-lg">Save</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="font-black uppercase text-xs mb-4 text-slate-400">Identity</h3>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div><label className="l">WeChat Name</label><input className="i" value={active.wechatName} onChange={e=>setActive({...active, wechatName:e.target.value})}/></div>
                            <div><label className="l">Real Name</label><input className="i" value={active.realName||''} onChange={e=>setActive({...active, realName:e.target.value})}/></div>
                            <div><label className="l">WeChat ID</label><input className="i" value={active.wechatId||''} onChange={e=>setActive({...active, wechatId:e.target.value})}/></div>
                            <div><label className="l">Status</label><select className="i" value={active.status} onChange={e=>setActive({...active, status:e.target.value})}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={()=>setActive({...active, isShipping:!active.isShipping})}>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${active.isShipping?'bg-blue-600':'bg-slate-200'}`}><div className={`w-3 h-3 bg-white rounded-full transition-transform ${active.isShipping?'translate-x-4':''}`}/></div>
                                <span className="text-[10px] font-black uppercase text-slate-500">Shipping Required</span>
                            </div>
                            {active.isShipping ? (
                                <div className="grid grid-cols-4 gap-2 animate-in fade-in">
                                    <div className="col-span-4"><label className="l">Address</label><input className="i" value={active.address||''} onChange={e=>setActive({...active, address:e.target.value})}/></div>
                                    <div className="col-span-2"><label className="l">City</label><input className="i" value={active.city||''} onChange={e=>setActive({...active, city:e.target.value})}/></div>
                                    <div className="col-span-1"><label className="l">State</label><input className="i" value={active.state||''} onChange={e=>setActive({...active, state:e.target.value})}/></div>
                                    <div className="col-span-1"><label className="l">Zip</label><input className="i" value={active.zip||''} onChange={e=>setActive({...active, zip:e.target.value})}/></div>
                                    <div className="col-span-4"><label className="l">Tracking #</label><input className="i" value={active.trackingNumber||''} onChange={e=>setActive({...active, trackingNumber:e.target.value})}/></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                     <div><label className="l">City</label><input className="i" value={active.city||''} onChange={e=>setActive({...active, city:e.target.value})}/></div>
                                     <div><label className="l">Zip</label><input className="i" value={active.zip||''} onChange={e=>setActive({...active, zip:e.target.value})}/></div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
                        <div className="flex justify-between items-center">
                            <div><label className="l text-slate-500">Sale Price</label><div className="flex text-2xl font-black"><span className="text-slate-600 mr-1">$</span><input className="bg-transparent w-full outline-none" value={active.totalPrice||''} onChange={e=>setActive({...active, totalPrice:parseFloat(e.target.value)})}/></div></div>
                            <div className="text-right"><label className="l text-slate-500">Net Profit</label><div className="text-2xl font-black text-emerald-400">{formatMoney((active.totalPrice||0)-(Object.values(active.specs).reduce((a,b)=>a+(b.cost||0),0)))}</div></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="font-black uppercase text-xs mb-3 text-slate-400">Build Spec</h3>
                    <div className="mb-4">
                        <textarea className="w-full h-24 bg-slate-50 rounded-xl p-3 text-[10px] font-mono outline-none mb-2" placeholder="Paste PCPartPicker List..." value={pcppText} onChange={e=>setPcppText(e.target.value)}/>
                        <button onClick={parsePCPP} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200">Parse & Auto Match</button>
                    </div>
                    <div className="space-y-1">
                        {SPEC_CATS.map(cat => {
                            const item = active.specs[cat];
                            return (
                                <div key={cat} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-50">
                                    <div className="col-span-2 text-[9px] font-black text-slate-400 uppercase">{cat}</div>
                                    <div className="col-span-6"><input className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-200" placeholder="Empty" value={item?.name||''} onChange={e=>setActive(p=>({...p, specs:{...p.specs, [cat]:{...item, name:e.target.value}}}))}/></div>
                                    <div className="col-span-2 text-[9px] text-slate-400 truncate">{item?.sku}</div>
                                    <div className="col-span-2 flex justify-end">
                                        <input type="number" className="w-16 text-xs font-bold text-right text-emerald-600 bg-transparent outline-none" placeholder="$0" value={item?.cost||''} onChange={e=>setActive(p=>({...p, specs:{...p.specs, [cat]:{...item, cost:parseFloat(e.target.value)}}}))}/>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 max-w-4xl mx-auto">
             <div className="flex gap-4 mb-6">
                 <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                     <Search size={16} className="ml-2 text-slate-400"/>
                     <input className="w-full text-xs font-bold outline-none" placeholder="Search Clients..." value={search} onChange={e=>setSearch(e.target.value)}/>
                 </div>
                 <button onClick={handleNew} className="bg-slate-900 text-white px-4 rounded-xl shadow-lg active:scale-95"><Plus/></button>
             </div>
             <div className="space-y-3">
                 {data.clients.filter(c => c.wechatName.toLowerCase().includes(search.toLowerCase())).map(c => (
                     <div key={c.id} onClick={()=>{setActive(c); setView('detail');}} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-blue-200">
                         <div>
                             <div className="font-black text-sm text-slate-800">{c.wechatName} <span className="text-slate-400 font-normal">| {c.realName}</span></div>
                             <div className="flex gap-2 mt-1">
                                 <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${c.status==='Delivered'?'bg-emerald-100 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{c.status}</span>
                                 <span className="text-[9px] font-bold text-slate-400">{new Date(c.orderDate).toLocaleDateString()}</span>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="font-black text-sm text-slate-900">{formatMoney(c.totalPrice)}</div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};

const s = document.createElement('style');
s.innerHTML = `.l{font-size:9px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-left:2px;display:block}.i{width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.4rem;font-size:11px;font-weight:700;outline:none;transition:all}.i:focus{background:#fff;border-color:#cbd5e1}`;
document.head.appendChild(s);