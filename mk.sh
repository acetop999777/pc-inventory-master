cd ~/pc-inventory-master

cat > client/src/presentation/modules/ClientHub/components/ClientRow.tsx <<'EOF'
import React from 'react';
import type { ClientRowProps } from '../../../../features/clients/types';

function money(n: any): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  financials,
  isActive,
  active,
  onSelect,
  onDelete,
}) => {
  const activeFlag = Boolean(isActive ?? active);

  const due = Number((financials as any)?.balanceDue ?? 0);
  const profit = Number((financials as any)?.profit ?? 0);

  return (
    <div
      className={[
        'flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer',
        activeFlag ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50',
      ].join(' ')}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0">
        <div className="font-medium truncate">
          {(client as any).wechatName || (client as any).realName || (client as any).wechatId || client.id}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {(client as any).realName ? `Real: ${(client as any).realName}` : ''}
          {(client as any).wechatId ? `  WeChat: ${(client as any).wechatId}` : ''}
          {(client as any).status ? `  Status: ${(client as any).status}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-sm">{money(due)}</div>
          <div className="text-xs text-gray-500">profit {money(profit)}</div>
        </div>

        {onDelete ? (
          <button
            className="px-2 py-1 rounded-md border hover:bg-red-50"
            onClick={onDelete}
            title="Delete"
          >
            Del
          </button>
        ) : null}
      </div>
    </div>
  );
};
EOF
