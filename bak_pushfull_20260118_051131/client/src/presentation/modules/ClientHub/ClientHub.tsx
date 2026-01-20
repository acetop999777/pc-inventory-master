cd ~/pc-inventory-master/client

cat > src/presentation/modules/ClientHub/ClientHub.tsx <<'EOF'
import React from 'react';
import type { ClientEntity } from '../../../domain/client/client.types';
import { calculateFinancials } from '../../../domain/client/client.logic';
import type { ClientHubProps } from '../../../features/clients/types';

import { ClientRow } from './components/ClientRow';

function norm(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function isDeliveredStatus(status: any): boolean {
  const s = norm(status);
  return s === 'delivered' || s === 'done' || s === 'completed';
}

function clientSearchBlob(c: ClientEntity): string {
  const anyC: any = c as any;
  return [
    c.id,
    anyC.wechatName,
    anyC.wechatId,
    anyC.realName,
    anyC.xhsName,
    anyC.xhsId,
    anyC.status,
    anyC.orderDate,
    anyC.deliveryDate,
    anyC.city,
    anyC.state,
    anyC.trackingNumber,
  ]
    .filter(Boolean)
    .map((x) => String(x))
    .join(' ')
    .toLowerCase();
}

function sortByMostRecentOrderDate(a: ClientEntity, b: ClientEntity) {
  const aT = Date.parse(String((a as any).orderDate ?? '')) || 0;
  const bT = Date.parse(String((b as any).orderDate ?? '')) || 0;
  return bT - aT;
}

const UI_TAG_LITERAL = 'UI_TAG: CLIENTS_TABLE_V2_20260119';

// 桌面端的“单行表格”列定义：WeChat / Order / Delivery / Total / Due / Profit / Action
const COLS = 'grid-cols-[minmax(200px,1.6fr)_120px_120px_120px_120px_120px_72px]';

export const ClientHub: React.FC<ClientHubProps> = ({
  clients,
  activeClientId,
  getFinancials,
  onSelectClient,
  onNewClient,
  onDeleteClient,
}) => {
  const [q, setQ] = React.useState('');

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = clients ?? [];
    if (!query) return list;
    return list.filter((c) => clientSearchBlob(c).includes(query));
  }, [clients, q]);

  const active = React.useMemo(
    () =>
      filtered
        .filter((c) => !isDeliveredStatus((c as any).status))
        .sort(sortByMostRecentOrderDate),
    [filtered],
  );

  const archived = React.useMemo(
    () =>
      filtered
        .filter((c) => isDeliveredStatus((c as any).status))
        .sort(sortByMostRecentOrderDate),
    [filtered],
  );

  const computeFinancials = React.useCallback(
    (c: ClientEntity) => (getFinancials ? getFinancials(c) : calculateFinancials(c)),
    [getFinancials],
  );

  const TableHeader = () => (
    <div className={['hidden md:grid items-center gap-2 px-3 py-2', COLS].join(' ')}>
      <div className="text-[11px] font-semibold text-gray-500">WeChat</div>
      <div className="text-[11px] font-semibold text-gray-500 tabular-nums">Order</div>
      <div className="text-[11px] font-semibold text-gray-500 tabular-nums">Delivery</div>
      <div className="text-[11px] font-semibold text-gray-500 text-right tabular-nums">Total</div>
      <div className="text-[11px] font-semibold text-gray-500 text-right tabular-nums">Due</div>
      <div className="text-[11px] font-semibold text-gray-500 text-right tabular-nums">Profit</div>
      <div className="text-[11px] font-semibold text-gray-500 text-right"> </div>
    </div>
  );

  const Empty = ({ text }: { text: string }) => (
    <div className="px-3 py-6 text-sm text-gray-500">{text}</div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* 这个隐藏标记用来证明“你改的代码确实进了 bundle” */}
      <span className="hidden">{UI_TAG_LITERAL}</span>

      {/* Title + New */}
      <div className="flex items-center gap-2">
        <div className="text-xl font-semibold">Clients</div>
        <div className="flex-1" />
        {onNewClient ? (
          <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={onNewClient}>
            New
          </button>
        ) : null}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Search: wechat / name / status / dates..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* ACTIVE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">Active</div>
          <div className="text-xs text-gray-500">{active.length}</div>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="bg-slate-50 border-b">
                <TableHeader />
              </div>

              <div className="space-y-1 p-2">
                {active.map((c) => (
                  <ClientRow
                    key={String((c as any).id ?? c.id)}
                    client={c}
                    financials={computeFinancials(c)}
                    isActive={String((c as any).id ?? c.id) === String(activeClientId)}
                    onSelect={() => onSelectClient?.(c)}
                    onDelete={(e) => {
                      e.stopPropagation();
                      void onDeleteClient?.(String((c as any).id ?? c.id), (c as any).wechatName);
                    }}
                  />
                ))}

                {active.length === 0 ? (
                  <Empty text={q ? 'No active matches.' : 'No active clients.'} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ARCHIVED */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">Archived</div>
          <div className="text-xs text-gray-500">{archived.length}</div>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="bg-slate-50 border-b">
                <TableHeader />
              </div>

              <div className="space-y-1 p-2">
                {archived.map((c) => (
                  <ClientRow
                    key={String((c as any).id ?? c.id)}
                    client={c}
                    financials={computeFinancials(c)}
                    isActive={String((c as any).id ?? c.id) === String(activeClientId)}
                    onSelect={() => onSelectClient?.(c)}
                    onDelete={(e) => {
                      e.stopPropagation();
                      void onDeleteClient?.(String((c as any).id ?? c.id), (c as any).wechatName);
                    }}
                  />
                ))}

                {archived.length === 0 ? (
                  <Empty text={q ? 'No archived matches.' : 'No archived clients.'} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientHub;
EOF
