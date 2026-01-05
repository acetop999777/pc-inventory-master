import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Package, ScanLine, AlertCircle, CheckCircle } from 'lucide-react';
import { apiCall, generateId } from './utils';
import { NavIcon } from './components/Shared';

// Importing Modules
import Dashboard from './modules/Dashboard';
import ClientHub from './modules/ClientHub';
import StockVault from './modules/StockVault';
import IntakeNode from './modules/IntakeNode';

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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden select-text">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-full max-w-sm px-4 pointer-events-none">
         {toast.map(t => <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-5 ${t.type==='error'?'bg-red-50/95 text-red-600 border border-red-100':'bg-emerald-50/95 text-emerald-600 border border-emerald-100'}`}>{t.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}{t.msg}</div>)}
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
         {tab === 'dash' && <Dashboard data={data} />}
         {tab === 'clients' && <ClientHub data={data} refresh={refresh} notify={notify} log={log} />}
         {tab === 'inbound' && <IntakeNode data={data} refresh={refresh} notify={notify} log={log} />}
         {tab === 'stock' && <StockVault data={data} refresh={refresh} notify={notify} log={log} />}
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-2xl px-6 py-4 flex gap-8 pointer-events-auto">
           <NavIcon icon={LayoutDashboard} active={tab==='dash'} onClick={()=>setTab('dash')} label="Overview"/>
           <NavIcon icon={Users} active={tab==='clients'} onClick={()=>setTab('clients')} label="Clients"/>
           <NavIcon icon={ScanLine} active={tab==='inbound'} onClick={()=>setTab('inbound')} label="Inbound"/>
           <NavIcon icon={Package} active={tab==='stock'} onClick={()=>setTab('stock')} label="Inventory"/>
        </div>
      </div>
    </div>
  );
}