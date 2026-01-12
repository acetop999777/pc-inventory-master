set -euo pipefail
cd ~/pc-inventory-master

# ---- 0) 给 client 增加 react-router-dom 依赖（只更新 lock，不装 node_modules）----
cd client
npm pkg set dependencies.react-router-dom="^6.26.2"
npm install --package-lock-only
cd ..

# ---- 1) 新增 NavigationGuard（用于“离开页面前 flushKey”）----
mkdir -p client/src/app/navigation
cat > client/src/app/navigation/NavigationGuard.tsx <<'EOF'
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

type GuardFn = () => Promise<boolean>;

type Ctx = {
  setGuard: (fn: GuardFn | null) => void;
  run: (next: () => void) => Promise<void>;
};

const NavigationGuardContext = createContext<Ctx | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);

  const setGuard = useCallback((fn: GuardFn | null) => {
    guardRef.current = fn;
  }, []);

  const run = useCallback(async (next: () => void) => {
    const g = guardRef.current;
    if (!g) {
      next();
      return;
    }
    const ok = await g();
    if (ok) next();
  }, []);

  const value = useMemo(() => ({ setGuard, run }), [setGuard, run]);

  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  return ctx;
}
EOF

# ---- 2) 新增 ClientsRoutes（把 draft + list/detail 逻辑迁到 feature 内）----
cat > client/src/features/clients/ClientsRoutes.tsx <<'EOF'
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
EOF

# ---- 3) 重写 AppLegacy：改为 HashRouter + Routes，并用 NavigationGuard 保留“离开前 flush”语义 ----
cat > client/src/AppLegacy.tsx <<'EOF'
import React, { useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { MainLayout } from './presentation/layouts/MainLayout';
import Dashboard from './presentation/modules/Dashboard/Dashboard';
import InventoryHub from './presentation/modules/Inventory/InventoryHub';
import InboundHub from './presentation/modules/Inbound/InboundHub';

import { NavigationGuardProvider, useNavigationGuard } from './app/navigation/NavigationGuard';
import { ClientsDraftProvider, ClientsListRoute, ClientDetailRoute } from './features/clients/ClientsRoutes';

function viewFromPath(pathname: string): 'clients' | 'inventory' | 'inbound' | 'dashboard' {
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/inbound')) return 'inbound';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return 'clients';
}

function pathForView(v: string): string {
  switch (v) {
    case 'inventory':
      return '/inventory';
    case 'inbound':
      return '/inbound';
    case 'dashboard':
      return '/dashboard';
    default:
      return '/clients';
  }
}

function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const guard = useNavigationGuard();

  const currentView = useMemo(() => viewFromPath(loc.pathname), [loc.pathname]);

  return (
    <MainLayout
      currentView={currentView}
      onChangeView={(v) => {
        void guard.run(() => nav(pathForView(v)));
      }}
    >
      <ClientsDraftProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryHub />} />
          <Route path="/inbound" element={<InboundHub />} />

          <Route path="/clients" element={<ClientsListRoute />} />
          <Route path="/clients/:id" element={<ClientDetailRoute />} />

          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </ClientsDraftProvider>
    </MainLayout>
  );
}

export default function AppLegacy() {
  return (
    <HashRouter>
      <NavigationGuardProvider>
        <AppShell />
      </NavigationGuardProvider>
    </HashRouter>
  );
}
EOF

# ---- 4) build + smoke（先不 commit，确保全绿）----
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
