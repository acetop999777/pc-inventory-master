import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronDown, Archive } from 'lucide-react';
import { ClientRow } from './ClientRow';
import { ClientEntity } from '../../../domain/client/client.types';
import { calculateFinancials } from '../../../domain/client/client.logic';
import { formatMoney } from '../../../utils';

interface Props {
  clients: ClientEntity[];
  onSelectClient: (client: ClientEntity) => void;
  onNewClient: () => void;
  onDeleteClient: (id: string, name: string) => void;

  /**
   * Optional: if you wire this later, rows will show an Archive icon on hover
   * (e.g. "mark delivered" / "move to archived").
   */
  onArchiveClient?: (id: string, name: string) => void;
}

const UI_TAG = 'UI_TAG: CLIENTHUB_V6_20260119';
const LS_KEY = 'pcinv.clients.archivedOpen.v2';
const LS_ACTIVE_ROW = 'pcinv.clients.lastActiveRow.v1';
const STATUS_FILTER_OPTIONS = ['All', 'Pending', 'Deposit', 'Building', 'Ready', 'Delivered'];

function norm(v: any) {
  return String(v ?? '').trim().toLowerCase();
}
type ClientWithCreated = ClientEntity & { createdAt?: string; created_at?: string };
function isDelivered(c: ClientWithCreated) {
  return norm(c.status) === 'delivered';
}
function toTime(s: any) {
  const t = Date.parse(String(s ?? ''));
  return Number.isFinite(t) ? t : 0;
}
function getFilterTime(c: ClientWithCreated) {
  const raw = c.orderDate ?? c.deliveryDate ?? c.createdAt ?? c.created_at;
  return toTime(raw);
}
function parseDateInput(value: string, endOfDay = false) {
  if (!value) return 0;
  const parts = value.split('-').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return 0;
  const [y, m, d] = parts;
  if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return new Date(y, m - 1, d).getTime();
}
function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseISODate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function buildCalendarCells(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, idx) => {
    const dayOffset = idx - startDay + 1;
    return new Date(year, monthIdx, dayOffset);
  });
}

// Active: prefer orderDate
function sortActive(a: ClientEntity, b: ClientEntity) {
  const aT = toTime(a.orderDate);
  const bT = toTime(b.orderDate);
  if (aT !== bT) return bT - aT;

  const aC = toTime((a as ClientWithCreated).createdAt ?? (a as ClientWithCreated).created_at);
  const bC = toTime((b as ClientWithCreated).createdAt ?? (b as ClientWithCreated).created_at);
  return bC - aC;
}

// Archived: prefer deliveryDate, fallback orderDate, then createdAt
function sortArchived(a: ClientEntity, b: ClientEntity) {
  const aD = toTime(a.deliveryDate);
  const bD = toTime(b.deliveryDate);
  if (aD !== bD) return bD - aD;

  const aO = toTime(a.orderDate);
  const bO = toTime(b.orderDate);
  if (aO !== bO) return bO - aO;

  const aC = toTime((a as ClientWithCreated).createdAt ?? (a as ClientWithCreated).created_at);
  const bC = toTime((b as ClientWithCreated).createdAt ?? (b as ClientWithCreated).created_at);
  return bC - aC;
}

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

function DotCount({ n }: { n: number }) {
  return (
    <span className="text-[10px] font-black text-slate-400">
      <span className="mx-1 text-slate-300">•</span>
      {n}
    </span>
  );
}

