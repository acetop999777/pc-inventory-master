import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, X, Search, CheckCircle, 
  AlertCircle, History, Activity, TrendingUp, UserPlus, ArrowRight, Zap, 
  Loader2, Scan, ChevronLeft, Save, FileText, DollarSign, ExternalLink,
  Cpu, HardDrive, Monitor, Fan
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Project: PC Inventory Master (Full Stack Edition)
 * Version: 2.2.0 Intelligence Update
 * Feature: PCPartPicker Parsing & Auto-Costing
 */

const API_BASE = `http://${window.location.hostname}:5001/api`;
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
const formatDateTime = (ts) => new Date(parseInt(ts)).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const CATEGORY_SHORTHAND = {
  'CPU': 'CPU', 'CPU Cooler': 'Cooler', 'Motherboard': 'MB', 'Memory': 'RAM', 'Storage': 'SSD',
  'Video Card': 'GPU', 'Case': 'Case', 'Power Supply': 'PSU', 'Case Fan': 'Fan', 'Monitor': 'Mon', 'Other': 'Other'
};
const getCategoryDisplay = (cat) => CATEGORY_SHORTHAND[cat] || cat;
const INITIAL_CATEGORIES = Object.keys(CATEGORY_SHORTHAND);

// --- API Methods ---
async function apiGet(endpoint) {
    try { const res = await fetch(`${API_BASE}${endpoint}`); return await res.json(); } catch (e) { console.error("API Error", e); return []; }
}
async function apiPost(endpoint, body) {
    try { await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { console.error("API Post Error", e); }
}
async function fetchProductInfo(code) {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
    if (res.ok) {
        const data = await res.json();
        if (data.items?.length > 0) return { name: data.items[0].title, category: data.items[0].category?.split('>')[0].trim() || 'Other' };
    }
  } catch (e) {}
  return null;
}

