import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Package, ScanLine, Search, CheckCircle, AlertCircle, 
  Plus, Save, X, Truck, ChevronLeft, Box, Cpu, Scan, Trash2, ArrowRight, 
  Calendar, CreditCard, Link as LinkIcon, User
} from 'lucide-react';

/**
 * Project: PC Inventory Master
 * Version: 5.1.0 "Clean & Smart"
 */

const API_BASE = `http://${window.location.hostname}:5001/api`;
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// Default Cats: 8 Hardware + Service
const DEFAULT_CATS = ['CPU', 'CPU Cooler', 'Motherboard', 'Memory', 'Storage', 'Video Card', 'Case', 'Power Supply', 'Service Fee'];
// Full Cats for reference
const ALL_CATS = [...DEFAULT_CATS, 'Case Fan', 'Monitor', 'Strimer', 'Custom'];
const STATUS_OPTS = ['Deposit Paid', 'Waiting Parts', 'Building', 'Ready', 'Delivered'];

// --- Helper: Auto Categorize ---
const guessCategory = (name) => {
    const n = name.toLowerCase();
    if(n.includes('cpu') || n.includes('ryzen') || n.includes('intel')) return 'CPU';
    if(n.includes('motherboard') || n.includes('b650') || n.includes('z790')) return 'Motherboard';
    if(n.includes('memory') || n.includes('ram') || n.includes('ddr5')) return 'Memory';
    if(n.includes('video card') || n.includes('geforce') || n.includes('rtx')) return 'Video Card';
    if(n.includes('ssd') || n.includes('nvme')) return 'Storage';
    if(n.includes('cooler') || n.includes('liquid') || n.includes('aio')) return 'CPU Cooler';
    if(n.includes('power supply') || n.includes('psu')) return 'Power Supply';
    if(n.includes('case') || n.includes('tower')) return 'Case';
    return 'Other';
};

// --- API ---
async function apiCall(url, method='GET', body=null) {
    try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if(body) opts.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${url}`, opts);
        return await res.json();
    } catch(e) { return null; }
}

// --- Fuzzy Match Logic (The Solution to Naming Mismatch) ---
function findBestMatch(targetName, inventory) {
    if(!targetName) return null;
    const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let best = null; let bestScore = 0;

    inventory.forEach(item => {
        let score = 0;
        const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanKey = (item.keyword || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // 1. Keyword is KING (Matches "#9800X3D" in "AMD Ryzen 7 9800X3D...")
        if(cleanKey && cleanTarget.includes(cleanKey)) score += 100;
        
        // 2. Name Match
        if(cleanTarget.includes(cleanName) || cleanName.includes(cleanTarget)) score += 50;
        
        // 3. Token Match
        targetName.split(' ').forEach(t => { 
            if(t.length > 3 && item.name.toLowerCase().includes(t.toLowerCase())) score += 5; 
        });

        if(score > bestScore) { bestScore = score; best = item; }
    });
    // Threshold to prevent bad matches
    return bestScore > 20 ? best : null;
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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden select-none">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-full max-w-sm px-4">
         {toast.map(t => <div key={t.id} className={`px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-5 ${t.type==='error'?'bg-red-50/95 text-red-600 border border-red-100':'bg-emerald-50/95 text-emerald-600 border border-emerald-100'}`}>{t.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}{t.msg}</div>)}
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">{ 
         tab==='dash' ? <Dashboard data={data}/> : 
         tab==='clients' ? <ClientHub data={data} refresh={refresh} notify={notify} log={log}/> : 
         tab==='inbound' ? <IntakeNode data={data} refresh={refresh} notify={notify} log={log}/> : 
         <StockVault data={data} refresh={refresh} notify={notify} log={log}/> 
      }</div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-2xl px-6 py-4 flex gap-8">
           <NavIcon icon={LayoutDashboard} active={tab==='dash'} onClick={()=>setTab('dash')} label="Overview"/>
           <NavIcon icon={Users} active={tab==='clients'} onClick={()=>setTab('clients')} label="Clients"/>
           <NavIcon icon={ScanLine} active={tab==='inbound'} onClick={()=>setTab('inbound')} label="Inbound"/>
           <NavIcon icon={Package} active={tab==='stock'} onClick={()=>setTab('stock')} label="Inventory"/>
        </div>
      </div>
    </div>
  );
}
const NavIcon = ({icon:I, active, onClick, label}) => (<button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all group ${active?'text-blue-600 -translate-y-1':'text-slate-400 hover:text-slate-600'}`}><div className={`p-2 rounded-xl transition-colors ${active?'bg-blue-50':'group-hover:bg-slate-50'}`}><I size={24} strokeWidth={active?2.5:2}/></div><span className="text-[10px] font-bold tracking-wide">{label}</span></button>);

