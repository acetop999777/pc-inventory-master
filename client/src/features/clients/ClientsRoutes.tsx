/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ClientEntity } from '../../domain/client/client.types';
import { calculateFinancials, createEmptyClient } from '../../domain/client/client.logic';
import { generateId } from '../../utils';

import { useClientsQuery } from '../../app/queries/clients';
import { useInventoryQuery } from '../../app/queries/inventory';
import { useClientWriteBehind } from '../../app/writeBehind/clientWriteBehind';
import { useSaveQueue } from '../../app/saveQueue/SaveQueueProvider';
import { useNavigationGuard } from '../../app/navigation/NavigationGuard';
import { useConfirm } from '../../app/confirm/ConfirmProvider';

import { ClientsListPage } from './ClientsListPage';
import { ClientDetailPage } from './ClientDetailPage';

const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'] as const;

type DraftSetter = ClientEntity | ((prev: ClientEntity | null) => ClientEntity);
type DraftCtx = {
  getDraft: (id: string) => ClientEntity | null;
  setDraft: (id: string, c: DraftSetter) => void;
  clearDraft: (id: string) => void;
};

const DraftContext = createContext<DraftCtx | null>(null);

function DraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, ClientEntity>>({});

  const getDraft = useCallback((id: string) => drafts[id] ?? null, [drafts]);

  const setDraft = useCallback((id: string, next: DraftSetter) => {
    setDrafts((prev) => {
      const current = prev[id] ?? null;
      const resolved = typeof next === 'function' ? (next as any)(current) : next;
      return { ...prev, [id]: resolved };
    });
  }, []);

  const clearDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const value = useMemo(
    () => ({ getDraft, setDraft, clearDraft }),
    [getDraft, setDraft, clearDraft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

function useDraftStore() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraftStore must be used within ClientsDraftProvider');
  return ctx;
}

function isBlank(v: any) {
  return String(v ?? '').trim().length === 0;
}

/**
 * ✅ AppRouter 依赖这个 export：ClientsDraftProvider
 * 用于在 routes 外层提供 draft store（只在内存，刷新/退出自动作废）。
 */
export function ClientsDraftProvider({ children }: { children: React.ReactNode }) {
  return <DraftProvider>{children}</DraftProvider>;
}

export function ClientsListRoute() {
  const nav = useNavigate();
  const { data } = useClientsQuery();
  const confirmDialog = useConfirm();

  // keep deps stable (avoid memo warnings / churn)
  const clients = useMemo(() => data ?? [], [data]);

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
    [nav],
  );

  const onDeleteClient = useCallback(
    async (id: string, name?: string) => {
      const ok = await confirmDialog({
        title: 'Delete Client',
        message: `Delete ${name ?? 'this client'}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger',
      });
      if (!ok) return;
      remove(id);
    },
    [remove, confirmDialog],
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
  const confirmDialog = useConfirm();

  const { data: clientsData } = useClientsQuery();
  const clients = useMemo(() => clientsData ?? [], [clientsData]);

  const { data: invData } = useInventoryQuery();
  const inventory = useMemo(() => invData ?? [], [invData]);

  const { update: updateClient } = useClientWriteBehind();
  const { queue, snapshot } = useSaveQueue();
  const guard = useNavigationGuard();

  const { getDraft, setDraft, clearDraft } = useDraftStore();
  const draft = clientId ? getDraft(clientId) : null;

  const fromCache = useMemo(() => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId) ?? null;
  }, [clients, clientId]);

  // If user lands on a draft-only id with no draft loaded, seed a blank draft.
  useEffect(() => {
    if (!clientId) return;
    if (draft || fromCache) return;
    const seed = createEmptyClient();
    seed.id = clientId;
    setDraft(clientId, seed);
  }, [clientId, draft, fromCache, setDraft]);

  // ✅ draft-only：未落库（clients query 里没有）
  const isDraftOnly = Boolean(draft) && !fromCache;

  const activeClient: ClientEntity | null = (isDraftOnly ? draft : fromCache) ?? null;

  // ✅ 离开 detail（任何方式）就丢弃未落库 draft（刷新/退出/跳转都会作废）
  useEffect(() => {
    if (!isDraftOnly || !clientId) return;
    return () => {
      clearDraft(clientId);
    };
  }, [isDraftOnly, clientId, clearDraft]);

  // 只有落库后的 client 才有 SaveQueue key
  const activeKey = !isDraftOnly && clientId ? `client:${clientId}` : null;

  // 从 snapshot 找该 key 的状态
  const keyStatus = useMemo(() => {
    if (!activeKey) return null;
    return snapshot.keys.find((k) => k.key === activeKey) ?? null;
  }, [snapshot.keys, activeKey]);

  const busy = Boolean(keyStatus?.pending || keyStatus?.inFlight);
  const hasError = Boolean(keyStatus?.hasError);

  // busy->idle Saved flash（只对落库对象）
  const [flashSaved, setFlashSaved] = useState(false);
  const prevBusyRef = useRef(false);
  const tRef = useRef<any>(null);

  useEffect(() => {
    if (!activeKey) return;
    const prev = prevBusyRef.current;
    prevBusyRef.current = busy;

    if (prev && !busy && !hasError) {
      setFlashSaved(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setFlashSaved(false), 900);
      return;
    }

    if (hasError) setFlashSaved(false);
    if (!busy && !hasError) setFlashSaved(false);
  }, [busy, hasError, activeKey]);

  /**
   * ✅ 核心交互：
   * - wechatName 为空：所有输入只写入 draft（内存），不触发保存、不触发 PCPP 顺序限制、不产生幽灵记录
   * - wechatName 从空 -> 非空：把 draft 当前所有字段一次性 POST 落库
   * - 落库后：恢复“随时填随时存”
   */
  const onUpdateField = useCallback(
    (field: keyof ClientEntity, val: any) => {
      if (!clientId) return;

      if (draft && draft.id === clientId) {
        let willCommit = false;
        let willRealtime = false;
        let nextSnapshot: ClientEntity | null = null;

        setDraft(clientId, (prev) => {
          const base = prev ?? draft;
          const prevWechat = base?.wechatName ?? '';
          const next: ClientEntity = { ...(base as ClientEntity), [field]: val };
          const prevHasWechat = !isBlank(prevWechat);
          const nextHasWechat = !isBlank(next.wechatName);

          willCommit = !prevHasWechat && nextHasWechat && field === 'wechatName';
          willRealtime = prevHasWechat && nextHasWechat;
          nextSnapshot = next;
          return next;
        });

        if (willCommit && nextSnapshot) {
          updateClient(
            clientId,
            { wechatName: String(val ?? '') } as Partial<ClientEntity>,
            nextSnapshot,
          );
          return;
        }

        if (willRealtime && nextSnapshot) {
          updateClient(clientId, { [field]: val } as Partial<ClientEntity>, nextSnapshot);
          return;
        }

        if (isDraftOnly) return;
      }

      // 已落库：正常 write-behind
      updateClient(clientId, { [field]: val } as Partial<ClientEntity>);
    },
    [clientId, isDraftOnly, draft, setDraft, updateClient],
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
    return await confirmDialog({
      title: 'Leave Page?',
      message: 'Sync failed / pending. Leave this page anyway?',
      confirmText: 'Leave',
      cancelText: 'Stay',
      tone: 'danger',
    });
  }, [activeKey, queue, confirmDialog]);

  useEffect(() => {
    // draft-only：不需要 guard（离开就丢弃 draft）
    if (!activeKey) {
      guard.setGuard(null);
      return;
    }
    guard.setGuard(guardFn);
    return () => guard.setGuard(null);
  }, [guard, guardFn, activeKey]);

  const onBack = useCallback(() => {
    // draft-only：直接丢弃并返回
    if (isDraftOnly) {
      if (clientId) clearDraft(clientId);
      nav('/clients');
      return;
    }

    void guard.run(() => nav('/clients'));
  }, [isDraftOnly, clientId, clearDraft, nav, guard]);

  if (!activeClient) return <div className="p-10">Loading...</div>;

  const financials = calculateFinancials(activeClient);

  return (
    <ClientDetailPage
      activeClient={activeClient}
      inventory={inventory}
      financials={financials}
      statusSteps={[...STATUS_STEPS]}
      busy={isDraftOnly ? false : busy}
      hasError={isDraftOnly ? false : hasError}
      flashSaved={isDraftOnly ? false : flashSaved}
      onRetry={() => void retry()}
      onUpdateField={onUpdateField}
      onBack={onBack}
    />
  );
}

/**
 * AppLegacy routes controlled elsewhere; keep wrapper only.
 */
export function ClientsRoutes() {
  return (
    <ClientsDraftProvider>
      <div />
    </ClientsDraftProvider>
  );
}

// test-only escape hatch
export const __getDraftStoreForTests = () => useDraftStore;
