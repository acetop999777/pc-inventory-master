import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ClientEntity } from '../../domain/client/client.types';
import { calculateFinancials, createEmptyClient } from '../../domain/client/client.logic';
import { generateId } from '../../utils';

import { useClientsQuery } from '../../app/queries/clients';
import { useInventoryQuery } from '../../app/queries/inventory';
import { useClientWriteBehind } from '../../app/writeBehind/clientWriteBehind';
import { useSaveQueue } from '../../app/saveQueue/SaveQueueProvider';
import { useNavigationGuard } from '../../app/navigation/NavigationGuard';

import { ClientsListPage } from './ClientsListPage';
import { ClientDetailPage } from './ClientDetailPage';

const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'] as const;

type DraftCtx = {
  getDraft: (id: string) => ClientEntity | null;
  setDraft: (id: string, c: ClientEntity) => void;
  clearDraft: (id: string) => void;
};

const DraftContext = createContext<DraftCtx | null>(null);

function DraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, ClientEntity>>({});

  const getDraft = useCallback((id: string) => drafts[id] ?? null, [drafts]);
  const setDraft = useCallback((id: string, c: ClientEntity) => {
    setDrafts((prev) => ({ ...prev, [id]: c }));
  }, []);
  const clearDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const value = useMemo(() => ({ getDraft, setDraft, clearDraft }), [getDraft, setDraft, clearDraft]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

function useDraftStore() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraftStore must be used within DraftProvider');
  return ctx;
}

export function ClientsListRoute() {
  const nav = useNavigate();
  const { data } = useClientsQuery();
  const clients = data ?? [];
  const { remove } = useClientWriteBehind();
  const { setDraft } = useDraftStore();

  const onNewClient = useCallback(() => {
    const c = createEmptyClient();
    c.id = generateId();
    setDraft(c.id, c);
    nav(`/clients/${c.id}`);
  }, [nav, setDraft]);

  const onSelectClient = useCallback(
    (c: ClientEntity) => {
      nav(`/clients/${c.id}`);
    },
    [nav]
  );

  const onDeleteClient = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete ${name}?`)) return;
      remove(id);
    },
    [remove]
  );

  return (
    <ClientsListPage
      clients={clients}
      onSelectClient={onSelectClient}
      onNewClient={onNewClient}
      onDeleteClient={onDeleteClient}
    />
  );
}

export function ClientDetailRoute() {
  const nav = useNavigate();
  const { id } = useParams();
  const clientId = String(id ?? '');
  const activeKey = clientId ? `client:${clientId}` : null;

  const { data: clientsData } = useClientsQuery();
  const clients = clientsData ?? [];

  const { data: invData } = useInventoryQuery();
  const inventory = invData ?? [];

  const { update: updateClient } = useClientWriteBehind();
  const { queue, snapshot } = useSaveQueue();
  const guard = useNavigationGuard();

  const { getDraft, setDraft, clearDraft } = useDraftStore();
  const draft = clientId ? getDraft(clientId) : null;

  const fromCache = useMemo(() => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId) ?? null;
  }, [clients, clientId]);

  const activeClient: ClientEntity | null = draft ?? fromCache;

  // draft 一旦成功落库（进入 query cache），就清掉 draft
  useEffect(() => {
    if (!clientId || !draft) return;
    if (clients.some((c) => c.id === clientId)) clearDraft(clientId);
  }, [clientId, clients, clearDraft, draft]);

  const keyStatus = useMemo(() => {
    if (!activeKey) return null;
    return snapshot.keys.find((k) => k.key === activeKey) ?? null;
  }, [snapshot.keys, activeKey]);

  const busy = Boolean(keyStatus?.pending || keyStatus?.inFlight);
  const hasError = Boolean(keyStatus?.hasError);

  // busy->idle Saved flash
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

  const onUpdateField = useCallback(
    (field: keyof ClientEntity, val: any) => {
      if (!clientId) return;

      if (draft && draft.id === clientId) {
        const next: ClientEntity = { ...draft, [field]: val };
        setDraft(clientId, next);
        updateClient(clientId, { [field]: val } as Partial<ClientEntity>, next);
        return;
      }

      updateClient(clientId, { [field]: val } as Partial<ClientEntity>);
    },
    [clientId, draft, setDraft, updateClient]
  );

  const retry = useCallback(async () => {
    if (!activeKey) return;
    await queue.flushKey(activeKey);
  }, [activeKey, queue]);

  const guardFn = useCallback(async () => {
    if (!activeKey) return true;

    await queue.flushKey(activeKey);

    const post = queue.getSnapshot().keys.find((k) => k.key === activeKey);
    const blocked = post ? post.hasError || post.pending || post.inFlight : false;

    if (!blocked) return true;
    return window.confirm('Sync failed / pending. Leave this page anyway?');
  }, [activeKey, queue]);

  useEffect(() => {
    // 进入 detail 时注册 guard，离开时取消
    guard.setGuard(guardFn);
    return () => guard.setGuard(null);
  }, [guard, guardFn]);

  const onBack = useCallback(() => {
    void guard.run(() => {
      // 若 draft 没成功落库，返回列表即丢弃（不产生幽灵记录）
      if (clientId && draft && !clients.some((c) => c.id === clientId)) clearDraft(clientId);
      nav('/clients');
    });
  }, [guard, nav, clientId, draft, clients, clearDraft]);

  if (!activeClient) return <div className="p-10">Loading...</div>;

  const financials = calculateFinancials(activeClient);

  return (
    <ClientDetailPage
      activeClient={activeClient}
      inventory={inventory}
      financials={financials}
      statusSteps={[...STATUS_STEPS]}
      busy={busy}
      hasError={hasError}
      flashSaved={flashSaved}
      onRetry={() => void retry()}
      onUpdateField={onUpdateField}
      onBack={onBack}
    />
  );
}

export function ClientsRoutes() {
  return (
    <DraftProvider>
      {/* list/detail 由 AppLegacy 的 Routes 控制 */}
      <div />
    </DraftProvider>
  );
}

// 供 AppLegacy 复用同一个 DraftProvider
export function ClientsDraftProvider({ children }: { children: React.ReactNode }) {
  return <DraftProvider>{children}</DraftProvider>;
}