// --- DASHBOARD ---
const Dashboard = ({ data }) => {
  const stockVal = data.inv.reduce((a, b) => a + (b.cost * b.quantity), 0);
  const revenue = data.clients.reduce((a,b) => a + (b.totalPrice || 0), 0);
  const profit = data.clients.reduce((a,b) => a + (b.profit || 0), 0);
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
       <header><h1 className="text-3xl font-black text-slate-900 tracking-tight">Command Center</h1><p className="text-sm font-medium text-slate-400">Inventory & Order Management System</p></header>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card label="Total Inventory Asset" val={formatMoney(stockVal)} color="text-blue-600" bg="bg-blue-50" icon={Package}/>
          <Card label="Total Revenue" val={formatMoney(revenue)} color="text-slate-700" bg="bg-slate-50" icon={CreditCard}/>
          <Card label="Realized Profit" val={formatMoney(profit)} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp}/>
       </div>
    </div>
  );
};
const Card = ({ label, val, color, bg, icon: Icon }) => (<div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4"><div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center`}><Icon size={24}/></div><div><div className="text-3xl font-black text-slate-900 tracking-tight">{val}</div><div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div></div></div>);

// --- STOCK VAULT ---
const StockVault = ({ data, refresh, notify, log }) => {
    const [cat, setCat] = useState('All');
    const [editItem, setEditItem] = useState(null);
    const [adjQty, setAdjQty] = useState(1);
    const [adjCost, setAdjCost] = useState(0);

    const filtered = data.inv.filter(i => cat === 'All' || i.category === cat);
    const commit = async (mode) => {
        const newQty = editItem.quantity + (mode==='add'?adjQty:-adjQty);
        let newCost = editItem.cost;
        if(mode==='add' && newQty>0) newCost = ((editItem.quantity*editItem.cost)+(adjQty*adjCost))/newQty;
        await apiCall('/inventory/batch', 'POST', [{ ...editItem, quantity: newQty, cost: parseFloat(newCost.toFixed(2)) }]);
        notify('Stock Updated'); setEditItem(null); refresh();
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar">{['All', ...ALL_CATS].map(c => <button key={c} onClick={()=>setCat(c)} className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${cat===c?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{c}</button>)}</div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-1">Cat</div><div className="col-span-5">Product Name</div><div className="col-span-2">SKU / Key</div><div className="col-span-2 text-right">Stock</div><div className="col-span-2 text-right">Action</div>
                </div>
                {filtered.map(i => (
                    <div key={i.id} className="grid grid-cols-12 gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 items-center transition-colors">
                        <div className="col-span-1"><span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">{i.category.substring(0,3)}</span></div>
                        <div className="col-span-5 font-bold text-sm text-slate-800 truncate" title={i.name}>{i.name}</div>
                        <div className="col-span-2 text-xs font-mono text-slate-400 truncate">{i.keyword || i.sku}</div>
                        <div className="col-span-2 text-right"><div className="font-black text-sm">{i.quantity}</div><div className="text-[10px] text-slate-400">@ {formatMoney(i.cost)}</div></div>
                        <div className="col-span-2 flex justify-end gap-2"><button onClick={()=>{setEditItem(i);setAdjQty(1);setAdjCost(i.cost);}} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors shadow-sm"><Plus size={16}/></button></div>
                    </div>
                ))}
            </div>
            {editItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-black text-slate-800 mb-6">Stock Adjustment</h3>
                        <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100"><div className="text-xs text-slate-500 font-bold uppercase mb-1">Product</div><div className="font-bold text-slate-800">{editItem.name}</div></div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div><label className="l">Adjust Qty</label><input type="number" className="i text-lg h-12" value={adjQty} onChange={e=>setAdjQty(parseInt(e.target.value)||0)}/></div>
                            <div><label className="l">Unit Cost ($)</label><input type="number" className="i text-lg h-12" value={adjCost} onChange={e=>setAdjCost(parseFloat(e.target.value)||0)}/></div>
                        </div>
                        <div className="flex gap-3">
                             <button onClick={()=>commit('sub')} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-2xl font-bold text-sm uppercase transition-colors">Stock Out</button>
                             <button onClick={()=>commit('add')} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-sm uppercase transition-colors shadow-lg">Stock In</button>
                        </div>
                        <button onClick={()=>setEditItem(null)} className="w-full mt-4 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTAKE NODE ---
const IntakeNode = ({ data, refresh, notify, log }) => {
    const [neweggTxt, setNeweggTxt] = useState('');
    const [batch, setBatch] = useState([]);

    const parseNewegg = () => {
        try {
            const lines = neweggTxt.split('\n').map(l => l.trim());
            const gtMatch = neweggTxt.match(/Grand Total\s*\$?([\d,]+\.\d{2})/);
            const grandTotal = gtMatch ? parseFloat(gtMatch[1].replace(/,/g,'')) : 0;
            const items = [];
            
            for(let i=0; i<lines.length; i++) {
                if(lines[i].startsWith('Item #:')) {
                    const sku = lines[i].split(':')[1].trim();
                    let name = lines[i-1];
                    if(name.includes('Return Policy') || name.startsWith('COMBO')) name = lines[i-2]; 
                    
                    let subtotal = 0; let qty = 1;
                    // Look ahead for "($xxx.xx ea.)" which anchors the subtotal above it
                    for(let j=1; j<8; j++) {
                        const l = lines[i+j];
                        if(l && l.includes('ea.)')) {
                             const subLine = lines[i+j-1]; // Line above (ea.) is Subtotal
                             if(subLine && subLine.startsWith('$')) subtotal = parseFloat(subLine.replace(/[$,]/g, ''));
                             const qtyLine = lines[i+j-2]; // Line above Subtotal is Qty
                             if(qtyLine && /^\d+$/.test(qtyLine)) qty = parseInt(qtyLine);
                             break;
                        }
                    }
                    const isGift = lines.slice(Math.max(0,i-6), i).some(l => l.includes('Free Gift Item'));
                    const dbMatch = findBestMatch(name, data.inv);
                    const autoCat = dbMatch?.category || guessCategory(name);

                    items.push({
                        id: dbMatch?.id || generateId(),
                        name: dbMatch?.name || name,
                        category: autoCat,
                        sku: dbMatch?.sku || sku,
                        qtyInput: qty, subtotal: subtotal, isGift: isGift, isMatch: !!dbMatch,
                        quantity: dbMatch?.quantity || 0, cost: dbMatch?.cost || 0
                    });
                }
            }
            const validItems = items.filter(i => !i.isGift);
            const sumSubtotals = validItems.reduce((a, b) => a + b.subtotal, 0);
            const finalBatch = items.map(item => {
                let costInput = 0;
                if(!item.isGift && sumSubtotals > 0) costInput = (item.subtotal / sumSubtotals) * grandTotal / item.qtyInput;
                return { ...item, costInput: parseFloat(costInput.toFixed(2)) };
            });
            setBatch(p => [...finalBatch, ...p]);
            setNeweggTxt('');
            notify(`Parsed ${items.length} items`);
        } catch(e) { notify('Parse Error', 'error'); }
    };

    const commit = async () => {
        const payload = batch.map(b => {
            const finalQ = b.quantity + b.qtyInput;
            const finalC = finalQ > 0 ? ((b.quantity*b.cost) + (b.qtyInput*b.costInput))/finalQ : 0;
            return { ...b, quantity: finalQ, cost: parseFloat(finalC.toFixed(2)) };
        });
        await apiCall('/inventory/batch', 'POST', payload);
        notify('Inventory Updated'); setBatch([]); refresh();
    };

    return (
        <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-[70vh]">
                <h3 className="font-black uppercase text-xs mb-4 text-slate-400 tracking-widest">Newegg Intelligent Import</h3>
                <textarea className="flex-1 bg-slate-50 rounded-xl p-4 text-xs font-mono mb-4 outline-none resize-none focus:ring-2 focus:ring-blue-100 transition-all leading-relaxed" placeholder="Paste Newegg Order Summary here..." value={neweggTxt} onChange={e=>setNeweggTxt(e.target.value)}/>
                <button onClick={parseNewegg} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">Analyze & Extract Assets</button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col h-[70vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Staging Area ({batch.length})</h3>
                    {batch.length>0 && <button onClick={commit} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all">Commit All</button>}
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                    {batch.map((item, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-blue-200 transition-colors">
                            <div className="flex justify-between items-start">
                                <input className="font-bold text-sm w-full bg-transparent outline-none text-slate-800" value={item.name} onChange={e=>{const n=[...batch];n[i].name=e.target.value;setBatch(n)}}/>
                                <button onClick={()=>setBatch(batch.filter((_,idx)=>idx!==i))}><Trash2 size={16} className="text-slate-300 hover:text-red-500 transition-colors"/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.isMatch?'bg-emerald-50 text-emerald-600':'bg-blue-50 text-blue-600'}`}>{item.isMatch?'Matched':'New'}</span>
                                {item.isGift && <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase bg-purple-50 text-purple-600">Gift</span>}
                                <select className="text-[10px] font-bold bg-slate-50 text-slate-500 rounded-lg px-2 py-1 outline-none uppercase" value={item.category} onChange={e=>{const n=[...batch];n[i].category=e.target.value;setBatch(n)}}>{ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-1">
                                <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span><input type="number" className="bg-transparent text-right font-black text-sm w-12 outline-none" value={item.qtyInput} onChange={e=>{const n=[...batch];n[i].qtyInput=parseInt(e.target.value)||0;setBatch(n)}}/></div>
                                <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Cost</span><input type="number" className="bg-transparent text-right font-black text-sm w-20 outline-none text-emerald-600" value={item.costInput} onChange={e=>{const n=[...batch];n[i].costInput=parseFloat(e.target.value)||0;setBatch(n)}}/></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- CLIENT HUB ---
const ClientHub = ({ data, refresh, notify, log }) => {
    const [view, setView] = useState('list');
    const [active, setActive] = useState(null);
    const [search, setSearch] = useState('');

    const handleNew = () => {
        // Init with Default Categories and Service Fee
        const initSpecs = {};
        DEFAULT_CATS.forEach(c => {
            initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 };
            if(c === 'Service Fee') initSpecs[c] = { name: 'Assembly Service', sku: 'LABOR', cost: 0, price: 180, qty: 1 };
        });
        setActive({ 
            id: generateId(), wechatName: 'New Client', isShipping: false, specs: initSpecs, status: 'Deposit Paid', 
            orderDate: new Date().toISOString().split('T')[0], depositDate: '', deliveryDate: '',
            realName: '', wechatId: '', xhsId: '', xhsName: '', pcppLink: '', trackingNumber: ''
        });
        setView('detail');
    };

    const save = async () => {
        let actual = 0;
        // Cost Calculation: Sum of all parts' COST
        Object.values(active.specs).forEach(s => actual += (s.cost || 0));
        // Profit defaults to 0 if we haven't entered sale price yet
        const profit = active.totalPrice ? (active.totalPrice - actual) : 0;
        
        await apiCall('/clients', 'POST', { ...active, actualCost: actual, profit });
        notify('Profile Saved'); await refresh(); setView('list');
    };

    const parsePCPP = (text) => {
        if(!text) return;
        const lines = text.split('\n');
        const newSpecs = { ...active.specs };
        
        // If parsed, we might want to show all categories including Custom found
        lines.forEach(l => {
            if(l.includes('pcpartpicker.com/list/')) active.pcppLink = l.match(/(https?:\/\/\S+)/)[0];
            const splitIdx = l.indexOf(': ');
            if(splitIdx > -1) {
                const catRaw = l.substring(0, splitIdx).trim();
                const rest = l.substring(splitIdx + 2).trim();
                const cat = ALL_CATS.find(c => c.toLowerCase() === catRaw.toLowerCase()) || (catRaw==='Video Card'?'Video Card':null);
                
                if(cat) {
                    const name = rest.split('($')[0].trim();
                    const dbItem = findBestMatch(name, data.inv);
                    newSpecs[cat] = {
                        name: name,
                        sku: dbItem?.sku || '',
                        cost: dbItem?.cost || 0, // Auto-fill Cost if found
                        qty: 1
                    };
                }
            }
        });
        // Ensure Service Fee exists
        if(!newSpecs['Service Fee']) newSpecs['Service Fee'] = { name: 'Assembly Service', sku: 'LABOR', cost: 0, price: 180 };
        setActive(p => ({ ...p, specs: newSpecs }));
        notify('PCPP Parsed');
    };

    // Helper to get active categories (defaults + any extras that have data)
    const displayCats = useMemo(() => {
        if(!active) return [];
        const keys = Object.keys(active.specs);
        // Show default cats OR any cat that has a name filled in
        return ALL_CATS.filter(c => DEFAULT_CATS.includes(c) || (active.specs[c] && active.specs[c].name));
    }, [active]);

    if(view === 'detail') return (
        <div className="p-8 max-w-7xl mx-auto pb-32 animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
                <button onClick={()=>setView('list')} className="text-slate-400 font-bold text-xs flex items-center gap-1 hover:text-slate-600 transition-colors"><ChevronLeft size={16}/> BACK TO HUB</button>
                <div className="flex gap-3">
                    {active.pcppLink && <a href={active.pcppLink} target="_blank" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-100 transition-colors"><LinkIcon size={14}/> PCPartPicker</a>}
                    {active.trackingNumber && <a href={`https://www.ups.com/track?tracknum=${active.trackingNumber}`} target="_blank" className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-100 transition-colors"><Truck size={14}/> Track Package</a>}
                    <button onClick={save} className="bg-slate-900 text-white px-8 py-2 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-slate-800 transition-colors">Save Profile</button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Col: Identity */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div><h3 className="font-black text-sm text-slate-800">Client Identity</h3></div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="l">WeChat Name</label><input className="i" value={active.wechatName} onChange={e=>setActive({...active, wechatName:e.target.value})}/></div>
                                <div><label className="l">WeChat ID</label><input className="i" value={active.wechatId||''} onChange={e=>setActive({...active, wechatId:e.target.value})}/></div>
                            </div>
                            <div><label className="l">Real Name</label><input className="i" value={active.realName||''} onChange={e=>setActive({...active, realName:e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="l">XHS Name</label><input className="i" value={active.xhsName||''} onChange={e=>setActive({...active, xhsName:e.target.value})}/></div>
                                <div><label className="l">XHS ID</label><input className="i" value={active.xhsId||''} onChange={e=>setActive({...active, xhsId:e.target.value})}/></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><Calendar size={20}/></div><h3 className="font-black text-sm text-slate-800">Timeline & Logistics</h3></div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="l">Deposit Date</label><input type="date" className="i" value={active.depositDate?.split('T')[0]||''} onChange={e=>setActive({...active, depositDate:e.target.value})}/></div>
                                <div><label className="l">Delivery Date</label><input type="date" className="i" value={active.deliveryDate?.split('T')[0]||''} onChange={e=>setActive({...active, deliveryDate:e.target.value})}/></div>
                            </div>
                            <div><label className="l">Status</label><select className="i" value={active.status} onChange={e=>setActive({...active, status:e.target.value})}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
                            <div className="pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={()=>setActive({...active, isShipping:!active.isShipping})}>
                                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${active.isShipping?'bg-blue-600':'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${active.isShipping?'translate-x-4':''}`}/></div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500">Shipping Required</span>
                                </div>
                                {active.isShipping && (
                                    <div className="space-y-3 animate-in fade-in">
                                        <div><label className="l">Street Address</label><input className="i" value={active.address||''} onChange={e=>setActive({...active, address:e.target.value})}/></div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2"><label className="l">City</label><input className="i" value={active.city||''} onChange={e=>setActive({...active, city:e.target.value})}/></div>
                                            <div className="col-span-1"><label className="l">State</label><input className="i" value={active.state||''} onChange={e=>setActive({...active, state:e.target.value})}/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="l">Zip Code</label><input className="i" value={active.zip||''} onChange={e=>setActive({...active, zip:e.target.value})}/></div>
                                            <div><label className="l">Tracking #</label><input className="i" value={active.trackingNumber||''} onChange={e=>setActive({...active, trackingNumber:e.target.value})}/></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Build Spec */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Total Sale Price</label>
                            <div className="flex items-center text-4xl font-black"><span className="text-slate-600 mr-2">$</span><input className="bg-transparent outline-none w-full placeholder:text-slate-700" placeholder="0.00" value={active.totalPrice||''} onChange={e=>setActive({...active, totalPrice:parseFloat(e.target.value)})}/></div>
                        </div>
                        <div className="w-full md:text-right">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Est. Net Profit</label>
                            <div className={`text-3xl font-black ${(active.totalPrice||0)-(Object.values(active.specs).reduce((a,b)=>a+(b.cost||0),0)) > 0 ? 'text-emerald-400':'text-red-400'}`}>{formatMoney(active.totalPrice ? (active.totalPrice - Object.values(active.specs).reduce((a,b)=>a+(b.cost||0),0)) : 0)}</div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><Cpu size={20}/></div><h3 className="font-black text-sm text-slate-800">Build Configuration</h3></div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-xl p-4 mb-6">
                            <textarea className="w-full h-20 bg-transparent text-xs font-mono outline-none resize-none placeholder:text-slate-400" placeholder="Paste PCPartPicker list here to auto-fill..." onChange={e=>parsePCPP(e.target.value)}/>
                        </div>

                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-4 px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <div className="col-span-2">Part Type</div><div className="col-span-6">Model / Name</div><div className="col-span-2">SKU</div><div className="col-span-2 text-right">My Cost</div>
                            </div>
                            {displayCats.map(cat => {
                                const item = active.specs[cat] || { name: '', sku: '', cost: 0 };
                                return (
                                    <div key={cat} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors px-4 -mx-4">
                                        <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">{cat}</div>
                                        <div className="col-span-6"><input className="w-full text-sm font-bold text-slate-800 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.name||''} onChange={e=>setActive(p=>({...p, specs:{...p.specs, [cat]:{...item, name:e.target.value}}}))}/></div>
                                        <div className="col-span-2"><input className="w-full text-[10px] font-mono text-slate-400 bg-transparent outline-none placeholder:text-slate-200" placeholder="-" value={item.sku||''} onChange={e=>setActive(p=>({...p, specs:{...p.specs, [cat]:{...item, sku:e.target.value}}}))}/></div>
                                        <div className="col-span-2 flex justify-end">
                                            <div className="bg-slate-100 rounded-lg px-2 py-1 flex items-center">
                                                <span className="text-[10px] text-slate-400 mr-1">$</span>
                                                <input type="number" className="w-16 text-xs font-bold text-right text-emerald-600 bg-transparent outline-none placeholder:text-slate-300" placeholder="0" value={item.cost||''} onChange={e=>setActive(p=>({...p, specs:{...p.specs, [cat]:{...item, cost:parseFloat(e.target.value)}}}))}/>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-8">
                 <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Hub</h1>
                 <button onClick={handleNew} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2"><Plus size={16}/> New Client</button>
             </div>
             <div className="mb-6 relative">
                 <Search size={18} className="absolute left-4 top-3.5 text-slate-400"/>
                 <input className="w-full bg-white pl-12 pr-6 py-3.5 rounded-2xl border border-slate-100 shadow-sm outline-none text-sm font-bold transition-all focus:ring-2 focus:ring-blue-50" placeholder="Search by Name, Real Name, or Part..." value={search} onChange={e=>setSearch(e.target.value)}/>
             </div>
             <div className="space-y-4">
                 {data.clients.filter(c => JSON.stringify(c).toLowerCase().includes(search.toLowerCase())).map(c => (
                     <div key={c.id} onClick={()=>{setActive(c); setView('detail');}} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
                         <div className="flex gap-4 items-center">
                             <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">{c.wechatName.substring(0,2).toUpperCase()}</div>
                             <div>
                                 <div className="font-black text-base text-slate-800 group-hover:text-blue-600 transition-colors">{c.wechatName} <span className="text-slate-400 font-medium text-xs ml-2">{c.realName}</span></div>
                                 <div className="flex gap-3 mt-1.5">
                                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${c.status==='Delivered'?'bg-emerald-50 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{c.status}</span>
                                     <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {c.orderDate ? new Date(c.orderDate).toLocaleDateString() : 'No Date'}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="font-black text-lg text-slate-900">{formatMoney(c.totalPrice)}</div>
                             <div className="text-[10px] font-bold text-emerald-500">Net: {formatMoney(c.profit)}</div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};

// Styles
const s = document.createElement('style');
s.innerHTML = `.l{font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;display:block;letter-spacing:0.05em}.i{width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.75rem;padding:0.75rem 1rem;font-size:13px;font-weight:600;color:#334155;outline:none;transition:all}.i:focus{background:#fff;border-color:#94a3b8;box-shadow:0 4px 12px rgba(0,0,0,0.03)}`;
document.head.appendChild(s);