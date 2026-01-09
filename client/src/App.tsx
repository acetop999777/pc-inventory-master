import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClientEntity } from './domain/client/client.types';
import { calculateFinancials, createEmptyClient } from './domain/client/client.logic';
import { InventoryItem } from './types';
import { apiCall, generateId } from './utils';

import { MainLayout } from './presentation/layouts/MainLayout';
import Dashboard from './presentation/modules/Dashboard/Dashboard';
import ClientHub from './presentation/modules/ClientHub/ClientHub';
import InventoryHub from './presentation/modules/Inventory/InventoryHub';
import InboundHub from './presentation/modules/Inbound/InboundHub';

import { IdentityCard } from './presentation/modules/ClientEditor/components/IdentityCard';
import { LogisticsCard } from './presentation/modules/ClientEditor/components/LogisticsCard';
import { FinancialsCard } from './presentation/modules/ClientEditor/components/FinancialsCard';
import { NotesCard } from './presentation/modules/ClientEditor/components/NotesCard';
import { SpecsTable } from './presentation/modules/ClientEditor/components/SpecsTable';
import { CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';

const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'];

export default function App() {
    const [mainView, setMainView] = useState('clients'); 
    const [subView, setSubView] = useState<'list' | 'detail'>('list');
    
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [activeClient, setActiveClient] = useState<ClientEntity | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [saving, setSaving] = useState(false);
    
    const fileRef = useRef<HTMLInputElement>(null);

    const refreshData = async () => {
        try {
            const [cData, iData] = await Promise.all([
                apiCall('/clients'),
                apiCall('/inventory')
            ]);
            setClients(Array.isArray(cData) ? cData : []);
            setInventory(Array.isArray(iData) ? iData : []);
        } catch (e) {
            console.error("Failed to load data", e);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const handleNewClient = () => {
        const newClient = createEmptyClient();
        newClient.id = generateId();
        setActiveClient(newClient);
        setMainView('clients');
        setSubView('detail');
    };

    const handleSelectClient = (client: ClientEntity) => {
        setActiveClient(client);
        setSubView('detail');
    };

    const handleDeleteClient = async (id: string, name: string) => {
        if (!window.confirm(`Delete ${name}?`)) return;
        await apiCall(`/clients/${id}`, 'DELETE');
        refreshData();
    };

    const handleUpdateField = (field: keyof ClientEntity, val: any) => {
        if (!activeClient) return;
        setActiveClient(prev => prev ? ({ ...prev, [field]: val }) : null);
    };

    const handleSave = async () => {
        if (!activeClient) return;
        setSaving(true);
        const financials = calculateFinancials(activeClient);
        await apiCall('/clients', 'POST', { 
            ...activeClient, 
            actualCost: financials.totalCost, 
            profit: financials.profit 
        });
        setSaving(false);
        refreshData(); 
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeClient && mainView === 'clients' && subView === 'detail') handleSave();
        }, 2000);
        return () => clearTimeout(timer);
    }, [activeClient]);

    const financials = useMemo(() => 
        activeClient ? calculateFinancials(activeClient) : { totalCost:0, profit:0, balanceDue:0, isPaidOff:false }, 
        [activeClient]
    );

    const renderContent = () => {
        if (mainView === 'dashboard') return <Dashboard />;
        if (mainView === 'inventory') return <InventoryHub inventory={inventory} />;
        if (mainView === 'inbound') return <InboundHub inventory={inventory} />; // 注入 inventory

        if (mainView === 'clients') {
            if (subView === 'list') {
                return (
                    <ClientHub 
                        clients={clients} 
                        onSelectClient={handleSelectClient}
                        onNewClient={handleNewClient}
                        onDeleteClient={handleDeleteClient}
                    />
                );
            }
            if (subView === 'detail' && activeClient) {
                return (
                    <div className="min-h-screen pb-40 animate-in slide-in-from-right duration-300">
                        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-40">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSubView('list')} className="text-slate-500 hover:text-slate-800 transition-colors">
                                    <ChevronLeft size={20}/>
                                </button>
                                <div className="h-6 w-px bg-slate-200"></div>
                                <span className="font-black text-lg text-slate-800">{activeClient.wechatName || 'New Client'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {saving ? <Loader2 size={12} className="animate-spin text-blue-500"/> : <CheckCircle2 size={12} className="text-emerald-500"/>}
                                {saving ? 'Syncing...' : 'Saved'}
                            </div>
                        </div>

                        <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
                            <div className="col-span-12 xl:col-span-4 space-y-6">
                                <IdentityCard 
                                    data={activeClient} 
                                    update={handleUpdateField} 
                                    onPhotoUpload={() => fileRef.current?.click()} 
                                    onPhotoRemove={() => {}} 
                                />
                                <LogisticsCard 
                                    data={activeClient} 
                                    update={handleUpdateField} 
                                    statusOptions={STATUS_STEPS}
                                />
                                <NotesCard data={activeClient} update={handleUpdateField} />
                                <input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={() => {}}/>
                            </div>
                            <div className="col-span-12 xl:col-span-8 space-y-6">
                                <FinancialsCard 
                                    data={activeClient} 
                                    financials={financials} 
                                    update={handleUpdateField}
                                />
                                <SpecsTable 
                                    data={activeClient}
                                    inventory={inventory}
                                    update={handleUpdateField}
                                    onCalculate={handleSave}
                                />
                            </div>
                        </div>
                    </div>
                );
            }
        }
        return <div>Loading...</div>;
    };

    return (
        <MainLayout 
            currentView={mainView} 
            onChangeView={(view) => { setMainView(view); setSubView('list'); }}
        >
            {renderContent()}
        </MainLayout>
    );
}