// --- Main Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
        const [invData, logData, clientData] = await Promise.all([apiGet('/inventory'), apiGet('/logs'), apiGet('/clients')]);
        if(invData) setInventory(invData);
        if(logData) setLogs(logData);
        if(clientData) setClients(clientData);
        setLoading(false);
    };
    initData();
  }, []);

  const addNotification = (msg, type = 'success') => {
    const id = generateId();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  const createLog = (type, title, msg, meta = {}) => {
    const newLog = { id: generateId(), timestamp: Date.now(), type, title, msg, meta };
    setLogs(prev => [newLog, ...prev]);
    apiPost('/logs', newLog);
  };

  const syncInventoryItem = (item) => apiPost('/inventory/sync', item);
  const syncClient = (client) => apiPost('/clients', client);

  const renderContent = () => {
    if (loading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading Core...</div>;
    switch(activeTab) {
      case 'dashboard': return <DashboardView clients={clients} inventory={inventory} logs={logs} />;
      case 'clients': return <ClientsView clients={clients} setClients={setClients} createLog={createLog} addNotification={addNotification} syncClient={syncClient} />;
      case 'scan': return <ScanView inventory={inventory} setInventory={setInventory} createLog={createLog} addNotification={addNotification} />;
      case 'stock': return <StockView inventory={inventory} setInventory={setInventory} logs={logs} createLog={createLog} addNotification={addNotification} syncItem={syncInventoryItem} />;
      case 'logs': return <LogsView logs={logs} />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold animate-in slide-in-from-right fade-in flex items-center gap-3 ${n.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-white border-emerald-100 text-emerald-600'}`}>
            {n.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>} {n.msg}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">{renderContent()}</div>
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4">
        <div className="flex items-center bg-white/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2rem] px-3 py-2 gap-2">
          <NavButton icon={LayoutDashboard} label="Dash" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavButton icon={Users} label="Clients" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
          <NavButton icon={ScanLine} label="Inbound" active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} />
          <NavButton icon={Package} label="Stock" active={activeTab === 'stock'} onClick={() => setActiveTab('stock')} />
          <div className="w-px h-8 bg-slate-200 mx-1"></div>
          <NavButton icon={History} label="Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
        </div>
      </div>
    </div>
  );
}

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${active ? 'bg-slate-900 text-white shadow-xl scale-110' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-[9px] font-bold mt-1 uppercase tracking-tighter transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{label}</span>
  </button>
);

// --- Sub Views ---

const DashboardView = ({ clients, inventory, logs }) => {
  const totalStockValue = inventory.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <header><h1 className="text-3xl font-black text-slate-900 tracking-tight">Console</h1><p className="text-slate-400 font-medium mt-1">v2.2.0 • Intelligence Active</p></header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Stock Value" value={formatCurrency(totalStockValue)} icon={Package} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Active Clients" value={clients.length} icon={Users} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Events" value={logs.length} icon={History} color="text-purple-600" bg="bg-purple-50" />
      </div>
    </div>
  );
};
const StatCard = ({ label, value, icon: Icon, color, bg }) => (<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><div className={`p-3 rounded-2xl ${bg} ${color} w-fit mb-4`}><Icon size={22} strokeWidth={2.5}/></div><h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3><p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{label}</p></div>);
const LogsView = ({ logs }) => (<div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col"><header className="mb-8"><h1 className="text-2xl font-black tracking-widest uppercase text-slate-400">Audit Logs</h1></header><div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col p-4"><div className="overflow-y-auto flex-1 space-y-2">{logs.map(log => (<div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"><div className={`p-2 rounded-xl shrink-0 ${log.type.startsWith('INV') ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Activity size={16}/></div><div className="flex-1 min-w-0"><div className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-0.5">{log.type}</div><div className="text-xs font-bold text-slate-800">{log.title}</div><div className="text-xs text-slate-400 truncate">{log.msg}</div></div><div className="text-[10px] font-mono text-slate-300">{formatDateTime(log.timestamp)}</div></div>))}</div></div></div>);

const StockView = ({ inventory, setInventory, logs, createLog, addNotification, syncItem }) => {
  const [selectedCat, setSelectedCat] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustCost, setAdjustCost] = useState(0);
  
  const filteredInventory = inventory.filter(item => {
    const matchesCat = selectedCat === 'All' || item.category === selectedCat;
    const search = searchTerm.toLowerCase();
    return matchesCat && (item.name.toLowerCase().includes(search) || (item.keyword || "").toLowerCase().includes(search));
  });

  const confirmAddStock = () => {
    if (!adjustModalItem) return;
    const curVal = adjustModalItem.quantity * adjustModalItem.cost;
    const addVal = (parseInt(adjustQty) || 0) * (parseFloat(adjustCost) || 0);
    const nQ = adjustModalItem.quantity + (parseInt(adjustQty) || 0);
    const nW = nQ > 0 ? (curVal + addVal) / nQ : 0;
    const newItem = { ...adjustModalItem, quantity: nQ, cost: parseFloat(nW.toFixed(2)) };
    setInventory(prev => prev.map(i => i.id === adjustModalItem.id ? newItem : i));
    syncItem(newItem);
    createLog('INV_IN', `Restock: ${adjustModalItem.keyword || adjustModalItem.name}`, `Added ${adjustQty}. New WAC: ${formatCurrency(nW)}`);
    setAdjustModalItem(null);
    addNotification('Ledger Updated');
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-800">The Vault</h1></div><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-300" size={18}/><input type="text" placeholder="Filter SKU/Key..." className="w-full md:w-72 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none text-sm shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></header>
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">{['All', ...INITIAL_CATEGORIES].map(cat => (<button key={cat} onClick={() => setSelectedCat(cat)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${selectedCat === cat ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{getCategoryDisplay(cat)}</button>))}</div>
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col"><div className="overflow-y-auto flex-1">{filteredInventory.map(item => (<div key={item.id} className="flex items-center p-4 border-b border-slate-50 hover:bg-slate-50 transition-all text-sm group"><div className="w-14 shrink-0 flex justify-center"><span className={`text-[10px] font-black uppercase bg-slate-100 px-1.5 py-0.5 rounded ${item.category === 'CPU' ? 'text-orange-500' : 'text-slate-400'}`}>{getCategoryDisplay(item.category)}</span></div><div className="flex-1 px-4 min-w-0"><div className="font-bold text-slate-800 truncate">{item.name}</div><div className="text-[10px] font-black text-slate-400 tracking-wider">#{item.keyword} • SKU: {item.sku}</div></div><div className="w-28 text-right font-black text-slate-900 tabular-nums">{formatCurrency(item.cost)}</div><div className="w-36 flex justify-center px-4"><button onClick={() => { setAdjustModalItem(item); setAdjustQty(1); setAdjustCost(item.cost); }} className="w-9 h-8 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors flex items-center justify-center font-bold">+</button></div><div className="w-24 text-right pr-2 font-black text-slate-300 tabular-nums">{formatCurrency(item.quantity * item.cost)}</div></div>))}</div></div>
      {adjustModalItem && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in"><div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl"><div className="flex justify-between items-center mb-6 font-black uppercase tracking-widest text-xs"><h3>Protocol: Adjustment</h3><button onClick={() => setAdjustModalItem(null)} className="p-2 bg-slate-50 rounded-xl"><X size={20}/></button></div><div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6"><div className="font-black text-sm text-slate-800 truncate mb-1">{adjustModalItem.name}</div><div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter"><span>Vault: {adjustModalItem.quantity}</span><span>Base: {formatCurrency(adjustModalItem.cost)}</span></div></div><div className="grid grid-cols-2 gap-4 mb-6"><div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Add Units</label><input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-center font-black text-xl outline-none focus:border-slate-900 transition-all" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} /></div><div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">New Cost</label><input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-center font-black text-xl outline-none focus:border-slate-900 transition-all" value={adjustCost} onChange={e => setAdjustCost(e.target.value)} /></div></div><button onClick={confirmAddStock} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-sm">Commit Transaction</button></div></div>)}
    </div>
  );
};

