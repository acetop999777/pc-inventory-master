import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, X, Search, CheckCircle, AlertCircle, History, Activity, TrendingUp, UserPlus, ArrowRight, Zap, Loader2, Barcode
} from 'lucide-react';

/**
 * Project: PC Inventory Master (Full Stack Edition)
 * Version: 2.0.0 Dockerized
 */

// --- 全局配置 ---
// 自动获取当前主机 IP，端口固定为 5001
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

// --- 音效工具 ---
function playScanSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime); 
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.1); 
  } catch (e) {}
}

// --- API 交互函数 ---
async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        return await res.json();
    } catch (e) { console.error("API Error", e); return []; }
}
async function apiPost(endpoint, body) {
    try {
        await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
    } catch (e) { console.error("API Post Error", e); }
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

// --- 主组件 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // 初始化加载数据
  useEffect(() => {
    const initData = async () => {
        const [invData, logData, clientData] = await Promise.all([
            apiGet('/inventory'),
            apiGet('/logs'),
            apiGet('/clients')
        ]);
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

  // 核心日志记录与数据同步
  const createLog = (type, title, msg, meta = {}) => {
    const newLog = { id: generateId(), timestamp: Date.now(), type, title, msg, meta };
    // 1. 乐观 UI 更新
    setLogs(prev => [newLog, ...prev]);
    // 2. 后端同步
    apiPost('/logs', newLog);
  };

  const syncInventoryItem = (item) => {
      // 更新单个库存到数据库
      apiPost('/inventory/sync', item);
  };

  const renderContent = () => {
    if (loading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Connecting to Neural Core...</div>;
    switch(activeTab) {
      case 'dashboard': return <DashboardView clients={clients} inventory={inventory} logs={logs} />;
      case 'clients': return <ClientsView clients={clients} setClients={setClients} createLog={createLog} addNotification={addNotification} />;
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
            {n.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
            {n.msg}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {renderContent()}
      </div>

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

// --- 子视图组件 ---

const DashboardView = ({ clients, inventory, logs }) => {
  const totalStockValue = inventory.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <header><h1 className="text-3xl font-black text-slate-900 tracking-tight">Console</h1><p className="text-slate-400 font-medium mt-1">v2.0.0 Dockerized • Connected to Postgres</p></header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Stock Value" value={formatCurrency(totalStockValue)} icon={Package} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Pending Orders" value={clients.filter(c => c.status !== 'Delivered').length} icon={Users} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Total Events" value={logs.length} icon={History} color="text-purple-600" bg="bg-purple-50" />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className={`p-3 rounded-2xl ${bg} ${color} w-fit mb-4`}><Icon size={22} strokeWidth={2.5}/></div>
    <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{label}</p>
  </div>
);

const LogsView = ({ logs }) => (
  <div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col">
    <header className="mb-8"><h1 className="text-2xl font-black tracking-widest uppercase text-slate-400">Audit Logs</h1></header>
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col p-4">
      <div className="overflow-y-auto flex-1 space-y-2">
        {logs.length === 0 ? <div className="text-center py-20 text-slate-300 font-bold italic opacity-20">NO DATA</div> : 
          logs.map(log => (
            <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
              <div className={`p-2 rounded-xl shrink-0 ${log.type.startsWith('INV') ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Activity size={16}/></div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-0.5">{log.type}</div>
                <div className="text-xs font-bold text-slate-800">{log.title}</div>
                <div className="text-xs text-slate-400 truncate">{log.msg}</div>
              </div>
              <div className="text-[10px] font-mono text-slate-300">{formatDateTime(log.timestamp)}</div>
            </div>
          ))
        }
      </div>
    </div>
  </div>
);

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
    
    // UI Update
    setInventory(prev => prev.map(i => i.id === adjustModalItem.id ? newItem : i));
    // DB Update
    syncItem(newItem);
    
    createLog('INV_IN', `Restock: ${adjustModalItem.keyword || adjustModalItem.name}`, `Added ${adjustQty}. New WAC: ${formatCurrency(nW)}`);
    setAdjustModalItem(null);
    addNotification('Ledger Updated');
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-800">The Vault</h1></div>
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-300" size={18}/>
            <input type="text" placeholder="Filter SKU/Key..." className="w-full md:w-72 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none text-sm shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </header>
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
        {['All', ...INITIAL_CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setSelectedCat(cat)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${selectedCat === cat ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{getCategoryDisplay(cat)}</button>
        ))}
      </div>
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          {filteredInventory.map(item => (
            <div key={item.id} className="flex items-center p-4 border-b border-slate-50 hover:bg-slate-50 transition-all text-sm group">
              <div className="w-14 shrink-0 flex justify-center"><span className={`text-[10px] font-black uppercase bg-slate-100 px-1.5 py-0.5 rounded ${item.category === 'CPU' ? 'text-orange-500' : 'text-slate-400'}`}>{getCategoryDisplay(item.category)}</span></div>
              <div className="flex-1 px-4 min-w-0"><div className="font-bold text-slate-800 truncate">{item.name}</div><div className="text-[10px] font-black text-slate-400 tracking-wider">#{item.keyword} • SKU: {item.sku}</div></div>
              <div className="w-28 text-right font-black text-slate-900 tabular-nums">{formatCurrency(item.cost)}</div>
              <div className="w-36 flex justify-center px-4">
                 <button onClick={() => { setAdjustModalItem(item); setAdjustQty(1); setAdjustCost(item.cost); }} className="w-9 h-8 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors flex items-center justify-center font-bold">+</button>
              </div>
              <div className="w-24 text-right pr-2 font-black text-slate-300 tabular-nums">{formatCurrency(item.quantity * item.cost)}</div>
            </div>
          ))}
        </div>
      </div>
      {adjustModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6 font-black uppercase tracking-widest text-xs"><h3>Protocol: Adjustment</h3><button onClick={() => setAdjustModalItem(null)} className="p-2 bg-slate-50 rounded-xl"><X size={20}/></button></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                <div className="font-black text-sm text-slate-800 truncate mb-1">{adjustModalItem.name}</div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter"><span>Vault: {adjustModalItem.quantity}</span><span>Base: {formatCurrency(adjustModalItem.cost)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Add Units</label><input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-center font-black text-xl outline-none focus:border-slate-900 transition-all" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} /></div>
                 <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">New Cost</label><input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-center font-black text-xl outline-none focus:border-slate-900 transition-all" value={adjustCost} onChange={e => setAdjustCost(e.target.value)} /></div>
              </div>
              <button onClick={confirmAddStock} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-sm">Commit Transaction</button>
           </div>
        </div>
      )}
    </div>
  );
};

const ScanView = ({ inventory, setInventory, createLog, addNotification }) => {
  const [inputCode, setInputCode] = useState('');
  const [batchList, setBatchList] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef(null);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = inputCode.trim();
    if (!code || isScanning) return;
    setIsScanning(true);
    setInputCode(''); 
    
    // Check Local Batch
    const existing = batchList.findIndex(i => i.code === code);
    if (existing >= 0) {
      setBatchList(prev => { const n = [...prev]; n[existing].quantity += 1; return n; });
    } else {
      // Check Inventory DB
      const localMatch = inventory.find(i => i.sku === code || i.barcode === code);
      if (localMatch) {
        setBatchList(prev => [{ id: generateId(), code, name: localMatch.name, keyword: localMatch.keyword, category: localMatch.category, quantity: 1, cost: localMatch.cost, isNew: false }, ...prev]);
      } else {
        const api = await fetchProductInfo(code);
        setBatchList(prev => [{ id: generateId(), code, name: api ? api.name : 'Unknown SKU', keyword: '', category: api ? api.category : 'Other', quantity: 1, cost: 0, isNew: true }, ...prev]);
      }
    }
    playScanSound();
    setIsScanning(false); 
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const commitBatch = async () => {
    // 构造更新后的库存状态（UI）
    let newInv = [...inventory];
    const itemsToSync = [];

    batchList.forEach(item => {
      const targetSku = item.code;
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

    // 1. UI Update
    setInventory(newInv);
    setBatchList([]);
    
    // 2. DB Update (Batch)
    await apiPost('/inventory/batch', itemsToSync);
    
    // 3. Log
    createLog('INV_IN', 'Batch Scan', `Processed ${itemsToSync.length} SKUs`);
    addNotification('Ledger Entries Recorded');
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto h-full flex flex-col relative">
      <h1 className="text-2xl font-black text-center mb-6 tracking-widest uppercase flex items-center justify-center gap-3 italic"><Zap size={24} className="text-yellow-400 fill-yellow-400"/> Intake Node</h1>
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm mb-6"><form onSubmit={handleBarcodeSubmit}><div className="relative"><Barcode className="absolute left-4 top-4 text-slate-300" size={24}/><input ref={inputRef} autoFocus className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-12 text-xl font-black font-mono outline-none" placeholder="AWAITING PULSE..." value={inputCode} onChange={e => setInputCode(e.target.value)} />{isScanning && <Loader2 className="absolute right-4 top-4.5 animate-spin" size={24}/>}</div></form></div>
      <div className="flex-1 overflow-y-auto space-y-4 pb-28 px-1 no-scrollbar">
          {batchList.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm animate-in slide-in-from-bottom-2 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                   <input className="w-full font-black text-slate-800 border-none bg-transparent outline-none truncate h-6" value={item.name} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, name: e.target.value} : i))} />
                   <button onClick={() => setBatchList(prev => prev.filter(i => i.id !== item.id))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-300"><X size={18}/></button>
                </div>
                <div className="flex gap-4 items-end pl-2">
                    <div className="w-14"><label className="text-[9px] font-black text-slate-400 uppercase">Cat</label><select className="w-full text-[10px] font-black bg-slate-100 border-none p-1.5 rounded-lg outline-none uppercase" value={item.category} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, category: e.target.value} : i))}>{INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{getCategoryDisplay(c)}</option>)}</select></div>
                    <div className="flex-1"><label className="text-[9px] font-black text-slate-400 uppercase">Keyword</label><input className="w-full text-xs font-black text-blue-600 bg-slate-50 p-2 rounded-xl outline-none uppercase" value={item.keyword} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, keyword: e.target.value} : i))} /></div>
                    <div className="w-24"><label className="text-[9px] font-black text-slate-400 uppercase">Cost</label><input type="number" className="w-full text-xs font-black bg-slate-50 p-2 rounded-xl outline-none" value={item.cost} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, cost: e.target.value} : i))} /></div>
                    <div className="w-16"><label className="text-[9px] font-black text-slate-400 uppercase">Qty</label><input type="number" className="w-full h-9 rounded-xl bg-slate-50 text-center font-black text-sm outline-none" value={item.quantity} onChange={e => setBatchList(prev => prev.map(i => i.id === item.id ? {...i, quantity: parseInt(e.target.value) || 1} : i))} /></div>
                </div>
            </div>
          ))}
      </div>
      {batchList.length > 0 && <div className="absolute bottom-4 left-0 right-0 p-4"><button onClick={commitBatch} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all">Merge Assets</button></div>}
    </div>
  );
};

const ClientsView = ({ clients, setClients, createLog, addNotification }) => {
   const handleCreateClient = () => {
      const name = "Entity " + (clients.length + 1);
      const newClient = { id: generateId(), wechatName: name, status: 'Deposit', orderDate: new Date().toISOString().split('T')[0] };
      setClients(prev => [newClient, ...prev]);
      apiPost('/clients', newClient); // Sync DB
      createLog('CLIENT_NEW', 'Entity Creation', `Registered ${name}`);
      addNotification('Entity Initialized');
   };
   return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto h-full">
        <header className="mb-8 flex justify-between items-center"><div><h1 className="text-3xl font-black uppercase tracking-[0.1em] text-slate-800 leading-none">Hub</h1></div><button onClick={handleCreateClient} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl active:scale-95"><UserPlus size={24}/></button></header>
        <div className="grid gap-4 md:grid-cols-2">
            {clients.map(c => (<div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm"><div className="flex flex-col"><div className="font-black text-slate-800 text-lg">{c.wechatName}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{c.orderDate}</div></div><div className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase bg-blue-50 text-blue-600">{c.status}</div></div>))}
        </div>
    </div>
   );
};