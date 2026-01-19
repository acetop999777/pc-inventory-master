import React from 'react';
import type { ClientEntity } from '../../../domain/client/client.types';
import { calculateFinancials } from '../../../domain/client/client.logic';
import type { ClientHubProps } from '../../../features/clients/types';

import { ClientRow } from './components/ClientRow';

function isDeliveredStatus(status: any): boolean {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  return s === 'delivered' || s === 'done' || s === 'completed';
}

function clientSearchBlob(c: ClientEntity): string {
  const anyC: any = c as any;
  return [
    c.id,
    c.wechatName,
    c.wechatId,
    c.realName,
    anyC.xhsName,
    anyC.xhsId,
    anyC.status,
    anyC.orderDate,
    anyC.deliveryDate,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

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
    if (!query) return clients;
    return clients.filter((c) => clientSearchBlob(c).includes(query));
  }, [clients, q]);

  const active = React.useMemo(
    () => filtered.filter((c) => !isDeliveredStatus((c as any).status)),
    [filtered],
  );

  const archived = React.useMemo(
    () => filtered.filter((c) => isDeliveredStatus((c as any).status)),
    [filtered],
  );

  const computeFinancials = React.useCallback(
    (c: ClientEntity) => (getFinancials ? getFinancials(c) : calculateFinancials(c)),
    [getFinancials],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-xl font-semibold">Clients</div>
        <div className="flex-1" />
        {onNewClient ? (
          <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={onNewClient}>
            New
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Search: wechat / name / status / dates..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="font-medium">Active</div>
        <div className="space-y-1">
          {active.map((c) => (
            <ClientRow
              key={(c as any).id ?? c.id}
              client={c}
              financials={computeFinancials(c)}
              isActive={(c as any).id === activeClientId}
              onSelect={() => onSelectClient?.(c)}
              onDelete={(e) => {
                e.stopPropagation();
                void onDeleteClient?.(String((c as any).id ?? c.id), (c as any).wechatName);
              }}
            />
          ))}
          {active.length === 0 ? (
            <div className="text-sm text-gray-500">No active clients.</div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-medium">Archived</div>
        <div className="space-y-1">
          {archived.map((c) => (
            <ClientRow
              key={(c as any).id ?? c.id}
              client={c}
              financials={computeFinancials(c)}
              isActive={(c as any).id === activeClientId}
              onSelect={() => onSelectClient?.(c)}
              onDelete={(e) => {
                e.stopPropagation();
                void onDeleteClient?.(String((c as any).id ?? c.id), (c as any).wechatName);
              }}
            />
          ))}
          {archived.length === 0 ? (
            <div className="text-sm text-gray-500">No archived clients.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClientHub;
