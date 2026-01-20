import React from 'react';
import { Trash2, Archive } from 'lucide-react';
import type { ClientEntity } from '../../../../domain/client/client.types';
import { calculateFinancials } from '../../../../domain/client/client.logic';

type Props = {
  client: ClientEntity;
  archived?: boolean;
  active?: boolean;
  onSelect?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onArchive?: (e: React.MouseEvent) => void; // optional
};

function norm(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function fmtDateYMD(v: any): string {
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

function fmtDateShort(v: any): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(d);
  } catch {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
  }
}

function money(n: any): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0';
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function firstNum(...vals: any[]): number | null {
  for (const v of vals) {
    const n = toNum(v);
    if (n !== null) return n;
  }
  return null;
}

function StatusPill({ status }: { status: any }) {
  const s = norm(status);
  const label = String(status ?? '').trim() || '—';

  const cls =
    s === 'pending'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : s === 'deposit'
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : s === 'building'
          ? 'bg-violet-50 text-violet-700 ring-violet-200'
          : s === 'ready'
            ? 'bg-teal-50 text-teal-700 ring-teal-200'
            : s === 'delivered'
              ? 'bg-slate-100 text-slate-600 ring-slate-200'
              : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <span className={['inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', cls].join(' ')}>
      {label}
    </span>
  );
}

function computeTotals(client: ClientEntity) {
  const anyC: any = client as any;
  const fin: any = (calculateFinancials(client) as any) ?? {};

  const due = Number(fin?.balanceDue ?? fin?.due ?? 0);
  const profit = Number(fin?.profit ?? 0);

  const paid =
    firstNum(
      fin?.amountPaid,
      fin?.paid,
      fin?.depositPaid,
      fin?.deposit,
      anyC?.amountPaid,
      anyC?.paid,
      anyC?.depositPaid,
      anyC?.deposit,
    ) ?? 0;

  const totalCandidate =
    firstNum(
      fin?.orderTotal,
      fin?.total,
      fin?.revenue,
      fin?.grossTotal,
      fin?.grandTotal,
      anyC?.orderTotal,
      anyC?.total,
      anyC?.order_total,
      anyC?.totalPrice,
      anyC?.total_price,
      anyC?.price,
      anyC?.orderAmount,
      anyC?.order_amount,
    ) ?? 0;

  // Fix: total should never be 0 when due > 0 (your data shows that case)
  let total = totalCandidate;
  if (!Number.isFinite(total) || total <= 0) total = due > 0 ? due + paid : 0;
  if (due > 0 && total > 0 && due > total) total = due + paid > 0 ? due + paid : due;
  if (!Number.isFinite(total) || total <= 0) total = due;

  return { total, due, profit };
}

export const ClientRow: React.FC<Props> = ({
  client,
  archived,
  active,
  onSelect,
  onDelete,
  onArchive,
}) => {
  const anyC: any = client as any;

  // ✅ no realName, no wechatId
  const name = String(anyC.wechatName ?? '').trim() || String(client.id);

  const orderDate = fmtDateYMD(anyC.orderDate);
  const deliveryDate = fmtDateYMD(anyC.deliveryDate);

  const deliveredShort = archived ? fmtDateShort(anyC.deliveryDate ?? anyC.orderDate) : null;

  const { total, due, profit } = computeTotals(client);

  return (
    <div
      className={[
        'group',
        'grid grid-cols-12 gap-3 items-center',
        'px-5 py-3',
        'border-t border-slate-100 first:border-t-0',
        'transition-colors',
        active ? 'bg-sky-50/60' : 'bg-white hover:bg-slate-50',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      {/* Client */}
      <div className="col-span-3 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate leading-5 tracking-tight">
          {name}
        </div>
      </div>

      {/* Status */}
      <div className="col-span-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusPill status={anyC.status} />
          {deliveredShort ? (
            <span className="text-[11px] font-semibold text-slate-400 truncate">
              Delivered {deliveredShort}
            </span>
          ) : null}
        </div>
      </div>

      {/* Order + Delivery */}
      <div className="col-span-4 grid grid-cols-2 gap-1 tabular-nums text-[12px] font-semibold text-slate-700">
        <div>{orderDate}</div>
        <div>{deliveryDate}</div>
      </div>

      {/* Financials + Actions */}
      <div className="col-span-3 flex items-center justify-end gap-2">
        <div className="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
          <span className="inline-flex items-baseline justify-between gap-2 w-[120px] px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</span>
            <span className="text-[12px] font-semibold text-slate-900">{money(total)}</span>
          </span>
          <span className="inline-flex items-baseline justify-between gap-2 w-[120px] px-2 py-1 rounded-xl bg-sky-50 border border-sky-200/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-sky-400">Due</span>
            <span className="text-[12px] font-semibold text-sky-700">{money(due)}</span>
          </span>
          <span className="inline-flex items-baseline justify-between gap-2 w-[120px] px-2 py-1 rounded-xl bg-emerald-50/60 border border-emerald-200/50">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Profit</span>
            <span
              className={[
                'text-[12px] font-semibold',
                profit >= 0 ? 'text-emerald-700' : 'text-rose-700',
              ].join(' ')}
            >
              {money(profit)}
            </span>
          </span>
        </div>

        {/* icon-only actions, only-on-hover (desktop) */}
        <div
          className={[
            'flex items-center gap-1',
            // mobile: always visible; desktop: hover/focus only
            'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
            'transition-opacity',
          ].join(' ')}
        >
          {onArchive ? (
            <button
              type="button"
              onClick={onArchive}
              title="Archive"
              className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
            >
              <Archive size={15} />
              <span className="sr-only">Archive</span>
            </button>
          ) : null}

          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 flex items-center justify-center"
            >
              <Trash2 size={15} />
              <span className="sr-only">Delete</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
