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
            <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-all">
                <div className="p-8">
                    <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
                        <span className="text-blue-500">DONKEY</span> DEPOT
                    </h1>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Management System V3.0
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map(item => (
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

            <div className="flex-1 overflow-auto relative">
                <SyncStatusPill />
{children}
            </div>
        </div>
    );
};
