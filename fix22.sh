set -euo pipefail
cd ~/pc-inventory-master

# 1) 新增 clients query
mkdir -p client/src/app/queries
cat > client/src/app/queries/clients.ts <<'EOF'
import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';

export const clientsQueryKey = ['clients'] as const;

async function fetchClients(): Promise<ClientEntity[]> {
  const data = await apiCallOrThrow<ClientEntity[]>('/clients');
  return Array.isArray(data) ? data : [];
}

export function useClientsQuery() {
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: fetchClients,
  });
}
EOF

# 2) 新增 client write-behind（SaveQueue）
mkdir -p client/src/app/writeBehind
cat > client/src/app/writeBehind/clientWriteBehind.ts <<'EOF'
import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';
import { calculateFinancials } from '../../domain/client/client.logic';
import { clientsQueryKey } from '../queries/clients';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';

type ClientWrite =
  | { op: 'upsert'; fields: Partial<ClientEntity>; base?: ClientEntity }
  | { op: 'delete' };

function mergeClientWrite(a: ClientWrite, b: ClientWrite): ClientWrite {
  if (a.op === 'delete' || b.op === 'delete') return { op: 'delete' };
  return {
    op: 'upsert',
    fields: { ...a.fields, ...b.fields },
    base: b.base ?? a.base,
  };
}

function coerce(fields: Partial<ClientEntity>): Partial<ClientEntity> {
  const f: any = { ...fields };
  if (Object.prototype.hasOwnProperty.call(f, 'totalPrice')) f.totalPrice = Number(f.totalPrice ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'paidAmount')) f.paidAmount = Number(f.paidAmount ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'rating')) f.rating = Number(f.rating ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'isShipping')) f.isShipping = Boolean(f.isShipping);
  return f;
}

function upsertInList(old: ClientEntity[], id: string, next: ClientEntity): ClientEntity[] {
  const has = old.some((c) => c.id === id);
  if (!has) return [next, ...old];
  return old.map((c) => (c.id === id ? { ...c, ...next } : c));
}

export function useClientWriteBehind() {
  const qc = useQueryClient();
  const { queue } = useSaveQueue();

  const applyOptimisticIfExists = (id: string, fields: Partial<ClientEntity>) => {
    const nextFields = coerce(fields);
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => {
      if (!old.some((c) => c.id === id)) return old;
      return old.map((c) => (c.id === id ? { ...c, ...nextFields } : c));
    });
  };

  const removeOptimisticIfExists = (id: string) => {
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => old.filter((c) => c.id !== id));
  };

  const update = (id: string, fields: Partial<ClientEntity>, base?: ClientEntity) => {
    applyOptimisticIfExists(id, fields);

    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'upsert', fields: coerce(fields), base },
      merge: mergeClientWrite,
      write: async (w) => {
        if (w.op === 'delete') {
          await apiCallOrThrow(`/clients/${id}`, 'DELETE');
          return;
        }

        const list = qc.getQueryData<ClientEntity[]>(clientsQueryKey) ?? [];
        const current = list.find((c) => c.id === id) ?? w.base;
        if (!current) throw new Error(`Client not found in cache; base required for id=${id}`);

        const merged: ClientEntity = { ...current, ...w.fields };
        const fin = calculateFinancials(merged);

        await apiCallOrThrow('/clients', 'POST', {
          ...merged,
          actualCost: fin.totalCost,
          profit: fin.profit,
        });

        qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => upsertInList(old, id, merged));
      },
      debounceMs: 700,
    });
  };

  const remove = (id: string) => {
    removeOptimisticIfExists(id);
    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'delete' },
      merge: mergeClientWrite,
      write: async () => {
        await apiCallOrThrow(`/clients/${id}`, 'DELETE');
      },
      debounceMs: 0,
    });
  };

  return { update, remove };
}
EOF

# 3) 覆写 AppLegacy：clients 全面用 query + write-behind
cat > client/src/AppLegacy.tsx <<'EOF'
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
  // draft 仅用于“新建但尚未首次落库”的 client（属于 client state）
  const [draftClient, setDraftClient] = useState<ClientEntity | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const { data: clientsData } = useClientsQuery();
  const clients = clientsData ?? [];

  const { data: invData } = useInventoryQuery();
  const inventory = invData ?? [];

  const { update: updateClient, remove: removeClient } = useClientWriteBehind();
  const { queue, snapshot } = useSaveQueue();

  // draft 一旦首次保存成功（进入 clients query cache），就切回“server state 唯一真相”
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

  const pending = Boolean(keyStatus?.pending);
  const inFlight = Boolean(keyStatus?.inFlight);
  const hasError = Boolean(keyStatus?.hasError);
  const busy = pending || inFlight;

  // “Saved” 只在刚同步完成时短暂闪一下；idle 时不常驻
  const [flashSaved, setFlashSaved] = useState(false);
  const savedTimerRef = useRef<any>(null);
  const prevBusyRef = useRef<boolean>(false);

  useEffect(() => {
    // key 切换：重置
    prevBusyRef.current = false;
    setFlashSaved(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, [activeKey]);

  useEffect(() => {
    const prev = prevBusyRef.current;
    if (activeKey && prev && !busy && !hasError) {
      setFlashSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setFlashSaved(false), 900);
    }
    prevBusyRef.current = busy;
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

      // 如果正在编辑该 client：先返回列表（避免 detail 里引用失效）
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

      // draft：先更新本地 draft（client state），并把 draft 作为 base 交给 write-behind
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

        // flush 后检查状态（注意：SaveQueue 在 error 时不会 throw）
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

      // detail
      if (!activeClient) return <div className="p-10">Loading...</div>;
      const financials = calculateFinancials(activeClient);

      return (
        <div className="min-h-screen bg-slate-50">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between max-w-[1600px] mx-auto">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void flushAndGo(() => setSubView('list'))}
                  className="text-slate-500 hover:text-slate-800 transition-colors"
                  title={busy ? 'Syncing before leaving…' : hasError ? 'Sync failed' : 'Back'}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <span className="font-black text-lg text-slate-800">
                  {activeClient.wechatName || 'New Client'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasError && (
                  <>
                    <button
                      onClick={retryActive}
                      className="text-xs font-black px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 active:scale-95 transition-transform"
                      title="Retry sync"
                    >
                      <span className="inline-flex items-center gap-2">
                        <AlertTriangle size={16} /> Retry
                      </span>
                    </button>
                  </>
                )}

                {(busy || flashSaved || hasError) && (
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                    {busy && <Loader2 className="animate-spin" size={16} />}
                    {!busy && !hasError && flashSaved && <CheckCircle2 size={16} className="text-emerald-600" />}
                    {!busy && hasError && <AlertTriangle size={16} className="text-amber-600" />}
                    <span>
                      {busy ? 'Syncing...' : hasError ? 'Sync failed' : 'Saved'}
                    </span>
                  </div>
                )}
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
        </div>
      );
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
        });
      }}
    >
      {renderContent()}
    </MainLayout>
  );
}
EOF

# 4) 提交 + tag + smoke
git add -A
git commit -m "clients: react-query source of truth + savequeue write-behind (draft supported)"
git tag -a "phase4_1_clients_rq_writebehind" -m "Clients migrated to React Query + SaveQueue write-behind"

./scripts/smoke.sh