const ScanView = ({ inventory, setInventory, createLog, addNotification }) => {
  const [mode, setMode] = useState('scan');
  const [inputCode, setInputCode] = useState('');
  const [batchList, setBatchList] = useState([]);
  const [neweggText, setNeweggText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const inputRef = useRef(null);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = inputCode.trim();
    if (!code) return;
    setInputCode(''); 
    
    const existing = batchList.findIndex(i => i.code === code);
    if (existing >= 0) {
      setBatchList(prev => { const n = [...prev]; n[existing].quantity += 1; return n; });
    } else {
      const localMatch = inventory.find(i => i.sku === code || i.barcode === code);
      if (localMatch) {
        setBatchList(prev => [{ id: generateId(), code, name: localMatch.name, keyword: localMatch.keyword, category: localMatch.category, quantity: 1, cost: localMatch.cost, isNew: false }, ...prev]);
      } else {
        const api = await fetchProductInfo(code);
        setBatchList(prev => [{ id: generateId(), code, name: api ? api.name : 'Unknown SKU', keyword: '', category: api ? api.category : 'Other', quantity: 1, cost: 0, isNew: true }, ...prev]);
      }
    }
  };

  const parseNeweggOrder = () => {
    const lines = neweggText.split('\n').map(l => l.trim()).filter(l => l);
    const gtMatch = neweggText.match(/Grand Total\s*\$?([\d,]+\.\d{2})/);
    const grandTotal = gtMatch ? parseFloat(gtMatch[1].replace(/,/g, '')) : 0;
    let items = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Item #:')) {
          const sku = lines[i].split(':')[1].trim();
          let name = lines[i-1];
          if (name.includes('Return Policy') || name.startsWith('COMBO')) name = lines[i-2];
          let qty = 1; let listedTotal = 0;
          for (let j = 1; j <= 6; j++) {
             const nL = lines[i+j] || "";
             if (/^\d+$/.test(nL) && lines[i+j+1]?.startsWith('$')) qty = parseInt(nL);
             if (nL.startsWith('$') && !nL.includes('ea.')) { listedTotal = parseFloat(nL.replace(/[$,]/g, '')); break; }
          }
          let category = 'Other';
          const n = name.toLowerCase();
          if (n.includes('cpu')) category = 'CPU';
          else if (n.includes('motherboard') || n.includes('b650') || n.includes('z790')) category = 'Motherboard';
          else if (n.includes('memory') || n.includes('ddr5')) category = 'Memory';
          else if (n.includes('video card') || n.includes('rtx')) category = 'Video Card';

          items.push({ id: generateId(), sku, name, category, quantity: qty, listedTotal, cost: 0, keyword: '' });
        }
    }
    const paidItems = items.filter(i => i.listedTotal > 0);
    const sumListed = paidItems.reduce((s, i) => s + i.listedTotal, 0);
    items = items.map(it => ({
        ...it,
        cost: sumListed > 0 ? parseFloat(((it.listedTotal / sumListed) * grandTotal / it.quantity).toFixed(2)) : 0
    }));

    setParsedItems(items);
    setShowReview(true);
  };

  const commitBatch = async (items) => {
    let newInv = [...inventory];
    const itemsToSync = [];
    items.forEach(item => {
      const targetSku = item.code || item.sku;
      const idx = newInv.findIndex(i => i.sku === targetSku || i.barcode === targetSku);
      const q = parseInt(item.quantity); const c = parseFloat(item.cost);
      let finalItem;
      if (idx >= 0) {
        const ex = newInv[idx];
        const nQ = ex.quantity + q;
        const nW = (ex.quantity * ex.cost + q * c) / nQ;
        finalItem = { ...ex, quantity: nQ, cost: parseFloat(nW.toFixed(2)), keyword: item.keyword || ex.keyword, category: item.category || ex.category };
        newInv[idx] = finalItem;
      } else {
        finalItem = { id: generateId(), sku: targetSku, barcode: targetSku, keyword: item.keyword || '', name: item.name, category: item.category, quantity: q, cost: c };
        newInv.push(finalItem);
      }
      itemsToSync.push(finalItem);
    });
    setInventory(newInv);
    setBatchList([]); setParsedItems([]); setShowReview(false);
    await apiPost('/inventory/batch', itemsToSync);
    createLog('INV_IN', 'Batch Import', `Processed ${itemsToSync.length} items`);
    addNotification('Inventory Updated');
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col relative">
      <h1 className="text-2xl font-black text-center mb-6 tracking-widest uppercase flex items-center justify-center gap-3 italic"><Zap size={24} className="text-yellow-400 fill-yellow-400"/> Intake Node</h1>
      <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-8 max-w-xs mx-auto w-full shrink-0">
        <button onClick={() => setMode('scan')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'scan' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>Laser</button>
        <button onClick={() => setMode('newegg')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'newegg' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>Newegg</button>
      </div>
      {mode === 'scan' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-6"><form onSubmit={handleBarcodeSubmit}><div className="relative"><Scan className="absolute left-4 top-4 text-slate-300" size={24}/><input ref={inputRef} autoFocus className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-12 text-xl font-black font-mono outline-none" placeholder="AWAITING PULSE..." value={inputCode} onChange={e => setInputCode(e.target.value)} /></div></form></div>
           <div className="flex-1 overflow-y-auto space-y-4 pb-28 px-1 no-scrollbar">{batchList.map(item => (<div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4"><div className="flex justify-between items-start"><input className="w-full font-black text-slate-800 border-none bg-transparent outline-none truncate h-6" value={item.name} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, name: e.target.value} : i))} /><button onClick={() => setBatchList(prev => prev.filter(i => i.id !== item.id))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-300"><X size={18}/></button></div><div className="flex gap-4 items-end pl-2"><div className="w-14"><label className="text-[9px] font-black text-slate-400 uppercase">Cat</label><select className="w-full text-[10px] font-black bg-slate-100 border-none p-1.5 rounded-lg outline-none uppercase" value={item.category} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, category: e.target.value} : i))}>{INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{getCategoryDisplay(c)}</option>)}</select></div><div className="flex-1"><label className="text-[9px] font-black text-slate-400 uppercase">Keyword</label><input className="w-full text-xs font-black text-blue-600 bg-slate-50 p-2 rounded-xl outline-none uppercase" value={item.keyword} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, keyword: e.target.value} : i))} /></div><div className="w-24"><label className="text-[9px] font-black text-slate-400 uppercase">Cost</label><input type="number" className="w-full text-xs font-black bg-slate-50 p-2 rounded-xl outline-none" value={item.cost} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, cost: e.target.value} : i))} /></div><div className="w-16"><label className="text-[9px] font-black text-slate-400 uppercase">Qty</label><input type="number" className="w-full h-9 rounded-xl bg-slate-50 text-center font-black text-sm outline-none" value={item.quantity} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, quantity: parseInt(e.target.value) || 1} : i))} /></div></div></div>))}</div>
           {batchList.length > 0 && <div className="absolute bottom-4 left-0 right-0 p-4"><button onClick={() => commitBatch(batchList)} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all">Merge Assets</button></div>}
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center"><textarea className="w-full h-72 bg-slate-50 border-none rounded-[2rem] p-6 font-mono text-[10px] outline-none" placeholder="Paste Newegg Order Logic..." value={neweggText} onChange={e => setNeweggText(e.target.value)}/><button onClick={parseNeweggOrder} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl uppercase tracking-widest text-xs shadow-xl shadow-blue-200 active:scale-95 transition-all">Execute Logic Extraction</button></div>
      )}
      {showReview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6 font-black text-lg uppercase tracking-widest text-slate-900 leading-none"><h3>Import Analysis</h3><button onClick={() => setShowReview(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><X size={24}/></button></div>
              <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-50 rounded-2xl no-scrollbar">{parsedItems.map((item, idx) => (<div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col gap-3"><div className="flex items-center justify-between gap-4"><div className="flex-1 min-w-0"><input className="w-full font-black text-sm bg-transparent border-none outline-none focus:text-blue-600 truncate h-6" value={item.name} onChange={e => { const n = [...parsedItems]; n[idx].name = e.target.value; setParsedItems(n); }} /></div><div className="flex items-center gap-1 font-black text-blue-600 shrink-0 border-b-2 border-blue-100"><span className="text-xs">$</span><input type="number" className="w-24 bg-transparent text-right outline-none py-1" value={item.cost} onChange={e => { const n = [...parsedItems]; n[idx].cost = e.target.value; setParsedItems(n); }} /></div></div><div className="flex items-center gap-3 flex-wrap"><div className="flex items-center gap-2 flex-1"><select className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 border border-slate-200 rounded px-2 h-7 outline-none appearance-none" value={item.category} onChange={e => { const n = [...parsedItems]; n[idx].category = e.target.value; setParsedItems(n); }}>{INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{getCategoryDisplay(c)}</option>)}</select><div className="flex items-center bg-slate-50 border border-blue-100 rounded px-2 h-7 flex-1 max-w-[120px]"><span className="text-[10px] text-blue-300 font-bold mr-1">#</span><input className="bg-transparent text-[10px] font-black text-blue-600 outline-none w-full placeholder:text-slate-300 uppercase font-mono" placeholder="TAG" value={item.keyword} onChange={e => { const n = [...parsedItems]; n[idx].keyword = e.target.value; setParsedItems(n); }} /></div></div></div></div>))}</div>
              <button onClick={() => commitBatch(parsedItems)} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] mt-6 uppercase tracking-[0.2em] text-sm shadow-2xl active:scale-95 transition-all">Merge assets to Vault</button>
           </div>
        </div>
      )}
    </div>
  );
};

