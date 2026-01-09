import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Package, ScanLine, AlertCircle, CheckCircle } from 'lucide-react';
import { apiCall, generateId } from './utils';
import { NavIcon } from './components/Shared';

import Dashboard from './modules/Dashboard';
import ClientHub from './modules/ClientHub';
import StockVault from './modules/StockVault';
import IntakeNode from './modules/IntakeNode';

export default function App() {
  const [tab, setTab] = useState('dash');
  // 保持之前的 any 类型修复，防止报错
  const [data, setData] = useState<any>({ inv: [], clients: [], logs: [] });
  const [toast, setToast] = useState<any[]>([]);

  useEffect(() => { refresh(); }, []);
  
  const refresh = async () => {
    try {
        const [inv, cl, lg] = await Promise.all([
            apiCall('/inventory'), 
            apiCall('/clients'), 
            apiCall('/logs')
        ]);
        setData({ 
            inv: inv || [], 
            clients: cl || [], 
            logs: lg || [] 
        });
    } catch (e) {
        console.error("Refresh failed", e);
        notify("Data sync failed", "error");
    }
  };

  const notify = (msg: string, type='success') => {
    const id = generateId(); 
    setToast(p => [...p, {id, msg, type}]);
    setTimeout(() => setToast(p => p.filter(x => x.id !== id)), 3000);
  };

  const log = (type: string, title: string, msg: string) => apiCall('/logs', 'POST', { id: generateId(), timestamp: Date.now(), type, title, msg });

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden select-text">
      {/* Toast Layer */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-full max-w-sm px-4 pointer-events-none">
         {toast.map(t => (
             <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-5 ${t.type==='error'?'bg-red-50/95 text-red-600 border border-red-100':'bg-emerald-50/95 text-emerald-600 border border-emerald-100'}`}>
                 {t.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}
                 {t.msg}
             </div>
         ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
         {tab === 'dash' && <Dashboard notify={notify} />}
         {tab === 'clients' && <ClientHub data={data} refresh={refresh} notify={notify} log={log} />}
         {tab === 'inbound' && <IntakeNode data={data} refresh={refresh} notify={notify} log={log} />}
         {tab === 'stock' && <StockVault data={data} refresh={refresh} notify={notify} log={log} />}
      </div>

      {/* Bottom Dock - Fixed back to English */}
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
