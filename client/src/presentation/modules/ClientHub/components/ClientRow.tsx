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

type ClientLegacyFields = ClientEntity & {
  amountPaid?: number | string;
  paid?: number | string;
  depositPaid?: number | string;
  deposit?: number | string;
  orderTotal?: number | string;
  total?: number | string;
  order_total?: number | string;
  totalPrice?: number | string;
  total_price?: number | string;
  price?: number | string;
  orderAmount?: number | string;
  order_amount?: number | string;
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

function StatusPill({ status }: { status?: string }) {
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
  const c = client as ClientLegacyFields;
  const fin = calculateFinancials(client);

  const due = Number(fin.balanceDue ?? 0);
  const profit = Number(fin.profit ?? 0);

  const paid =
    firstNum(
      c.amountPaid,
      c.paid,
      c.depositPaid,
      c.deposit,
      c.paidAmount,
    ) ?? 0;

  const totalCandidate =
    firstNum(
      c.orderTotal,
      c.total,
      c.order_total,
      c.totalPrice,
      c.total_price,
      c.price,
      c.orderAmount,
      c.order_amount,
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
  const c = client as ClientLegacyFields;

  // ✅ no realName, no wechatId
  const name = String(c.wechatName ?? '').trim() || String(client.id);

  const orderDate = fmtDateYMD(c.orderDate);
  const deliveryDate = fmtDateYMD(c.deliveryDate);

  const deliveredShort = archived ? fmtDateShort(c.deliveryDate ?? c.orderDate) : null;

  const { total, due, profit } = computeTotals(client);

  return (
    <div
      className={[
        'group',
        'transition-colors',
        'border border-slate-200 rounded-2xl bg-white shadow-sm',
        'md:rounded-none md:border-0 md:border-t md:border-slate-100 md:first:border-t-0 md:shadow-none',
        active
          ? 'ring-2 ring-sky-200 md:ring-0 md:bg-sky-50/60'
          : 'md:hover:bg-slate-50',
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
      <div className="md:hidden p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Client
            </div>
            <div className="mt-1 text-base font-black text-slate-900 truncate">{name}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusPill status={c.status} />
            {deliveredShort ? (
              <span className="text-[10px] font-semibold text-slate-400">
                Delivered {deliveredShort}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Order
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-700 tabular-nums">
              {orderDate}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Delivery
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-700 tabular-nums">
              {deliveryDate}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 tabular-nums">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Total
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{money(total)}</div>
          </div>
          <div className="rounded-xl border border-sky-200/70 bg-sky-50 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-sky-400">
              Due
            </div>
            <div className="mt-1 text-sm font-semibold text-sky-700">{money(due)}</div>
          </div>
          <div
            className={[
              'rounded-xl border px-3 py-2',
              profit >= 0
                ? 'border-emerald-200/60 bg-emerald-50/60 text-emerald-700'
                : 'border-rose-200/60 bg-rose-50 text-rose-700',
            ].join(' ')}
          >
            <div className="text-[9px] font-black uppercase tracking-widest">Profit</div>
            <div className="mt-1 text-sm font-semibold">{money(profit)}</div>
          </div>
        </div>

        {(onArchive || onDelete) && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Tap to open
            </span>
            <div className="flex items-center gap-2">
              {onArchive ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(e);
                  }}
                  title="Archive"
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
                >
                  <Archive size={15} className="mx-auto" />
                  <span className="sr-only">Archive</span>
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e);
                  }}
                  title="Delete"
                  className="h-9 w-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"
                >
                  <Trash2 size={15} className="mx-auto" />
                  <span className="sr-only">Delete</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:grid grid-cols-12 gap-3 items-center px-5 py-3">
        {/* Client */}
        <div className="col-span-3 min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 truncate leading-5 tracking-tight">
            {name}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <StatusPill status={c.status} />
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
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Total
              </span>
              <span className="text-[12px] font-semibold text-slate-900">{money(total)}</span>
            </span>
            <span className="inline-flex items-baseline justify-between gap-2 w-[120px] px-2 py-1 rounded-xl bg-sky-50 border border-sky-200/60">
              <span className="text-[9px] font-black uppercase tracking-widest text-sky-400">
                Due
              </span>
              <span className="text-[12px] font-semibold text-sky-700">{money(due)}</span>
            </span>
            <span className="inline-flex items-baseline justify-between gap-2 w-[120px] px-2 py-1 rounded-xl bg-emerald-50/60 border border-emerald-200/50">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                Profit
              </span>
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
              'opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
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
    </div>
  );
};
