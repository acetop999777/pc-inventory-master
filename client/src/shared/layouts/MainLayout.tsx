import React from 'react';
import { LayoutDashboard, Users, Package, LogOut, PackagePlus } from 'lucide-react';
import { SyncStatusPill } from '../../app/saveQueue/SyncStatusPill';

interface Props {
  currentView: string;
  onChangeView: (view: string) => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<Props> = ({ currentView, onChangeView, children }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
    { id: 'clients', icon: Users, label: 'Clients' },
    { id: 'inventory', icon: Package, label: 'Inventory' },
    { id: 'inbound', icon: PackagePlus, label: 'Inbound' }, // 确保这里有 Inbound
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <div className="hidden md:flex w-64 bg-slate-900 text-white flex-col shrink-0 transition-all">
        <div className="p-8">
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <span className="text-blue-500">DONKEY</span> DEPOT
          </h1>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Management System V3.0
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <button className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-red-400 transition-colors">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative pb-20 md:pb-0">
        <SyncStatusPill />
        {children}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
        <div className="mx-auto max-w-[900px] px-4 pb-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-3 py-2">
            <div className="grid grid-cols-4 gap-2">
              {navItems.map((item) => {
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeView(item.id)}
                    className={[
                      'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-widest transition',
                      active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
