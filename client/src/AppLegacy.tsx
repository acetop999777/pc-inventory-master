import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';

import { ClientEntity } from './domain/client/client.types';
import { calculateFinancials, createEmptyClient } from './domain/client/client.logic';
import { generateId } from './utils';

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

import { useClientsQuery } from './app/queries/clients';
import { useInventoryQuery } from './app/queries/inventory';
import { useClientWriteBehind } from './app/writeBehind/clientWriteBehind';
import { useSaveQueue } from './app/saveQueue/SaveQueueProvider';

const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'];

export default function AppLegacy() {
  const [mainView, setMainView] = useState('clients');
  const [subView, setSubView] = useState<'list' | 'detail'>('list');

  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // draft：只用于“新建但尚未首次落库”的 client（属于纯 client state）
  const [draftClient, setDraftClient] = useState<ClientEntity | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const { data: clientsData } = useClientsQuery();
  const clients = clientsData ?? [];

  const { data: invData } = useInventoryQuery();
  const inventory = invData ?? [];

  const { update: updateClient, remove: removeClient } = useClientWriteBehind();
  const { queue, snapshot } = useSaveQueue();

  // draft 一旦进入 clients cache（意味着至少保存成功一次），就自动清掉 draft
  useEffect(() => {
    if (!draftClient) return;
    if (clients.some((c) => c.id === draftClient.id)) setDraftClient(null);
  }, [clients, draftClient]);

  const activeClient: ClientEntity | null = useMemo(() => {
    if (!activeClientId) return null;
    if (draftClient && draftClient.id === activeClientId) return draftClient;
    return clients.find((c) => c.id === activeClientId) ?? null;
  }, [activeClientId, clients, draftClient]);

  const activeKey = activeClientId ? `client:${activeClientId}` : null;
  const keyStatus = useMemo(() => {
    if (!activeKey) return null;
    return snapshot.keys.find((k) => k.key === activeKey) ?? null;
  }, [snapshot, activeKey]);

  const busy = Boolean(keyStatus?.pending || keyStatus?.inFlight);
  const hasError = Boolean(keyStatus?.hasError);

  // busy -> idle：短暂闪一下 Saved（idle 时不常驻）
  const [flashSaved, setFlashSaved] = useState(false);
  const prevBusyRef = useRef(false);
  const tRef = useRef<any>(null);

  useEffect(() => {
    const prev = prevBusyRef.current;
    prevBusyRef.current = busy;

    if (activeKey && prev && !busy && !hasError) {
      setFlashSaved(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setFlashSaved(false), 900);
      return;
    }

    if (hasError) setFlashSaved(false);
    if (!busy && !hasError) setFlashSaved(false);
  }, [busy, hasError, activeKey]);

  const handleNewClient = useCallback(() => {
    const c = createEmptyClient();
    c.id = generateId();
    setDraftClient(c);
    setActiveClientId(c.id);
    setMainView('clients');
    setSubView('detail');
  }, []);

  const handleSelectClient = useCallback((client: ClientEntity) => {
    setDraftClient(null);
    setActiveClientId(client.id);
    setSubView('detail');
  }, []);

  const handleDeleteClient = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete ${name}?`)) return;

      // 若正在看 detail：先回列表，避免 detail 继续引用
      if (activeClientId === id) {
        setSubView('list');
        setActiveClientId(null);
        setDraftClient(null);
      }

      removeClient(id);
    },
    [activeClientId, removeClient]
  );

  const handleUpdateField = useCallback(
    (field: keyof ClientEntity, val: any) => {
      if (!activeClientId) return;

      // draft：先更新本地 draft，然后把 base 交给 write-behind，确保首次写回有完整对象
      if (draftClient && draftClient.id === activeClientId) {
        const next: ClientEntity = { ...draftClient, [field]: val };
        setDraftClient(next);
        updateClient(activeClientId, { [field]: val } as Partial<ClientEntity>, next);
        return;
      }

      // existing：直接写 Query cache + write-behind
      updateClient(activeClientId, { [field]: val } as Partial<ClientEntity>);
    },
    [activeClientId, draftClient, updateClient]
  );

  const retryActive = useCallback(async () => {
    if (!activeKey) return;
    await queue.flushKey(activeKey);
  }, [activeKey, queue]);

  const flushAndGo = useCallback(
    async (next: () => void) => {
      if (mainView === 'clients' && subView === 'detail' && activeKey) {
        await queue.flushKey(activeKey);

        const post = queue.getSnapshot().keys.find((k) => k.key === activeKey);
        const blocked = post ? post.hasError || post.pending || post.inFlight : false;

        if (blocked) {
          const leave = window.confirm('Sync failed / pending. Leave this page anyway?');
          if (!leave) return;
        }
      }
      next();
    },
    [activeKey, mainView, queue, subView]
  );

  const financials = useMemo(
    () => (activeClient ? calculateFinancials(activeClient) : { totalCost: 0, profit: 0, balanceDue: 0, isPaidOff: false }),
    [activeClient]
  );

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

      if (subView === 'detail') {
        if (!activeClient) return <div className="p-10">Loading...</div>;

        return (
          <div className="min-h-screen pb-40 animate-in slide-in-from-right duration-300">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-40">
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    void flushAndGo(() => {
                      setSubView('list');
                      setActiveClientId(null);
                      // draft 若没成功落库，返回列表即丢弃（不会“幽灵占位”）
                      setDraftClient(null);
                    })
                  }
                  className="text-slate-500 hover:text-slate-800 transition-colors"
                  title={busy ? 'Syncing before leaving…' : hasError ? 'Sync failed' : 'Back'}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <span className="font-black text-lg text-slate-800">{activeClient.wechatName || 'New Client'}</span>
              </div>

              {(busy || hasError || flashSaved) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {hasError ? (
                    <>
                      <AlertTriangle size={12} className="text-amber-600" />
                      <span className="text-amber-700">Needs Sync</span>
                      <button
                        onClick={retryActive}
                        className="ml-2 px-2 py-1 rounded-full bg-white border border-amber-200 hover:bg-amber-50 text-amber-700"
                        title="Retry"
                      >
                        Retry
                      </button>
                    </>
                  ) : busy ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-blue-500" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-emerald-700">Saved</span>
                    </>
                  )}
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

    return <div className="p-10">Loading...</div>;
  };

  return (
    <MainLayout
      currentView={mainView}
      onChangeView={(view) => {
        void flushAndGo(() => {
          setMainView(view);
          setSubView('list');
          setActiveClientId(null);
          setDraftClient(null);
        });
      }}
    >
      {renderContent()}
    </MainLayout>
  );
}
