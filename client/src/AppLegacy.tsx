import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

export default function AppLegacy() {
  const [mainView, setMainView] = useState('clients');
  const [subView, setSubView] = useState<'list' | 'detail'>('list');

  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [activeClient, setActiveClient] = useState<ClientEntity | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // autosave sanity
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<any>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(async () => {
    try {
      const [cData, iData] = await Promise.all([apiCall('/clients'), apiCall('/inventory')]);
      setClients(Array.isArray(cData) ? (cData as ClientEntity[]) : []);
      setInventory(Array.isArray(iData) ? (iData as InventoryItem[]) : []);
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const markSaved = useCallback(() => {
    setShowSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 900);
  }, []);

  const handleNewClient = () => {
    const newClient = createEmptyClient();
    newClient.id = generateId();
    setActiveClient(newClient);
    setDirty(false);       // 新建但未填任何东西：不应自动落库
    setShowSaved(false);
    setMainView('clients');
    setSubView('detail');
  };

  const handleSelectClient = (client: ClientEntity) => {
    setActiveClient(client);
    setDirty(false);       // 只是查看：不应该立刻触发 autosave
    setShowSaved(false);
    setSubView('detail');
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    await apiCall(`/clients/${id}`, 'DELETE');
    if (activeClient?.id === id) {
      setActiveClient(null);
      setDirty(false);
      setShowSaved(false);
      setSubView('list');
    }
    void refreshData();
  };

  const handleUpdateField = (field: keyof ClientEntity, val: any) => {
    setActiveClient((prev) => (prev ? { ...prev, [field]: val } : prev));
    setDirty(true);
    setShowSaved(false);
  };

  const handleSave = useCallback(async () => {
    if (!activeClient) return;
    if (!dirty) return;

    setSaving(true);
    try {
      const fin = calculateFinancials(activeClient);
      await apiCall('/clients', 'POST', {
        ...activeClient,
        actualCost: fin.totalCost,
        profit: fin.profit,
      });
      setDirty(false);
      markSaved();
      void refreshData();
    } catch (e) {
      console.error('Save failed', e);
      // 失败时保留 dirty，让下一次还能继续尝试
    } finally {
      setSaving(false);
    }
  }, [activeClient, dirty, markSaved, refreshData]);

  // Autosave：只在 dirty 时触发；并且 debounce（停止输入后才保存）
  useEffect(() => {
    if (!activeClient) return;
    if (!dirty) return;
    if (mainView !== 'clients' || subView !== 'detail') return;

    const timer = setTimeout(() => {
      void handleSave();
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeClient, dirty, mainView, subView, handleSave]);

  const financials = useMemo(
    () => (activeClient ? calculateFinancials(activeClient) : { totalCost: 0, profit: 0, balanceDue: 0, isPaidOff: false }),
    [activeClient]
  );

  const flushAndGo = useCallback(async (next: () => void) => {
    if (mainView === 'clients' && subView === 'detail' && dirty) {
      try { await handleSave(); } catch {}
    }
    next();
  }, [dirty, handleSave, mainView, subView]);

  const renderContent = () => {
    if (mainView === 'dashboard') return <Dashboard />;
    if (mainView === 'inventory') return <InventoryHub />;
    if (mainView === 'inbound') return <InboundHub />;

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
                <button
                  onClick={() => void flushAndGo(() => setSubView('list'))}
                  className="text-slate-500 hover:text-slate-800 transition-colors"
                  title={dirty ? 'Saving changes before leaving…' : 'Back'}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <span className="font-black text-lg text-slate-800">{activeClient.wechatName || 'New Client'}</span>
              </div>

              {(saving || showSaved) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {saving ? <Loader2 size={12} className="animate-spin text-blue-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                  {saving ? 'Syncing...' : 'Saved'}
                </div>
              )}
            </div>

            <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
              <div className="col-span-12 xl:col-span-4 space-y-6">
                <IdentityCard
                  data={activeClient}
                  update={handleUpdateField}
                  onPhotoUpload={() => fileRef.current?.click()}
                  onPhotoRemove={() => {}}
                />
                <LogisticsCard data={activeClient} update={handleUpdateField} statusOptions={STATUS_STEPS} />
                <NotesCard data={activeClient} update={handleUpdateField} />
                <input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={() => {}} />
              </div>
              <div className="col-span-12 xl:col-span-8 space-y-6">
                <FinancialsCard data={activeClient} financials={financials} update={handleUpdateField} />
                <SpecsTable data={activeClient} inventory={inventory} update={handleUpdateField} onCalculate={() => {}} />
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
      onChangeView={(view) => {
        void flushAndGo(() => {
          setMainView(view);
          setSubView('list');
        });
      }}
    >
      {renderContent()}
    </MainLayout>
  );
}