export default function ClientHub({
  clients,
  onSelectClient,
  onNewClient,
  onDeleteClient,
  onArchiveClient,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    startOfMonth(parseISODate(dateFrom) ?? new Date()),
  );
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedRendered, setArchivedRendered] = useState(false);

  const statusActive = statusFilter !== 'All';
  const dateActive = Boolean(dateFrom || dateTo);
  const dateFromTs = useMemo(() => parseDateInput(dateFrom, false), [dateFrom]);
  const dateToTs = useMemo(() => parseDateInput(dateTo, true), [dateTo]);

  useEffect(() => {
    if (statusFilter === 'Delivered') setArchivedOpen(true);
  }, [statusFilter]);

  useEffect(() => {
    if (!datePickerOpen) return;
    const base = parseISODate(dateFrom) ?? new Date();
    setCalendarMonth(startOfMonth(base));
  }, [datePickerOpen, dateFrom]);

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      const apply = () => setReduceMotion(Boolean(mq?.matches));
      apply();
      mq?.addEventListener?.('change', apply);
      return () => mq?.removeEventListener?.('change', apply);
    } catch {
      // ignore
    }
  }, []);

  // active highlight (local-only)
  const [activeRowId, setActiveRowId] = useState<string>('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_ACTIVE_ROW) || '';
      if (raw) setActiveRowId(raw);
    } catch {
      // ignore
    }
  }, []);
  const rememberActive = (id: string) => {
    setActiveRowId(id);
    try {
      localStorage.setItem(LS_ACTIVE_ROW, id);
    } catch {
      // ignore
    }
  };

  const searchRef = useRef<HTMLInputElement | null>(null);
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!datePickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (datePickerRef.current && datePickerRef.current.contains(target)) return;
      setDatePickerOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [datePickerOpen]);

  // restore archived open state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === '1') setArchivedOpen(true);
      if (raw === '0') setArchivedOpen(false);
    } catch {
      // ignore
    }
  }, []);

  // persist archived open state
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, archivedOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [archivedOpen]);

  const matches = (c: ClientEntity) => {
    if (statusFilter !== 'All' && norm(c.status) !== norm(statusFilter)) return false;
    if (dateFromTs || dateToTs) {
      const t = getFilterTime(c as ClientWithCreated);
      if (!t) return false;
      if (dateFromTs && t < dateFromTs) return false;
      if (dateToTs && t > dateToTs) return false;
    }
    const q = norm(search);
    if (!q) return true;
    const hay = [
      c.wechatName,
      // keep these for search, but UI won't show them:
      c.wechatId,
      c.realName,
      c.xhsName,
      c.xhsId,
      c.city,
      c.state,
      c.trackingNumber,
      c.status,
      c.orderDate,
      c.deliveryDate,
    ]
      .map(norm)
      .join(' ');
    return hay.includes(q);
  };

  const { active, archived } = useMemo(() => {
    const filtered = (clients ?? []).filter(matches);
    const a = filtered.filter((c) => !isDelivered(c)).sort(sortActive);
    const r = filtered.filter((c) => isDelivered(c)).sort(sortArchived);
    return { active: a, archived: r };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, search, statusFilter, dateFromTs, dateToTs]);

  const activeVisible = active;
  const archivedVisible = archived;
  const forceArchivedOpen = statusFilter === 'Delivered';
  const archivedPanelOpen = forceArchivedOpen || archivedOpen;
  const allVisible = useMemo(
    () => [...activeVisible, ...(archivedPanelOpen ? archivedVisible : [])],
    [activeVisible, archivedPanelOpen, archivedVisible],
  );
  const topMatch = allVisible[0] ?? null;
  const calendarViews = useMemo(() => {
    const left = startOfMonth(calendarMonth);
    const right = addMonths(left, 1);
    return [
      { month: left, cells: buildCalendarCells(left) },
      { month: right, cells: buildCalendarCells(right) },
    ];
  }, [calendarMonth]);

  // keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        const isSearch = e.target === searchRef.current;
        if (!isSearch) return;

        if (e.key === 'Enter') {
          if (topMatch) {
            e.preventDefault();
            rememberActive(String(topMatch.id));
            onSelectClient(topMatch);
          }
        }
        if (e.key === 'Escape') {
          if (search) {
            e.preventDefault();
            setSearch('');
          } else if (archivedOpen) {
            e.preventDefault();
            setArchivedOpen(false);
          }
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key.toLowerCase() === 'n') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        onNewClient();
        return;
      }

      if (e.key === 'Escape') {
        if (search) {
          e.preventDefault();
          setSearch('');
          return;
        }
        if (archivedOpen) {
          e.preventDefault();
          setArchivedOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [archivedOpen, onNewClient, onSelectClient, search, topMatch]);

  // render archived content when opening; when closing keep for animation then unmount
  useLayoutEffect(() => {
    if (archivedPanelOpen) {
      setArchivedRendered(true);
      return;
    }
    if (reduceMotion) {
      setArchivedRendered(false);
      return;
    }
    const t = window.setTimeout(() => setArchivedRendered(false), 300);
    return () => window.clearTimeout(t);
  }, [archivedPanelOpen, reduceMotion]);

  const TableHeader = () => (
    <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center">
      <div className="col-span-3">Client</div>
      <div className="col-span-2">Status</div>
      <div className="col-span-4 grid grid-cols-2 gap-1 tabular-nums">
        <div>Order</div>
        <div>Delivery</div>
      </div>
      <div className="col-span-3 text-right">Financials</div>
    </div>
  );

  const Empty = ({ text }: { text: string }) => (
    <div className="p-6 md:p-10 text-center rounded-2xl md:rounded-none border border-dashed border-slate-200 md:border-0 bg-white md:bg-transparent">
      <div className="text-slate-300 text-xs font-black uppercase tracking-widest">{text}</div>
      <div className="mt-2 text-[11px] font-medium text-slate-400 hidden md:block">
        Tip: press <span className="font-black">n</span> to create, <span className="font-black">/</span> to search.
      </div>
    </div>
  );

  function SectionBar({
    title,
    count,
    collapsible,
    open,
    onToggle,
    leadingIcon,
    sticky,
    sub,
  }: {
    title: string;
    count: number;
    collapsible?: boolean;
    open?: boolean;
    onToggle?: () => void;
    leadingIcon?: React.ReactNode;
    sticky?: boolean;
    sub?: string;
  }) {
    const isOpen = Boolean(open);

    const label = (
      <div className="flex items-center gap-2 min-w-0">
        {leadingIcon ? (
          <span
            className={[
              'shrink-0 transition-colors',
              isOpen ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-300 group-hover:text-slate-500',
            ].join(' ')}
            aria-hidden
          >
            {leadingIcon}
          </span>
        ) : null}

        <div className="min-w-0">
          <div className="flex items-baseline gap-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">
              {title}
            </div>
            <DotCount n={count} />
          </div>
          {sub ? <div className="text-[10px] font-semibold text-slate-400 truncate">{sub}</div> : null}
        </div>
      </div>
    );

    const right = collapsible ? (
      <ChevronDown
        size={14}
        className={[
          'shrink-0 transition-transform duration-200',
          isOpen ? 'rotate-180 text-slate-500' : 'text-slate-300 group-hover:text-slate-500',
        ].join(' ')}
        aria-hidden
      />
    ) : null;

    const inner = !collapsible ? (
      <div className="flex items-center justify-between px-1">{label}</div>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 group select-none"
        aria-expanded={isOpen}
        title={isOpen ? 'Collapse archived' : 'Expand archived'}
      >
        {label}
        {right}
      </button>
    );

    if (!sticky) return <div className="mb-2">{inner}</div>;

    return (
      <div
        className={[
          'md:sticky md:top-4 z-20 -mx-4 md:-mx-8 px-4 md:px-8',
          isOpen
            ? 'py-2 bg-slate-50/70 backdrop-blur border-y border-slate-200/60 shadow-[0_1px_0_rgba(15,23,42,0.06)]'
            : 'py-1 bg-transparent border-t border-slate-200/60 hover:bg-slate-50/70 hover:backdrop-blur',
        ].join(' ')}
      >
        {inner}
      </div>
    );
  }

  // === measured height collapse ===
  const archivedInnerRef = useRef<HTMLDivElement | null>(null);
  const [archivedHeight, setArchivedHeight] = useState(0);

  useLayoutEffect(() => {
    if (!archivedRendered) return;
    const el = archivedInnerRef.current;
    if (!el) return;

    const measure = () => setArchivedHeight(el.scrollHeight || 0);
    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    const raf = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [archivedRendered, archived.length, search]);

  const archivedPanelStyle: React.CSSProperties = {
    height: archivedPanelOpen ? archivedHeight : 0,
    opacity: archivedPanelOpen ? 1 : 0,
    overflow: 'hidden',
    willChange: 'height, opacity',
    transition: reduceMotion ? 'none' : 'height 280ms ease, opacity 180ms ease',
    pointerEvents: archivedPanelOpen ? 'auto' : 'none',
  };

  const totalCount = activeVisible.length + archivedVisible.length;
  const showFilteredCount = Boolean(search || statusFilter !== 'All' || dateFrom || dateTo);
  const countLabel = showFilteredCount ? `${totalCount} matches` : `${clients.length} total`;
  const totals = useMemo(() => {
    const list = [...activeVisible, ...archivedVisible];
    return list.reduce(
      (acc, client) => {
        const fin = calculateFinancials(client);
        acc.due += Number(fin.balanceDue || 0);
        acc.profit += Number(fin.profit || 0);
        return acc;
      },
      { due: 0, profit: 0 },
    );
  }, [activeVisible, archivedVisible]);

  return (
    <div className="p-4 md:p-8 max-w-[96rem] mx-auto pb-32">
      <span className="hidden">{UI_TAG}</span>

      <div className="md:hidden mb-6">
        <div className="relative overflow-hidden rounded-[28px] bg-slate-900 p-5 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Clients
              </div>
              <div className="mt-1 text-2xl font-black tracking-tight">Client Desk</div>
              <div className="mt-2 text-[11px] font-semibold text-slate-300">{countLabel}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                Active
              </div>
              <div className="mt-1 text-xl font-black">{active.length}</div>
              <div className="text-[10px] font-semibold text-slate-400">In progress</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                Archived
              </div>
              <div className="mt-1 text-xl font-black">{archived.length}</div>
              <div className="text-[10px] font-semibold text-slate-400">Delivered</div>
            </div>
          </div>

          <button
            onClick={onNewClient}
            className="mt-4 w-full rounded-2xl bg-white text-slate-900 py-2.5 text-[11px] font-black uppercase tracking-widest shadow-lg"
            title="New client (n)"
          >
            + New Client
          </button>

          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>
      </div>

      <div className="hidden md:block mb-4">
        <h2 className="text-2xl font-semibold text-slate-800">Clients List</h2>
      </div>

      {/* Top Bar */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:rounded-2xl md:border md:border-slate-200 md:bg-slate-50 md:px-4 md:py-3">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="relative w-full md:w-72">
            <input
              ref={searchRef}
              className="w-full rounded-2xl md:rounded-full border border-slate-200 bg-white px-4 py-2 pr-9 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          <div className="hidden md:flex flex-wrap items-center gap-2">
            <div
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold text-slate-700',
                statusActive ? 'border-slate-300 bg-slate-200' : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-[13px] font-semibold text-slate-700 outline-none"
                aria-label="Status filter"
              >
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setDatePickerOpen((v) => !v)}
                className={[
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold text-slate-700',
                  dateActive ? 'border-slate-300 bg-slate-200' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <span>Date Range</span>
              </button>
              {datePickerOpen ? (
                <div className="absolute left-0 top-full mt-2 z-30 w-[36rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                      className="h-7 w-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      ‹
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                        className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(startOfMonth(addMonths(new Date(), 1)))}
                        className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                      >
                        Next Month
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                      className="h-7 w-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      ›
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {calendarViews.map((view) => (
                      <div key={view.month.toISOString()}>
                        <div className="text-center text-sm font-bold text-slate-700">
                          {view.month.toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <div key={d}>{d}</div>
                          ))}
                        </div>

                        <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                          {view.cells.map((d) => {
                            const inMonth = d.getMonth() === view.month.getMonth();
                            const cellIso = toISODate(d);
                            const startDate = dateFrom ? parseISODate(dateFrom) : null;
                            const endDate = dateTo ? parseISODate(dateTo) : null;
                            const cellTs = parseDateInput(cellIso, false);
                            const startTs = startDate
                              ? parseDateInput(toISODate(startDate), false)
                              : 0;
                            const endTs = endDate ? parseDateInput(toISODate(endDate), false) : 0;
                            const isStart = Boolean(startTs && cellTs === startTs);
                            const isEnd = Boolean(endTs && cellTs === endTs);
                            const inRange = Boolean(
                              startTs && endTs && cellTs > startTs && cellTs < endTs,
                            );

                            const cls = [
                              'h-8 w-8 rounded-full text-[12px] font-semibold transition',
                              inMonth ? 'text-slate-700' : 'text-slate-300',
                              inRange ? 'bg-slate-100' : '',
                              isStart || isEnd ? 'bg-slate-900 text-white' : '',
                              !inRange && !isStart && !isEnd ? 'hover:bg-slate-50' : '',
                            ]
                              .filter(Boolean)
                              .join(' ');

                            return (
                              <button
                                key={cellIso}
                                type="button"
                                className={cls}
                                onClick={() => {
                                  const picked = toISODate(d);
                                  const start = dateFrom ? parseISODate(dateFrom) : null;
                                  const end = dateTo ? parseISODate(dateTo) : null;

                                  if (!start || end) {
                                    setDateFrom(picked);
                                    setDateTo('');
                                  } else {
                                    const pickedTs = parseDateInput(picked, false);
                                    const startTsLocal = parseDateInput(toISODate(start), false);
                                    if (pickedTs < startTsLocal) {
                                      setDateFrom(picked);
                                      setDateTo(toISODate(start));
                                    } else {
                                      setDateTo(picked);
                                    }
                                  }

                                  if (!inMonth) {
                                    setCalendarMonth(startOfMonth(d));
                                  }
                                }}
                              >
                                {d.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePickerOpen(false)}
                      className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="md:hidden text-[10px] font-bold text-slate-400">{countLabel}</div>
        </div>

        <div className="flex items-center justify-end gap-3 md:justify-start">
          <div className="hidden md:flex items-center gap-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <span>Total Due</span>
              <span className="text-sm font-black text-slate-800">{formatMoney(totals.due)}</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span>Total Profit</span>
              <span className="text-sm font-black text-slate-800">{formatMoney(totals.profit)}</span>
            </div>
          </div>
          <button
            onClick={onNewClient}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-lg hover:shadow-xl active:scale-[0.99] transition"
            title="New client (n)"
          >
            <Plus size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">New Client</span>
          </button>
        </div>
      </div>

      {/* ACTIVE */}
      <SectionBar title="Active" count={activeVisible.length} sub="In progress" />
      <div className="space-y-4 md:space-y-0 bg-transparent md:bg-white md:rounded-[1.6rem] md:border md:border-slate-200 md:shadow-sm overflow-visible md:overflow-hidden">
        <TableHeader />
        {activeVisible.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            archived={false}
            active={String(c.id) === String(activeRowId)}
            onSelect={() => {
              rememberActive(String(c.id));
              onSelectClient(c);
            }}
            onDelete={(e) => {
              e.stopPropagation();
              onDeleteClient(c.id, c.wechatName);
            }}
            onArchive={
              onArchiveClient
                ? (e) => {
                    e.stopPropagation();
                    onArchiveClient(c.id, c.wechatName);
                  }
                : undefined
            }
          />
        ))}
        {activeVisible.length === 0 && (
          <Empty text={search ? 'No active matches' : 'No active clients'} />
        )}
      </div>

      {/* ARCHIVED */}
      <div className="mt-8">
        <SectionBar
          title="Archived"
          count={archivedVisible.length}
          collapsible={!forceArchivedOpen}
          open={archivedPanelOpen}
          onToggle={!forceArchivedOpen ? () => setArchivedOpen((v) => !v) : undefined}
          leadingIcon={<Archive size={14} />}
          sticky
          sub="Delivered"
        />

        <div style={archivedPanelStyle} aria-hidden={!archivedPanelOpen}>
          <div ref={archivedInnerRef} className="pt-2">
            {archivedRendered ? (
              <div className="space-y-4 md:space-y-0 bg-transparent md:bg-white md:rounded-[1.6rem] md:border md:border-slate-200 md:shadow-sm overflow-visible md:overflow-hidden">
                <TableHeader />
                {archivedVisible.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    archived
                    active={String(c.id) === String(activeRowId)}
                    onSelect={() => {
                      rememberActive(String(c.id));
                      onSelectClient(c);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteClient(c.id, c.wechatName);
                    }}
                    // archived rows usually won't show archive action unless you wire something
                    onArchive={undefined}
                  />
                ))}
                {archivedVisible.length === 0 && (
                  <Empty text={search ? 'No archived matches' : 'No archived clients'} />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
