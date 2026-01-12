import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ClientEntity } from './domain/client/client.types';
import { calculateFinancials, createEmptyClient } from './domain/client/client.logic';
import { generateId } from './utils';

import { MainLayout } from './presentation/layouts/MainLayout';
import Dashboard from './presentation/modules/Dashboard/Dashboard';
import InventoryHub from './presentation/modules/Inventory/InventoryHub';
import InboundHub from './presentation/modules/Inbound/InboundHub';

import { useClientsQuery } from './app/queries/clients';
import { useInventoryQuery } from './app/queries/inventory';
import { useClientWriteBehind } from './app/writeBehind/clientWriteBehind';
import { useSaveQueue } from './app/saveQueue/SaveQueueProvider';

import { ClientsListPage } from './features/clients/ClientsListPage';
import { ClientDetailPage } from './features/clients/ClientDetailPage';

const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'] as const;

export default function AppLegacy() {
  const [mainView, setMainView] = useState('clients');
  const [subView, setSubView] = useState<'list' | 'detail'>('list');

  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // draft：只用于“新建但尚未首次落库”的 client（纯 client state）
  const [draftClient, setDraftClient] = useState<ClientEntity | null>(null);

  const { data: clientsData } = useClientsQuery();
  const clients = clientsData ?? [];

  const { data: invData } = useInventoryQuery();
  const inventory = invData ?? [];

  const { update: updateClient, remove: removeClient } = useClientWriteBehind();
  const { queue, snapshot } = useSaveQueue();

  // draft 一旦进入 clients cache（意味着至少保存成功一次），就清掉 draft
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
  }, [snapshot.keys, activeKey]);

  const busy = Boolean(keyStatus?.pending || keyStatus?.inFlight);
  const hasError = Boolean(keyStatus?.hasError);

  // busy -> idle：短暂闪 Saved（idle 不常驻）
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

      // draft：先更新本地 draft，再把 base 交给 write-behind，确保首次写回有完整对象
      if (draftClient && draftClient.id === activeClientId) {
        const next: ClientEntity = { ...draftClient, [field]: val };
        setDraftClient(next);
        updateClient(activeClientId, { [field]: val } as Partial<ClientEntity>, next);
        return;
      }

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

  const financials = useMemo(() => {
    if (!activeClient) return { totalCost: 0, profit: 0, balanceDue: 0, isPaidOff: false };
    return calculateFinancials(activeClient);
  }, [activeClient]);

  const renderContent = () => {
    if (mainView === 'dashboard') return <Dashboard />;
    if (mainView === 'inventory') return <InventoryHub />;
    if (mainView === 'inbound') return <InboundHub />;

    if (mainView === 'clients') {
      if (subView === 'list') {
        return (
          <ClientsListPage
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
          <ClientDetailPage
            activeClient={activeClient}
            inventory={inventory}
            financials={financials}
            statusSteps={[...STATUS_STEPS]}
            busy={busy}
            hasError={hasError}
            flashSaved={flashSaved}
            onRetry={() => void retryActive()}
            onUpdateField={handleUpdateField}
            onBack={() =>
              void flushAndGo(() => {
                setSubView('list');
                setActiveClientId(null);
                setDraftClient(null);
              })
            }
          />
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
