import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, Search, CheckCircle, AlertCircle, 
  History, TrendingUp, Plus, Minus, Filter, Save, X, ExternalLink, MapPin, 
  Truck, Calendar, Hash, ChevronRight, DollarSign, Box, Cpu, ChevronDown
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Project: PC Inventory Master
 * Version: 4.0.0 Platinum
 */

const API_BASE = `http://${window.location.hostname}:5001/api`;
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// Data Constants
const SPEC_CATS = ['CPU', 'CPU Cooler', 'Motherboard', 'Memory', 'Storage', 'Video Card', 'Case', 'Power Supply', 'Case Fan', 'Monitor', 'Custom', 'Labor'];
const CAT_ICONS = { 'CPU': Cpu, 'Video Card': Box, 'Motherboard': Box, 'Other': Box };

// --- API Helper ---
async function apiCall(url, method='GET', body=null) {
    try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if(body) opts.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${url}`, opts);
        return await res.json();
    } catch(e) { return null; }
}

// --- Fuzzy Match Logic ---
function findBestMatch(targetName, inventory) {
    if(!targetName) return null;
    const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestScore = 0; 
    let bestMatch = null;

    inventory.forEach(item => {
        let score = 0;
        const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanKey = (item.keyword || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // 1. Direct inclusion (Strongest)
        if(cleanTarget.includes(cleanName) || cleanName.includes(cleanTarget)) score += 50;
        // 2. Keyword match
        if(cleanKey && cleanTarget.includes(cleanKey)) score += 30;
        // 3. Simple token match
        const targetTokens = targetName.split(' ');
        targetTokens.forEach(t => { if(item.name.toLowerCase().includes(t.toLowerCase()) && t.length > 2) score += 2; });

        if(score > bestScore) { bestScore = score; bestMatch = item; }
    });

    return bestScore > 10 ? bestMatch : null;
}

export default function App() {
  const [tab, setTab] = useState('dash');
  const [data, setData] = useState({ inv: [], clients: [], logs: [] });
  const [toast, setToast] = useState([]);

  useEffect(() => { refreshData(); }, []);
  const refreshData = async () => {
    const [inv, cl, lg] = await Promise.all([apiCall('/inventory'), apiCall('/clients'), apiCall('/logs')]);
    setData({ inv: inv || [], clients: cl || [], logs: lg || [] });
  };
  const notify = (msg, type='success') => {
    const id = generateId(); setToast(p => [...p, {id, msg, type}]);
    setTimeout(() => setToast(p => p.filter(x => x.id !== id)), 3000);
  };
  const log = (type, title, msg) => apiCall('/logs', 'POST', { id: generateId(), timestamp: Date.now(), type, title, msg });

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Toast */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] space-y-2">
         {toast.map(t => <div key={t.id} className={`px-4 py-2 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 ${t.type==='error'?'bg-red-50 text-red-600':'bg-emerald-50 text-emerald-600'}`}>{t.type==='error'?<AlertCircle size={14}/>:<CheckCircle size={14}/>}{t.msg}</div>)}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
         {tab === 'dash' && <Dashboard data={data} />}
         {tab === 'clients' && <ClientHub data={data} refresh={refreshData} notify={notify} log={log} />}
         {tab === 'stock' && <InventoryVault data={data} refresh={refreshData} notify={notify} log={log} />}
         {tab === 'inbound' && <IntakeNode data={data} refresh={refreshData} notify={notify} log={log} />}
      </div>

      {/* Nav */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-6 py-3 flex gap-6">
           <NavIcon icon={LayoutDashboard} active={tab==='dash'} onClick={()=>setTab('dash')} label="Dash" />
           <NavIcon icon={Users} active={tab==='clients'} onClick={()=>setTab('clients')} label="Clients" />
           <NavIcon icon={ScanLine} active={tab==='inbound'} onClick={()=>setTab('inbound')} label="Inbound" />
           <NavIcon icon={Package} active={tab==='stock'} onClick={()=>setTab('stock')} label="Stock" />
        </div>
      </div>
    </div>
  );
}

const NavIcon = ({ icon: Icon, active, onClick, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
    <Icon size={22} strokeWidth={active?2.5:2}/>
    <span className="text-[9px] font-black uppercase">{label}</span>
  </button>
);

// --- COMPONENT: Dashboard ---
const Dashboard = ({ data }) => {
  const stockVal = data.inv.reduce((a, b) => a + (b.cost * b.quantity), 0);
  const rev = data.clients.reduce((a, b) => a + (b.totalPrice || 0), 0);
  const profit = data.clients.reduce((a, b) => a + (b.profit || 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
       <header>
         <h1 className="text-3xl font-black tracking-tight text-slate-900">Console</h1>
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">v4.0.0 Platinum • Neural Core</p>
       </header>
       <div className="grid grid-cols-3 gap-4">
          <Card label="Vault Value" val={formatMoney(stockVal)} color="text-blue-600" bg="bg-blue-50" icon={Package}/>
          <Card label="Total Revenue" val={formatMoney(rev)} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp}/>
          <Card label="Net Profit" val={formatMoney(profit)} color="text-violet-600" bg="bg-violet-50" icon={DollarSign}/>
       </div>
       <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="mb-4 text-xs font-black text-slate-400 uppercase tracking-widest">Recent Activity</div>
          <div className="space-y-3">
             {data.logs.slice(0, 5).map(l => (
                <div key={l.id} className="flex gap-3 items-center text-xs">
                   <div className="w-2 h-2 rounded-full bg-slate-300"/>
                   <span className="font-bold text-slate-700">{l.type}</span>
                   <span className="text-slate-500 truncate flex-1">{l.msg}</span>
                   <span className="text-slate-300 font-mono text-[10px]">{new Date(parseInt(l.timestamp)).toLocaleDateString()}</span>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};
const Card = ({ label, val, color, bg, icon: Icon }) => (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}><Icon size={20}/></div>
        <div className="text-2xl font-black text-slate-800">{val}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
);

// --- COMPONENT: Inventory Vault ---
const InventoryVault = ({ data, refresh, notify, log }) => {
    const [cat, setCat] = useState('All');
    const [modalItem, setModalItem] = useState(null); // Item being edited
    const [adjustMode, setAdjustMode] = useState('add'); // 'add' or 'sub'
    const [inputQty, setInputQty] = useState(1);
    const [inputCost, setInputCost] = useState(0);

    // Stats
    const filtered = data.inv.filter(i => cat === 'All' || i.category === cat);
    const catTotalQty = filtered.reduce((a,b)=>a+b.quantity, 0);
    const catTotalVal = filtered.reduce((a,b)=>a+(b.quantity*b.cost), 0);

    const openAdjust = (item, mode) => {
        setModalItem(item); setAdjustMode(mode); setInputQty(1); setInputCost(item.cost);
    };

    const commitAdjust = async () => {
        if(!modalItem) return;
        const qtyChange = adjustMode === 'add' ? inputQty : -inputQty;
        const finalQty = modalItem.quantity + qtyChange;
        
        let finalCost = modalItem.cost;
        if(adjustMode === 'add' && finalQty > 0) {
             // WAC Formula: (OldTotalValue + NewTotalValue) / NewTotalQty
             const oldVal = modalItem.quantity * modalItem.cost;
             const newVal = inputQty * inputCost;
             finalCost = (oldVal + newVal) / finalQty;
        }

        const payload = [{ ...modalItem, quantity: finalQty, cost: parseFloat(finalCost.toFixed(2)) }];
        await apiCall('/inventory/batch', 'POST', payload);
        log('STOCK_UPDATE', `Manual ${adjustMode}`, `${modalItem.name} qty: ${qtyChange}`);
        notify('Stock Updated');
        setModalItem(null); refresh();
    };

    return (
        <div className="p-4 max-w-4xl mx-auto">
            {/* Category Header */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {['All', ...SPEC_CATS].map(c => (
                    <button key={c} onClick={()=>setCat(c)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${cat===c?'bg-slate-900 text-white shadow-lg':'bg-white text-slate-400'}`}>{c}</button>
                ))}
            </div>
            
            {/* Cat Stats */}
            <div className="mb-4 bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div><div className="text-[10px] font-bold text-slate-400 uppercase">Category Count</div><div className="text-xl font-black text-slate-800">{catTotalQty} Units</div></div>
                <div className="text-right"><div className="text-[10px] font-bold text-slate-400 uppercase">Asset Value</div><div className="text-xl font-black text-blue-600">{formatMoney(catTotalVal)}</div></div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {filtered.map(item => (
                    <div key={item.id} className="flex items-center p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <div className="w-16 text-[9px] font-black text-slate-400 uppercase">{item.category}</div>
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="font-bold text-xs text-slate-800 truncate">{item.name}</div>
                            <div className="flex gap-2 text-[9px] font-mono text-slate-400">
                                <span>{item.keyword || '-'}</span> <span>•</span> <span>{item.sku || 'NO SKU'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="font-bold text-xs">{item.quantity} units</div>
                                <div className="text-[9px] text-slate-400 font-bold">@ {formatMoney(item.cost)}</div>
                            </div>
                            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                                <button onClick={()=>openAdjust(item, 'sub')} className="p-1 hover:bg-white rounded shadow-sm"><Minus size={14}/></button>
                                <button onClick={()=>openAdjust(item, 'add')} className="p-1 hover:bg-white rounded shadow-sm"><Plus size={14}/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Adjust Modal (WAC Calculator) */}
            {modalItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black uppercase text-xs tracking-widest">{adjustMode === 'add' ? 'Stock In (WAC)' : 'Stock Out'}</h3>
                            <button onClick={()=>setModalItem(null)}><X size={20}/></button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl mb-4 text-xs font-bold text-slate-700 truncate">{modalItem.name}</div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Quantity</label>
                                <input type="number" className="w-full bg-slate-100 rounded-xl p-3 font-black text-lg text-center outline-none" value={inputQty} onChange={e=>setInputQty(parseInt(e.target.value)||0)}/>
                            </div>
                            {adjustMode === 'add' && (
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Unit Cost ($)</label>
                                    <input type="number" className="w-full bg-slate-100 rounded-xl p-3 font-black text-lg text-center outline-none" value={inputCost} onChange={e=>setInputCost(parseFloat(e.target.value)||0)}/>
                                </div>
                            )}
                        </div>

                        {adjustMode === 'add' && (
                             <div className="bg-blue-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-blue-100">
                                 <div><div className="text-[9px] font-bold text-blue-400 uppercase">New WAC</div><div className="text-xl font-black text-blue-700">{formatMoney( ( (modalItem.quantity*modalItem.cost)+(inputQty*inputCost) ) / (modalItem.quantity+inputQty) )}</div></div>
                                 <div className="text-right"><div className="text-[9px] font-bold text-blue-400 uppercase">Total Qty</div><div className="text-xl font-black text-blue-700">{modalItem.quantity+inputQty}</div></div>
                             </div>
                        )}

                        <button onClick={commitAdjust} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Confirm Update</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPONENT: Client Hub (Deep Parsing & Filtering) ---
const ClientHub = ({ data, refresh, notify, log }) => {
    const [view, setView] = useState('list'); 
    const [client, setClient] = useState(null);
    
    // Filters
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');
    const [filterPart, setFilterPart] = useState('');

    const filtered = data.clients.filter(c => {
        const inDate = (!filterStart || c.orderDate >= filterStart) && (!filterEnd || c.orderDate <= filterEnd);
        const hasPart = !filterPart || JSON.stringify(c.specs).toLowerCase().includes(filterPart.toLowerCase());
        return inDate && hasPart;
    });

    const handleNew = () => {
        setClient({ id: generateId(), wechatName: 'New Client', isShipping: false, specs: {}, status: 'Inquiry', orderDate: new Date().toISOString().split('T')[0] });
        setView('detail');
    };

    const handleSave = async () => {
        // Calculate Cost
        let actualCost = 0;
        Object.values(client.specs).forEach(s => actualCost += (s.cost || 0));
        const profit = (client.totalPrice || 0) - actualCost;
        
        const payload = { ...client, actualCost, profit };
        await apiCall('/clients', 'POST', payload);
        log('CLIENT_SAVE', 'Profile Updated', client.wechatName);
        notify('Client Saved');
        refresh(); setView('list');
    };

    // Parser Logic
    const [showParser, setShowParser] = useState(false);
    const [parseText, setParseText] = useState('');
    
    const runParser = () => {
        const lines = parseText.split('\n');
        const newSpecs = { ...client.specs };
        let link = '';

        lines.forEach(l => {
            if(l.includes('pcpartpicker.com/list/')) link = l.match(/(https?:\/\/\S+)/)[0];
            const match = l.match(/^([a-zA-Z\s]+):\s+(.+?)\s+(?:-|@|–)\s+\$/);
            if(match) {
                const type = match[1].trim(); 
                const name = match[2].trim();
                // Map to categories
                const cat = SPEC_CATS.find(c => type.includes(c) || c.includes(type)) || 'Custom';
                if(cat) {
                    // Auto-fill cost from inventory
                    const matchItem = findBestMatch(name, data.inv);
                    newSpecs[cat] = { 
                        name, 
                        sku: matchItem?.sku || '', 
                        cost: matchItem?.cost || 0, // Auto-fill cost
                        qty: 1 
                    };
                }
            }
        });
        setClient(prev => ({ ...prev, specs: newSpecs, pcppLink: link || prev.pcppLink }));
        setShowParser(false); notify('Parsed & Cost Filled');
    };

    if(view === 'detail') return (
        <div className="p-4 max-w-3xl mx-auto pb-32 animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={()=>setView('list')} className="text-slate-400 font-bold text-xs flex items-center gap-1"><ChevronLeft size={16}/> BACK</button>
                <button onClick={handleSave} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95"><Save size={16} className="inline mr-2"/> Save Profile</button>
            </div>

            {/* Main Info */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="l">WeChat Name</label><input className="i" value={client.wechatName} onChange={e=>setClient({...client, wechatName:e.target.value})}/></div>
                    <div><label className="l">WeChat ID</label><input className="i" value={client.wechatId||''} onChange={e=>setClient({...client, wechatId:e.target.value})}/></div>
                    <div><label className="l">XHS Name</label><input className="i" value={client.xhsName||''} onChange={e=>setClient({...client, xhsName:e.target.value})}/></div>
                    <div><label className="l">XHS ID</label><input className="i" value={client.xhsId||''} onChange={e=>setClient({...client, xhsId:e.target.value})}/></div>
                    <div><label className="l">Order Date</label><input type="date" className="i" value={client.orderDate?.split('T')[0]} onChange={e=>setClient({...client, orderDate:e.target.value})}/></div>
                    <div><label className="l">Delivery Date</label><input type="date" className="i" value={client.deliveryDate?.split('T')[0]||''} onChange={e=>setClient({...client, deliveryDate:e.target.value})}/></div>
                </div>
                {/* Shipping Toggle */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={()=>setClient({...client, isShipping:!client.isShipping})}>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${client.isShipping?'bg-blue-600':'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${client.isShipping?'translate-x-4':''}`}/></div>
                        <span className="text-xs font-bold text-slate-700 uppercase">Shipping / Delivery Required</span>
                    </div>
                    {client.isShipping ? (
                         <div className="grid grid-cols-6 gap-2 animate-in fade-in">
                            <div className="col-span-6"><label className="l">Address</label><input className="i" value={client.address||''} onChange={e=>setClient({...client, address:e.target.value})}/></div>
                            <div className="col-span-3"><label className="l">City</label><input className="i" value={client.city||''} onChange={e=>setClient({...client, city:e.target.value})}/></div>
                            <div className="col-span-1"><label className="l">State</label><input className="i" value={client.state||''} onChange={e=>setClient({...client, state:e.target.value})}/></div>
                            <div className="col-span-2"><label className="l">Zip</label><input className="i" value={client.zip||''} onChange={e=>setClient({...client, zip:e.target.value})}/></div>
                         </div>
                    ) : (
                         <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                            <div><label className="l">City</label><input className="i" value={client.city||''} onChange={e=>setClient({...client, city:e.target.value})}/></div>
                            <div><label className="l">Zip</label><input className="i" value={client.zip||''} onChange={e=>setClient({...client, zip:e.target.value})}/></div>
                         </div>
                    )}
                </div>
            </div>

            {/* Specs Table */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Configuration</h3>
                        {client.pcppLink && <a href={client.pcppLink} target="_blank" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"><ExternalLink size={10}/> PCPartPicker</a>}
                    </div>
                    <button onClick={()=>setShowParser(true)} className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold uppercase shadow-md active:scale-95">Parse Text</button>
                </div>
                
                <div className="space-y-1">
                    {SPEC_CATS.map(cat => {
                        const item = client.specs[cat];
                        if(!item && view==='detail' && !showParser) return null; // Hide empty if wanted, but here we show for editing
                        // Let's implement user request: Hide empty rows AFTER parsing, but need a way to add? 
                        // For now, always showing all rows is safer for editing, or we can use a "Show All" toggle.
                        // Implemented: Show all for flexibility.
                        return (
                            <div key={cat} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-50 last:border-0">
                                <div className="col-span-2 text-[9px] font-black text-slate-400 uppercase">{cat}</div>
                                <div className="col-span-5"><input className="w-full text-xs font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-200" placeholder="Item Name" value={item?.name||''} onChange={e=>setClient(p=>({...p, specs:{...p.specs, [cat]:{...item, name:e.target.value}}}))}/></div>
                                <div className="col-span-3"><input className="w-full text-[9px] font-mono text-slate-500 bg-transparent outline-none placeholder:text-slate-200" placeholder="SKU/Key" value={item?.sku||''} onChange={e=>setClient(p=>({...p, specs:{...p.specs, [cat]:{...item, sku:e.target.value}}}))}/></div>
                                <div className="col-span-2 flex items-center gap-1">
                                    <span className="text-[9px] text-slate-300">$</span>
                                    <input type="number" className="w-full text-xs font-bold text-emerald-600 bg-transparent outline-none text-right" placeholder="0" value={item?.cost||''} onChange={e=>setClient(p=>({...p, specs:{...p.specs, [cat]:{...item, cost:parseFloat(e.target.value)}}}))}/>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* Financial Summary */}
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
                 <div className="grid grid-cols-2 gap-8 mb-4">
                     <div><label className="l text-slate-500">Sale Price</label><div className="flex items-center text-2xl font-black"><span className="text-slate-600 mr-1">$</span><input className="bg-transparent outline-none w-full" value={client.totalPrice||''} onChange={e=>setClient({...client, totalPrice:parseFloat(e.target.value)})}/></div></div>
                     <div className="text-right"><label className="l text-slate-500">Net Profit</label><div className={`text-2xl font-black ${(client.totalPrice||0)-(Object.values(client.specs).reduce((a,b)=>a+(b.cost||0),0)) > 0 ? 'text-emerald-400':'text-red-400'}`}>{formatMoney((client.totalPrice||0)-(Object.values(client.specs).reduce((a,b)=>a+(b.cost||0),0)))}</div></div>
                 </div>
            </div>

            {/* Parser Modal */}
            {showParser && (
                <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 shadow-2xl">
                        <h3 className="font-black uppercase text-sm mb-4">PCPartPicker Import</h3>
                        <textarea className="w-full h-48 bg-slate-50 rounded-xl p-4 text-[10px] font-mono mb-4 outline-none border border-slate-100" placeholder="Paste list here..." value={parseText} onChange={e=>setParseText(e.target.value)}/>
                        <div className="flex gap-2">
                             <button onClick={()=>setShowParser(false)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase text-slate-500">Cancel</button>
                             <button onClick={runParser} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Parse & Auto-Fill</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-4 max-w-5xl mx-auto">
             {/* Filter Bar */}
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex gap-4 flex-wrap">
                 <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                    <Search size={16} className="text-slate-400"/>
                    <input className="bg-transparent outline-none text-xs font-bold w-full" placeholder="Search Part (e.g. 9800X3D)..." value={filterPart} onChange={e=>setFilterPart(e.target.value)}/>
                 </div>
                 <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                    <Calendar size={16} className="text-slate-400"/>
                    <input type="date" className="bg-transparent outline-none text-xs font-bold" value={filterStart} onChange={e=>setFilterStart(e.target.value)}/>
                    <span className="text-slate-300">-</span>
                    <input type="date" className="bg-transparent outline-none text-xs font-bold" value={filterEnd} onChange={e=>setFilterEnd(e.target.value)}/>
                 </div>
                 <button onClick={handleNew} className="bg-slate-900 text-white px-4 rounded-xl flex items-center gap-2 shadow-lg active:scale-95"><Plus size={16}/><span className="text-xs font-bold uppercase">New</span></button>
             </div>

             {/* List */}
             <div className="space-y-3">
                 {filtered.map(c => (
                     <div key={c.id} onClick={()=>{setClient(c); setView('detail')}} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-200 transition-all cursor-pointer">
                         <div>
                             <div className="font-black text-sm text-slate-800">{c.wechatName}</div>
                             <div className="flex gap-2 text-[10px] font-bold text-slate-400 mt-1">
                                 <span>{c.orderDate ? new Date(c.orderDate).toLocaleDateString() : 'No Date'}</span>
                                 {c.isShipping && <span className="bg-amber-100 text-amber-600 px-1 rounded"><Truck size={10} className="inline mr-1"/>SHIP</span>}
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="font-black text-sm text-slate-900">{formatMoney(c.totalPrice)}</div>
                             <div className="text-[10px] font-bold text-emerald-500">Profit: {formatMoney(c.profit)}</div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};

// --- COMPONENT: Intake Node (Fuzzy Match) ---
const IntakeNode = ({ data, log, notify, refresh }) => {
    const [text, setText] = useState('');
    const [parsed, setParsed] = useState([]);
    
    const analyze = () => {
        const lines = text.split('\n');
        const results = [];
        // Regex logic same as before but added name clean up
        lines.forEach(l => {
           if(l.includes('Item #:')) {
               const sku = l.split(':')[1].trim();
               const name = l.split('Item #:')[0].trim(); // Rough parse
               // Fuzzy Match Local DB
               const match = findBestMatch(name, data.inv);
               results.push({
                   id: match?.id || generateId(),
                   name: match?.name || name, // Use local name if matched
                   category: match?.category || 'Other',
                   sku: match?.sku || sku,
                   isMatch: !!match,
                   qty: 1, cost: 0
               });
           }
        });
        setParsed(results);
    };

    return (
        <div className="p-4 max-w-3xl mx-auto">
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                 <textarea className="w-full h-32 bg-slate-50 rounded-xl p-4 text-[10px] font-mono outline-none mb-4" placeholder="Paste Newegg Order..." value={text} onChange={e=>setText(e.target.value)}/>
                 <button onClick={analyze} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Analyze Import</button>
             </div>
             
             <div className="space-y-3">
                 {parsed.map((item, i) => (
                     <div key={i} className={`p-4 rounded-2xl border flex gap-3 items-center ${item.isMatch ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                         <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black">{item.isMatch?'MATCH':'NEW'}</div>
                         <div className="flex-1">
                             <input className="w-full bg-transparent font-bold text-xs outline-none" value={item.name} onChange={e=>{const n=[...parsed];n[i].name=e.target.value;setParsed(n)}}/>
                             <div className="text-[9px] text-slate-400 font-mono">{item.sku}</div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};

// Global Styles
const style = document.createElement('style');
style.innerHTML = `
  .l { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-left: 2px; margin-bottom: 2px; display: block; }
  .i { width: 100%; background: #f1f5f9; border: 1px solid transparent; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 11px; font-weight: 700; outline: none; transition: all; }
  .i:focus { background: #fff; border-color: #cbd5e1; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
`;
document.head.appendChild(style);