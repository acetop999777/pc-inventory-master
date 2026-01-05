import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, X, Search, CheckCircle, 
  AlertCircle, History, Activity, TrendingUp, UserPlus, ArrowRight, Zap, 
  Loader2, Scan, ChevronLeft, Save, Filter, MapPin, Calendar, Smartphone,
  MoreHorizontal, Plus, Trash2, Edit3, DollarSign
} from 'lucide-react';

/**
 * Project: PC Inventory Master
 * Version: 3.0.0 Titanium Edition
 * Features: WAC, Newegg Algo, High-Density UI, Mobile Optimized
 */

const API_BASE = `http://${window.location.hostname}:5001/api`;
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : '-';

// --- Constants ---
const ORDER_FIELDS = [
  'CPU', 'CPU Cooler', 'Motherboard', 'Memory', 'Storage', 'Video Card', 'Case', 'Power Supply', 
  'Case Fan', 'Monitor', 'Strimer', 'Labor'
];
const CAT_DISPLAY = {
  'CPU': 'CPU', 'CPU Cooler': 'Cooler', 'Motherboard': 'MB', 'Memory': 'RAM', 'Storage': 'SSD',
  'Video Card': 'GPU', 'Case': 'Case', 'Power Supply': 'PSU', 'Case Fan': 'Fan', 'Monitor': 'Mon',
  'Strimer': 'Acc', 'Labor': 'Work', 'Other': 'Other'
};
const ALL_CATS = Object.keys(CAT_DISPLAY);

// --- API Methods ---
async function apiGet(endpoint) {
    try { const res = await fetch(`${API_BASE}${endpoint}`); return await res.json(); } catch (e) { return []; }
}
async function apiPost(endpoint, body) {
    try { await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { console.error(e); }
}
async function fetchUpcItem(code) {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
    if (res.ok) {
        const data = await res.json();
        if (data.items?.length > 0) return { name: data.items[0].title, category: data.items[0].category?.split('>')[0].trim() || 'Other' };
    }
  } catch (e) {}
  return null;
}