// --- ClientsView: With PCPartPicker Parsing ---
const ClientsView = ({ clients, setClients, createLog, addNotification, syncClient }) => {
   const [selectedClient, setSelectedClient] = useState(null);
   const [parsedManifest, setParsedManifest] = useState([]);

   useEffect(() => {
     if(selectedClient && selectedClient.manifestText) parseManifest(selectedClient.manifestText, false);
   }, [selectedClient]);

   const handleCreateClient = () => {
      const newClient = { 
          id: generateId(), 
          wechatName: "New Entity", 
          wechatId: "", xhsName: "", xhsId: "", manifestText: "", status: 'Deposit', 
          saleTarget: 0, resourceCost: 0, 
          orderDate: new Date().toISOString().split('T')[0] 
      };
      setSelectedClient(newClient);
      setParsedManifest([]);
   };

   const parseManifest = (text, updateCost = true) => {
       if(!text) { setParsedManifest([]); return; }
       const lines = text.split('\n');
       const parts = [];
       let totalCost = 0;

       lines.forEach(line => {
           // Regex matches: Type: Name ($Price ... or Type: Name $Price
           // Handles the specific PCPartPicker list format provided
           const regex = /^([a-zA-Z\s]+):\s+(.+?)\s+(?:-|@|–)\s+\$([\d\.]+)/; 
           const regex2 = /^([a-zA-Z\s]+):\s+(.+?)\s+\(\$([\d\.]+)/; // For the ($Price @ Vendor) format
           
           const match = line.match(regex) || line.match(regex2);
           if (match) {
               const type = match[1].trim();
               const name = match[2].trim();
               const price = parseFloat(match[3]);
               if (type !== 'Total' && type !== 'Generated by') {
                   parts.push({ type, name, price });
                   totalCost += price;
               }
           }
       });

       setParsedManifest(parts);
       
       if (updateCost && selectedClient) {
           setSelectedClient(prev => ({ ...prev, resourceCost: parseFloat(totalCost.toFixed(2)) }));
           addNotification(`Extracted ${parts.length} parts. Cost updated.`);
       }
   };

   const handleSaveClient = () => {
       if (!selectedClient) return;
       setClients(prev => {
           const exists = prev.find(c => c.id === selectedClient.id);
           if (exists) return prev.map(c => c.id === selectedClient.id ? selectedClient : c);
           return [selectedClient, ...prev];
       });
       syncClient(selectedClient);
       createLog('CLIENT_UPDATE', 'Entity Log', `Updated Record: ${selectedClient.wechatName}`);
       addNotification('Entity Saved');
       setSelectedClient(null);
   };

   if (selectedClient) {
       return (
         <div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col animate-in slide-in-from-right">
            <header className="mb-6 flex justify-between items-center">
                <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-black uppercase text-xs tracking-widest transition-colors"><ChevronLeft size={16}/> Back to Hub</button>
                <button onClick={handleSaveClient} className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl active:scale-95 flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><Save size={16}/> Update</button>
            </header>
            
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-4 mb-4"><div className="text-3xl font-black text-slate-800">{selectedClient.wechatName}</div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WeChat Name</label><input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-100" value={selectedClient.wechatName} onChange={e => setSelectedClient({...selectedClient, wechatName: e.target.value})} /></div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">XHS Name</label><input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-100" value={selectedClient.xhsName} onChange={e => setSelectedClient({...selectedClient, xhsName: e.target.value})} /></div>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WeChat ID</label><input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-100" value={selectedClient.wechatId} onChange={e => setSelectedClient({...selectedClient, wechatId: e.target.value})} /></div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">XHS ID</label><input className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-100" value={selectedClient.xhsId} onChange={e => setSelectedClient({...selectedClient, xhsId: e.target.value})} /></div>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">PCPartPicker Manifest</label>
                    <textarea className="w-full h-32 bg-slate-50 border-none rounded-2xl p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-50" placeholder="Paste PCPartPicker text here..." value={selectedClient.manifestText} onChange={e => { setSelectedClient({...selectedClient, manifestText: e.target.value}); parseManifest(e.target.value, false); }} />
                    <button onClick={() => parseManifest(selectedClient.manifestText, true)} className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all"><Scan size={14}/> Extract & Calculate Cost</button>
                </div>

                {parsedManifest.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 animate-in fade-in">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Configuration Breakdown</h4>
                    <div className="space-y-2">
                      {parsedManifest.map((part, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                           <div className="flex items-center gap-2"><span className="font-black text-slate-400 w-16 uppercase text-[9px]">{part.type}</span><span className="font-bold text-slate-700 truncate max-w-[200px]">{part.name}</span></div>
                           <div className="font-mono font-bold text-slate-900">{formatCurrency(part.price)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="mt-6 bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row gap-8 items-center shadow-2xl">
                <div className="flex-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Yield</div>
                    <div className={`text-4xl font-black tracking-tighter ${(selectedClient.saleTarget - selectedClient.resourceCost) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(selectedClient.saleTarget - selectedClient.resourceCost)}</div>
                </div>
                <div className="flex gap-6">
                    <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Sale Target</label><input type="number" className="bg-slate-800 border-none rounded-xl py-2 px-3 text-white font-black w-32 outline-none" value={selectedClient.saleTarget} onChange={e => setSelectedClient({...selectedClient, saleTarget: parseFloat(e.target.value) || 0})} /></div>
                    <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Resource Cost</label><input type="number" className="bg-slate-800 border-none rounded-xl py-2 px-3 text-white font-black w-32 outline-none" value={selectedClient.resourceCost} onChange={e => setSelectedClient({...selectedClient, resourceCost: parseFloat(e.target.value) || 0})} /></div>
                </div>
            </div>
         </div>
       );
   }

   return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto h-full">
        <header className="mb-8 flex justify-between items-center"><div><h1 className="text-3xl font-black uppercase tracking-[0.1em] text-slate-800 leading-none">Hub</h1></div><button onClick={handleCreateClient} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95"><UserPlus size={24}/></button></header>
        <div className="grid gap-4 md:grid-cols-2">
            {clients.map(c => (
                <div key={c.id} onClick={() => setSelectedClient(c)} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex flex-col">
                        <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{c.wechatName}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"><span>{c.orderDate}</span>{c.xhsName && <span className="bg-slate-100 px-1.5 rounded text-slate-500">XHS: {c.xhsName}</span>}</div>
                    </div>
                    <div className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100">{c.status}</div>
                </div>
            ))}
        </div>
    </div>
   );
};