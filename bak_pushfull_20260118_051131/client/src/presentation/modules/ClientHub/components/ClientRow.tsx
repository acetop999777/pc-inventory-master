cat > src/presentation/modules/ClientHub/components/ClientRow.tsx <<'EOF'
import React from 'react';
import type { ClientRowProps } from '../../../../features/clients/types';

function money(n: any): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0';
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function fmtDate(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return s;
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const UI_TAG_LITERAL = 'UI_TAG: CLIENTS_TABLE_V2_20260119';
const COLS = 'grid-cols-[minmax(200px,1.6fr)_120px_120px_120px_120px_120px_72px]';

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  financials,
  isActive,
  active,
  onSelect,
  onDelete,
}) => {
  const activeFlag = Boolean(isActive ?? active);

  const anyC: any = client as any;
  const name = anyC.wechatName || anyC.realName || anyC.wechatId || client.id;

  const orderDate = fmtDate(anyC.orderDate);
  const deliveryDate = fmtDate(anyC.deliveryDate);

  const total = Number((financials as any)?.orderTotal ?? (financials as any)?.total ?? 0);
  const due = Number((financials as any)?.balanceDue ?? (financials as any)?.due ?? 0);
  const profit = Number((financials as any)?.profit ?? 0);

  return (
    <div
      className={[
        'grid items-center gap-2 px-3 py-2 rounded-md border cursor-pointer',
        COLS,
        activeFlag ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50',
      ].join(' ')}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      data-ui-tag={UI_TAG_LITERAL}
    >
      <div className="min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-[11px] text-gray-500 truncate">
          {anyC.wechatId ? `WeChat: ${anyC.wechatId}` : ''}
          {anyC.status ? `  ·  ${String(anyC.status)}` : ''}
        </div>
      </div>

      <div className="text-sm tabular-nums">{orderDate}</div>
      <div className="text-sm tabular-nums">{deliveryDate}</div>

      <div className="text-sm text-right tabular-nums">{money(total)}</div>
      <div className="text-sm text-right tabular-nums">{money(due)}</div>
      <div className="text-sm text-right tabular-nums">{money(profit)}</div>

      <div className="text-right">
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