// --- Main App ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [inv, cl, lg] = await Promise.all([apiGet('/inventory'), apiGet('/clients'), apiGet('/logs')]);
    if(inv) setInventory(inv);
    if(cl) setClients(cl);
    if(lg) setLogs(lg);
  };

  const notify = (msg, type = 'success') => {
    const id = generateId();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  const logEvent = (type, title, msg, meta = {}) => {
    const newLog = { id: generateId(), timestamp: Date.now(), type, title, msg, meta };
    setLogs(prev => [newLog, ...prev]);
    apiPost('/logs', newLog);
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard clients={clients} inventory={inventory} logs={logs} />;
      case 'clients': return <ClientHub clients={clients} inventory={inventory} setClients={setClients} logEvent={logEvent} notify={notify} refresh={loadData} />;
      case 'scan': return <IntakeNode inventory={inventory} setInventory={setInventory} logEvent={logEvent} notify={notify} refresh={loadData} />;
      case 'stock': return <StockVault inventory={inventory} setInventory={setInventory} logs={logs} logEvent={logEvent} notify={notify} refresh={loadData} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F1F5F9] text-slate-900 font-sans overflow-hidden select-none">
      {/* Notifications */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-5 ${n.type === 'error' ? 'bg-red-50/90 border-red-100 text-red-600' : 'bg-emerald-50/90 border-emerald-100 text-emerald-600'}`}>
            {n.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle size={16}/>} {n.msg}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-28 no-scrollbar touch-pan-y">{renderContent()}</div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-200 pb-safe pt-2">
        <div className="flex justify-around items-center max-w-md mx-auto h-16">
          <NavBtn icon={LayoutDashboard} label="Dash" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')}/>
          <NavBtn icon={Users} label="Clients" active={activeTab==='clients'} onClick={()=>setActiveTab('clients')}/>
          <NavBtn icon={ScanLine} label="Inbound" active={activeTab==='scan'} onClick={()=>setActiveTab('scan')}/>
          <NavBtn icon={Package} label="Inventory" active={activeTab==='stock'} onClick={()=>setActiveTab('stock')}/>
        </div>
      </div>
    </div>
  );
}

const NavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-16 transition-all ${active ? 'text-slate-900 scale-105' : 'text-slate-400'}`}>
    <div className={`p-1.5 rounded-full ${active ? 'bg-slate-100' : ''}`}><Icon size={22} strokeWidth={active?2.5:2} /></div>
    <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

// --------------------------------------------------------------------------------
// VIEW: INTAKE NODE (Newegg Parser + Batch Scanner)
// --------------------------------------------------------------------------------
const IntakeNode = ({ inventory, setInventory, logEvent, notify, refresh }) => {
  const [mode, setMode] = useState('scan'); // 'scan' | 'newegg'
  const [batch, setBatch] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [neweggText, setNeweggText] = useState('');

  // 1. Scan/Manual Logic
  const handleScan = async (e) => {
    e.preventDefault();
    const code = inputVal.trim();
    if(!code) return;
    
    // Check existing in batch
    const inBatchIdx = batch.findIndex(i => i.sku === code);
    if(inBatchIdx >= 0) {
      const n = [...batch]; n[inBatchIdx].qtyInput += 1;
      setBatch(n);
    } else {
      // Check Inventory DB
      const dbMatch = inventory.find(i => i.sku === code || i.keyword === code);
      if(dbMatch) {
        setBatch(prev => [{ ...dbMatch, qtyInput: 1, costInput: 0, isNew: false }, ...prev]);
      } else {
        // API Lookup
        const apiData = await fetchUpcItem(code);
        setBatch(prev => [{
          id: generateId(), category: apiData?.category || 'Other', name: apiData?.name || 'New Item',
          keyword: '', sku: code, quantity: 0, cost: 0, qtyInput: 1, costInput: 0, isNew: true
        }, ...prev]);
      }
    }
    setInputVal('');
  };

  // 2. Newegg Logic (The complex math)
  const parseNewegg = () => {
    try {
      const lines = neweggText.split('\n').map(l=>l.trim()).filter(l=>l);
      // Find Grand Total
      const grandTotalMatch = neweggText.match(/Grand Total\s*\$?([\d,]+\.\d{2})/);
      const grandTotal = grandTotalMatch ? parseFloat(grandTotalMatch[1].replace(/,/g,'')) : 0;
      
      let parsed = [];
      for(let i=0; i<lines.length; i++) {
        if(lines[i].startsWith('Item #:')) {
          const sku = lines[i].split(':')[1].trim();
          let name = lines[i-1];
          if(name.includes('Return Policy') || name.startsWith('COMBO')) name = lines[i-2];
          
          let qty = 1; let listedPrice = 0; const isGift = lines.slice(Math.max(0,i-4), i).some(l=>l.includes('Free Gift'));
          
          // Heuristic search for Price
          for(let j=1; j<=8; j++) {
            const txt = lines[i+j] || "";
            if(/^\d+$/.test(txt) && lines[i+j+1]?.startsWith('$')) qty = parseInt(txt);
            if(txt.startsWith('$') && !txt.includes('ea.')) { listedPrice = parseFloat(txt.replace(/[$,]/g,'')); break; }
          }

          // Fuzzy Match with existing DB
          const dbMatch = inventory.find(inv => 
            inv.sku === sku || inv.name.toLowerCase().includes(name.toLowerCase().substr(0, 15)) || (inv.keyword && name.toLowerCase().includes(inv.keyword.toLowerCase()))
          );

          parsed.push({
            id: dbMatch ? dbMatch.id : generateId(),
            category: dbMatch?.category || 'Other',
            name: dbMatch?.name || name,
            keyword: dbMatch?.keyword || '',
            sku: dbMatch?.sku || sku,
            quantity: dbMatch?.quantity || 0,
            cost: dbMatch?.cost || 0,
            qtyInput: qty,
            listedPrice,
            isGift,
            isNew: !dbMatch
          });
        }
      }

      // Calculate Weighted Cost
      const validItems = parsed.filter(i => !i.isGift);
      const sumListed = validItems.reduce((acc, i) => acc + i.listedPrice, 0);
      
      parsed = parsed.map(item => {
        let finalCost = 0;
        if(!item.isGift && sumListed > 0) {
          // Formula: (ItemListed / SumListed) * GrandTotal / Quantity
          finalCost = ((item.listedPrice / sumListed) * grandTotal) / item.qtyInput;
        }
        return { ...item, costInput: parseFloat(finalCost.toFixed(2)) };
      });

      setBatch(parsed);
      setMode('scan'); // Switch to review view
      setNeweggText('');
      notify(`Parsed ${parsed.length} items from Newegg`);

    } catch(e) { notify('Newegg Parse Failed', 'error'); }
  };

  const commitBatch = async () => {
    const payload = batch.map(item => {
        const qInput = parseInt(item.qtyInput)||0;
        const cInput = parseFloat(item.costInput)||0;
        
        // WAC Calculation: (OldQty * OldCost + InputQty * InputCost) / TotalQty
        const oldTotalVal = item.quantity * item.cost;
        const newTotalVal = qInput * cInput;
        const finalQty = item.quantity + qInput;
        const finalCost = finalQty > 0 ? (oldTotalVal + newTotalVal) / finalQty : 0;

        return {
            ...item,
            quantity: finalQty,
            cost: parseFloat(finalCost.toFixed(2))
        };
    });

    await apiPost('/inventory/batch', payload);
    logEvent('STOCK_IN', 'Batch Import', `Added ${batch.length} SKUs`);
    setBatch([]);
    notify('Inventory Updated Successfully');
    refresh();
  };

  const removeBatchItem = (idx) => {
    setBatch(prev => prev.filter((_, i) => i !== idx));
  };

  const updateBatchItem = (idx, field, val) => {
    setBatch(prev => {
        const n = [...prev];
        n[idx] = { ...n[idx], [field]: val };
        return n;
    });
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
       <div className="flex gap-2 mb-6">
         <button onClick={()=>setMode('scan')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase transition-all ${mode==='scan'?'bg-slate-900 text-white shadow-lg':'bg-white text-slate-400'}`}>Scanner / Manual</button>
         <button onClick={()=>setMode('newegg')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase transition-all ${mode==='newegg'?'bg-slate-900 text-white shadow-lg':'bg-white text-slate-400'}`}>Newegg Import</button>
       </div>

       {mode === 'newegg' ? (
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
           <textarea className="w-full h-64 bg-slate-50 rounded-xl p-4 text-[10px] font-mono outline-none resize-none" placeholder="Paste Newegg Order Page Text..." value={neweggText} onChange={e=>setNeweggText(e.target.value)}/>
           <button onClick={parseNewegg} className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200">Analyze & Extract</button>
         </div>
       ) : (
         <>
           <form onSubmit={handleScan} className="mb-6 relative">
             <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
             <input autoFocus className="w-full bg-white pl-12 pr-4 py-4 rounded-2xl shadow-sm border border-slate-200 outline-none font-mono font-bold uppercase placeholder:text-slate-300" placeholder="SCAN SKU / KEYWORD..." value={inputVal} onChange={e=>setInputVal(e.target.value)} />
           </form>

           <div className="space-y-3">
             {batch.map((item, idx) => {
               // Real-time Preview Calculation
               const oldVal = item.quantity * item.cost;
               const addVal = (parseInt(item.qtyInput)||0) * (parseFloat(item.costInput)||0);
               const finalQ = item.quantity + (parseInt(item.qtyInput)||0);
               const finalWAC = finalQ > 0 ? (oldVal + addVal)/finalQ : 0;

               return (
                <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
                   <div className="flex justify-between items-start gap-2">
                     <div className="flex-1">
                       <input className="w-full font-black text-sm text-slate-800 bg-transparent outline-none" value={item.name} onChange={e=>updateBatchItem(idx, 'name', e.target.value)} />
                       <div className="flex items-center gap-2 mt-1">
                         <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 rounded">{item.quantity} in stock</span>
                         <span className="text-[9px] font-bold text-slate-300">WAC ${item.cost}</span>
                         <ArrowRight size={10} className="text-slate-300"/>
                         <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded border border-blue-100">New WAC ${finalWAC.toFixed(2)}</span>
                       </div>
                     </div>
                     <button onClick={()=>removeBatchItem(idx)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-2">
                     <div className="col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Cat</label>
                        <select className="w-full bg-slate-50 rounded-lg p-2 text-[10px] font-bold uppercase outline-none" value={item.category} onChange={e=>updateBatchItem(idx, 'category', e.target.value)}>
                          {ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                     <div className="col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Key</label>
                        <input className="w-full bg-slate-50 rounded-lg p-2 text-[10px] font-bold uppercase outline-none text-center" value={item.keyword} onChange={e=>updateBatchItem(idx, 'keyword', e.target.value)} placeholder="#TAG"/>
                     </div>
                     <div className="col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Add Qty</label>
                        <input type="number" className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-2 text-[10px] font-black text-blue-700 outline-none text-center" value={item.qtyInput || ''} onChange={e=>updateBatchItem(idx, 'qtyInput', parseInt(e.target.value))} />
                     </div>
                     <div className="col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Cost Ea</label>
                        <input type="number" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-[10px] font-black text-emerald-700 outline-none text-center" value={item.costInput || ''} onChange={e=>updateBatchItem(idx, 'costInput', parseFloat(e.target.value))} />
                     </div>
                   </div>
                </div>
               );
             })}
           </div>
           
           {batch.length > 0 && (
             <div className="fixed bottom-20 left-4 right-4 z-40">
                <button onClick={commitBatch} className="w-full bg-slate-900 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-2xl shadow-slate-300 active:scale-95 transition-all">
                  Commit To Vault ({batch.length})
                </button>
             </div>
           )}
         </>
       )}
    </div>
  );
};

// --------------------------------------------------------------------------------
// VIEW: CLIENT HUB (Orders, Specs, Profit)
// --------------------------------------------------------------------------------
const ClientHub = ({ clients, inventory, setClients, logEvent, notify, refresh }) => {
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [activeClient, setActiveClient] = useState(null);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Client Logic
  const handleNewClient = () => {
    const fresh = { 
        id: generateId(), wechatName: 'New Client', status: 'Inquiry', orderDate: new Date().toISOString().split('T')[0], 
        specs: {}, actualCost: 0, laborCost: 0, totalPrice: 0
    };
    setActiveClient(fresh);
    setView('detail');
  };

  const parsePCPartPicker = (text) => {
     if(!text) return;
     const lines = text.split('\n');
     const newSpecs = { ...activeClient.specs };
     
     lines.forEach(line => {
        // Regex for: "Type: Name ($Price ...)"
        const match = line.match(/^([a-zA-Z\s]+):\s+(.+?)\s+(?:-|@|–)\s+\$/);
        if(match) {
            let type = match[1].trim();
            const name = match[2].trim();
            // Map PCPP types to our types
            if(type==='Video Card') type = 'Video Card'; // already matches
            if(ORDER_FIELDS.includes(type)) {
               newSpecs[type] = { name, sku: '', cost: 0, price: 0 }; 
            }
        }
     });
     setActiveClient(prev => ({ ...prev, specs: newSpecs }));
     notify('Specs Extracted');
  };

  const autoFillSpec = (category, code) => {
     const match = inventory.find(i => i.sku === code || i.keyword === code);
     if(match) {
        setActiveClient(prev => ({
            ...prev,
            specs: {
                ...prev.specs,
                [category]: { ...prev.specs[category], name: match.name, cost: match.cost, sku: match.sku }
            },
            actualCost: calculateTotalCost(prev.specs, match.cost, category)
        }));
        notify(`Matched: ${match.name}`);
     } else {
        notify('No match in Vault', 'error');
     }
  };

  const calculateTotalCost = (specs, newCost, cat) => {
      let total = 0;
      ORDER_FIELDS.forEach(f => {
          if(f === cat) total += newCost;
          else if(specs[f]?.cost) total += specs[f].cost;
      });
      return total;
  };

  const saveClient = async () => {
      // Recalculate financial totals
      let calcCost = activeClient.laborCost || 0;
      ORDER_FIELDS.forEach(f => { if(activeClient.specs[f]?.cost) calcCost += activeClient.specs[f].cost; });
      const profit = (activeClient.totalPrice || 0) - calcCost;
      
      const toSave = { ...activeClient, actualCost: calcCost, profit };
      await apiPost('/clients', toSave);
      
      logEvent('ORDER_UPDATE', 'Client Saved', `${toSave.wechatName}`);
      notify('Client Profile Saved');
      refresh();
      setView('list');
  };

  // Filter Logic
  const filteredClients = clients.filter(c => {
     const s = search.toLowerCase();
     const matchesSearch = c.wechatName?.toLowerCase().includes(s) || c.source?.toLowerCase().includes(s);
     const matchesMonth = filterMonth ? c.orderDate?.startsWith(filterMonth) : true;
     return matchesSearch && matchesMonth;
  });

  const stats = useMemo(() => {
     return {
        count: filteredClients.length,
        profit: filteredClients.reduce((acc, c) => acc + (c.profit || 0), 0)
     };
  }, [filteredClients]);

  if(view === 'detail') return (
    <div className="p-4 max-w-2xl mx-auto pb-32 animate-in slide-in-from-right">
       <div className="flex justify-between items-center mb-6">
          <button onClick={()=>setView('list')} className="flex items-center gap-1 text-slate-400 font-bold uppercase text-[10px] tracking-widest"><ChevronLeft size={14}/> Back</button>
          <div className="font-black text-lg">{activeClient.wechatName}</div>
          <button onClick={saveClient} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg active:scale-95"><Save size={16}/></button>
       </div>

       {/* Profile Card */}
       <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2"><label className="lbl">WeChat Name</label><input className="inp" value={activeClient.wechatName} onChange={e=>setActiveClient({...activeClient, wechatName:e.target.value})}/></div>
             <div><label className="lbl">Source</label><select className="inp" value={activeClient.source} onChange={e=>setActiveClient({...activeClient, source:e.target.value})}><option>Friend</option><option>XHS</option><option>WeChat</option></select></div>
             <div><label className="lbl">Status</label><select className="inp" value={activeClient.status} onChange={e=>setActiveClient({...activeClient, status:e.target.value})}><option>Inquiry</option><option>Paid</option><option>Building</option><option>Delivered</option></select></div>
             <div><label className="lbl">Order Date</label><input type="date" className="inp" value={activeClient.orderDate?.split('T')[0]} onChange={e=>setActiveClient({...activeClient, orderDate:e.target.value})}/></div>
             <div><label className="lbl">Delivery Date</label><input type="date" className="inp" value={activeClient.deliveryDate?.split('T')[0] || ''} onChange={e=>setActiveClient({...activeClient, deliveryDate:e.target.value})}/></div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
             <div className="grid grid-cols-6 gap-2">
                 <div className="col-span-4"><label className="lbl">Address Line</label><input className="inp" placeholder="123 Main St" value={activeClient.address||''} onChange={e=>setActiveClient({...activeClient, address:e.target.value})}/></div>
                 <div className="col-span-2"><label className="lbl">Zip Code</label><input className="inp" placeholder="94043" value={activeClient.zip||''} onChange={e=>setActiveClient({...activeClient, zip:e.target.value})}/></div>
                 <div className="col-span-3"><label className="lbl">City</label><input className="inp" value={activeClient.city||''} onChange={e=>setActiveClient({...activeClient, city:e.target.value})}/></div>
                 <div className="col-span-3"><label className="lbl">State</label><input className="inp" value={activeClient.state||''} onChange={e=>setActiveClient({...activeClient, state:e.target.value})}/></div>
             </div>
          </div>
       </div>

       {/* Specs Builder */}
       <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Build Manifest</h3>
             <button onClick={()=>parsePCPartPicker(prompt("Paste PCPartPicker Text:"))} className="text-[9px] bg-slate-100 px-2 py-1 rounded font-bold uppercase text-slate-500">Paste List</button>
          </div>
          
          <div className="space-y-3">
             {ORDER_FIELDS.map(cat => {
                 const item = activeClient.specs?.[cat] || {};
                 return (
                     <div key={cat} className="flex flex-col gap-1 border-b border-slate-50 pb-2 last:border-0">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase w-16">{CAT_DISPLAY[cat]}</span>
                            <input className="flex-1 text-xs font-bold text-slate-700 bg-transparent outline-none truncate" placeholder="Empty Slot" value={item.name || ''} onChange={e=>setActiveClient(p=>({ ...p, specs: { ...p.specs, [cat]: { ...item, name: e.target.value } } }))} />
                        </div>
                        <div className="flex gap-2 pl-16">
                            <input className="w-24 bg-slate-50 rounded px-2 py-1 text-[9px] font-mono" placeholder="Scan SKU/Tag" onKeyDown={e=>{ if(e.key==='Enter') autoFillSpec(cat, e.target.value) }} />
                            <div className="flex items-center gap-1 bg-emerald-50 px-2 rounded">
                                <span className="text-[9px] text-emerald-600">$</span>
                                <input type="number" className="w-12 bg-transparent text-[9px] font-bold text-emerald-600 outline-none" value={item.cost || ''} onChange={e=>setActiveClient(p=>({ ...p, specs: { ...p.specs, [cat]: { ...item, cost: parseFloat(e.target.value) } } }))} placeholder="Cost"/>
                            </div>
                        </div>
                     </div>
                 );
             })}
          </div>
       </div>

       {/* Financials */}
       <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl text-white">
          <div className="grid grid-cols-2 gap-8 mb-4">
             <div><label className="text-[9px] font-bold text-slate-500 uppercase">Sale Price</label><input type="number" className="bg-transparent text-2xl font-black w-full outline-none" value={activeClient.totalPrice || ''} onChange={e=>setActiveClient({...activeClient, totalPrice:parseFloat(e.target.value)})}/></div>
             <div><label className="text-[9px] font-bold text-slate-500 uppercase">Labor Cost</label><input type="number" className="bg-transparent text-2xl font-black w-full outline-none" value={activeClient.laborCost || ''} onChange={e=>setActiveClient({...activeClient, laborCost:parseFloat(e.target.value)})}/></div>
          </div>
          <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
             <div><div className="text-[9px] font-bold text-slate-500 uppercase">Net Profit</div><div className={`text-3xl font-black tracking-tight ${((activeClient.totalPrice||0)-(activeClient.actualCost||0)) > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>{formatCurrency((activeClient.totalPrice||0)-(activeClient.laborCost||0)-(Object.values(activeClient.specs||{}).reduce((a,b)=>a+(b.cost||0),0)))}</div></div>
             <div className="text-right"><div className="text-[9px] font-bold text-slate-500 uppercase">Parts Cost</div><div className="text-xl font-bold text-slate-400">{formatCurrency(Object.values(activeClient.specs||{}).reduce((a,b)=>a+(b.cost||0),0))}</div></div>
          </div>
       </div>
    </div>
  );

  return (
    <div className="p-4 max-w-3xl mx-auto">
       <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 text-slate-300" size={16}/>
             <input className="w-full bg-white pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none shadow-sm" placeholder="Search Client / Source..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <input type="month" className="bg-white px-3 rounded-xl text-xs font-bold outline-none shadow-sm w-32" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} />
          <button onClick={handleNewClient} className="bg-slate-900 text-white w-10 rounded-xl flex items-center justify-center shadow-lg"><Plus size={20}/></button>
       </div>
       
       {/* Stats Bar */}
       <div className="flex gap-4 mb-6 px-2">
           <div><div className="text-[9px] font-bold text-slate-400 uppercase">Clients</div><div className="text-lg font-black">{stats.count}</div></div>
           <div><div className="text-[9px] font-bold text-slate-400 uppercase">Period Profit</div><div className="text-lg font-black text-emerald-600">{formatCurrency(stats.profit)}</div></div>
       </div>

       <div className="space-y-3">
          {filteredClients.map(c => (
             <div key={c.id} onClick={()=>{setActiveClient(c); setView('detail');}} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-transform">
                <div>
                   <div className="font-black text-sm text-slate-800">{c.wechatName}</div>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${c.status==='Delivered'?'bg-emerald-100 text-emerald-600':'bg-blue-50 text-blue-500'}`}>{c.status}</span>
                      <span className="text-[9px] font-bold text-slate-400">{formatDate(c.orderDate)}</span>
                      {c.state === 'CA' && <span className="text-[9px] font-bold text-amber-500">CA TAX</span>}
                   </div>
                </div>
                <div className="text-right">
                   <div className="font-black text-sm text-slate-900">{formatCurrency(c.totalPrice)}</div>
                   <div className="text-[9px] font-bold text-emerald-500">+{formatCurrency(c.profit)}</div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// VIEW: STOCK VAULT (Simple List + History)
// --------------------------------------------------------------------------------
const StockVault = ({ inventory, logs, logEvent }) => {
    const [filter, setFilter] = useState('');
    const [historyItem, setHistoryItem] = useState(null);

    const filtered = inventory.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.keyword?.includes(filter));

    return (
      <div className="p-4 max-w-3xl mx-auto">
         <input className="w-full bg-white px-4 py-3 rounded-xl text-xs font-bold outline-none shadow-sm mb-4 border border-slate-100" placeholder="Filter Vault..." value={filter} onChange={e=>setFilter(e.target.value)}/>
         
         <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             {filtered.map((item, idx) => (
                 <div key={item.id} onClick={()=>setHistoryItem(item)} className={`flex items-center p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer`}>
                    <div className="w-12 text-center text-[9px] font-black text-slate-400 uppercase">{item.category}</div>
                    <div className="flex-1 px-3 min-w-0">
                        <div className="font-bold text-xs text-slate-800 truncate">{item.name}</div>
                        <div className="text-[9px] font-mono text-slate-400">{item.keyword}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-black text-xs text-slate-800">{item.quantity} units</div>
                        <div className="text-[9px] font-bold text-slate-400">@ {formatCurrency(item.cost)}</div>
                    </div>
                 </div>
             ))}
         </div>

         {/* History Modal */}
         {historyItem && (
             <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in">
                 <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 h-[60vh] flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <div className="font-black text-lg truncate pr-4">{historyItem.name}</div>
                        <button onClick={()=>setHistoryItem(null)}><X size={20}/></button>
                     </div>
                     <div className="flex-1 overflow-y-auto space-y-4">
                        {logs.filter(l => l.title.includes(historyItem.name) || (l.meta && (l.meta.id === historyItem.id || l.title.includes(historyItem.keyword)))).length === 0 ? <div className="text-center text-xs text-slate-300 py-10">No records found</div> : 
                            logs.filter(l => l.title.includes(historyItem.name) || (l.meta && (l.meta.id === historyItem.id))).map(log => (
                                <div key={log.id} className="text-xs border-l-2 border-slate-200 pl-3">
                                    <div className="font-bold text-slate-700">{log.type}</div>
                                    <div className="text-slate-500">{log.msg}</div>
                                    <div className="text-[9px] text-slate-300 mt-1">{formatDate(log.timestamp)}</div>
                                </div>
                            ))
                        }
                     </div>
                 </div>
             </div>
         )}
      </div>
    );
};

// --------------------------------------------------------------------------------
// VIEW: DASHBOARD (Simple Stats)
// --------------------------------------------------------------------------------
const Dashboard = ({ clients, inventory }) => {
    const stockVal = inventory.reduce((a, b) => a + (b.cost * b.quantity), 0);
    const pendingOrders = clients.filter(c => c.status !== 'Delivered').length;
    
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900">Console</h1>
                <p className="text-xs font-bold text-slate-400">System Online • v3.0.0</p>
            </header>
            <div className="grid grid-cols-2 gap-4">
                <DashCard label="Vault Value" val={formatCurrency(stockVal)} icon={Package} color="text-blue-600" bg="bg-blue-50"/>
                <DashCard label="Pending Orders" val={pendingOrders} icon={Users} color="text-amber-600" bg="bg-amber-50"/>
            </div>
            {/* Add more widgets as needed */}
        </div>
    );
};

const DashCard = ({ label, val, icon: Icon, color, bg }) => (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg} ${color}`}><Icon size={20}/></div>
        <div className="text-2xl font-black text-slate-800">{val}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase">{label}</div>
    </div>
);

// Styles
const css = `
  .lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-left: 2px; margin-bottom: 2px; display: block; }
  .inp { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 11px; font-weight: 700; color: #334155; outline: none; transition: all; }
  .inp:focus { border-color: #94a3b8; background: #fff; }
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
`;
document.head.appendChild(document.createElement("style")).innerHTML = css;