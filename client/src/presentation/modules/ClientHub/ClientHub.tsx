import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronDown, Archive, X } from 'lucide-react';
import { ClientRow } from './components/ClientRow';
import { ClientEntity } from '../../../domain/client/client.types';

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

function norm(v: any) {
  return String(v ?? '').trim().toLowerCase();
}
function isDelivered(c: ClientEntity) {
  return norm((c as any).status) === 'delivered';
}
function toTime(s: any) {
  const t = Date.parse(String(s ?? ''));
  return Number.isFinite(t) ? t : 0;
}

// Active: prefer orderDate
function sortActive(a: ClientEntity, b: ClientEntity) {
  const aT = toTime((a as any).orderDate);
  const bT = toTime((b as any).orderDate);
  if (aT !== bT) return bT - aT;

  const aC = toTime((a as any).createdAt ?? (a as any).created_at);
  const bC = toTime((b as any).createdAt ?? (b as any).created_at);
  return bC - aC;
}

// Archived: prefer deliveryDate, fallback orderDate, then createdAt
function sortArchived(a: ClientEntity, b: ClientEntity) {
  const aD = toTime((a as any).deliveryDate);
  const bD = toTime((b as any).deliveryDate);
  if (aD !== bD) return bD - aD;

  const aO = toTime((a as any).orderDate);
  const bO = toTime((b as any).orderDate);
  if (aO !== bO) return bO - aO;

  const aC = toTime((a as any).createdAt ?? (a as any).created_at);
  const bC = toTime((b as any).createdAt ?? (b as any).created_at);
  return bC - aC;
}

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((t as any).isContentEditable) return true;
  return false;
}

function Kbd({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] text-[10px] font-black uppercase tracking-wider text-slate-500"
    >
      {children}
    </span>
  );
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
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedRendered, setArchivedRendered] = useState(false);

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
    const q = norm(search);
    if (!q) return true;
    const hay = [
      (c as any).wechatName,
      // keep these for search, but UI won't show them:
      (c as any).wechatId,
      (c as any).realName,
      (c as any).xhsName,
      (c as any).xhsId,
      (c as any).city,
      (c as any).state,
      (c as any).trackingNumber,
      (c as any).status,
      (c as any).orderDate,
      (c as any).deliveryDate,
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
  }, [clients, search]);

  const allVisible = useMemo(() => [...active, ...(archivedOpen ? archived : [])], [active, archived, archivedOpen]);
  const topMatch = allVisible[0] ?? null;

  // keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        const isSearch = e.target === searchRef.current;
        if (!isSearch) return;

        if (e.key === 'Enter') {
          if (topMatch) {
            e.preventDefault();
            rememberActive(String((topMatch as any).id ?? topMatch.id));
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
    if (archivedOpen) {
      setArchivedRendered(true);
      return;
    }
    if (reduceMotion) {
      setArchivedRendered(false);
      return;
    }
    const t = window.setTimeout(() => setArchivedRendered(false), 300);
    return () => window.clearTimeout(t);
  }, [archivedOpen, reduceMotion]);

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
    <div className="p-10 text-center">
      <div className="text-slate-300 text-xs font-black uppercase tracking-widest">{text}</div>
      <div className="mt-2 text-[11px] font-medium text-slate-400">
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
          'sticky top-4 z-20 -mx-4 md:-mx-8 px-4 md:px-8',
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
    height: archivedOpen ? archivedHeight : 0,
    opacity: archivedOpen ? 1 : 0,
    overflow: 'hidden',
    willChange: 'height, opacity',
    transition: reduceMotion ? 'none' : 'height 280ms ease, opacity 180ms ease',
    pointerEvents: archivedOpen ? 'auto' : 'none',
  };

  const clearSearch = () => setSearch('');

  return (
    <div className="p-4 md:p-8 max-w-[96rem] mx-auto pb-32">
      <span className="hidden">{UI_TAG}</span>

      {/* Top Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-200 transition">
            <Search size={16} className="text-slate-400" />
            <input
              ref={searchRef}
              className="w-full text-[12px] font-bold outline-none placeholder:text-slate-300"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
                title="Clear (Esc)"
              >
                <X size={14} className="text-slate-500" />
              </button>
            ) : null}
          </div>

          {/* Shortcut chips */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Kbd title="Focus search">/</Kbd>
            <Kbd title="New client">n</Kbd>
            <Kbd title="Clear / collapse">Esc</Kbd>
            <Kbd title="Open top match from search input">Enter</Kbd>
            <span className="text-[10px] font-bold text-slate-400 ml-1">
              {search ? `${active.length + archived.length} matches` : `${clients.length} total`}
            </span>
          </div>
        </div>

        {/* New */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onNewClient}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition"
            title="New client (n)"
          >
            <Plus size={16} />
            <span className="text-[11px] font-black uppercase tracking-wider">New</span>
          </button>
        </div>
      </div>

      {/* ACTIVE */}
      <SectionBar title="Active" count={active.length} sub="In progress" />
      <div className="bg-white rounded-[1.6rem] border border-slate-200 shadow-sm overflow-hidden">
        <TableHeader />
        {active.map((c) => (
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
              onDeleteClient(c.id, (c as any).wechatName);
            }}
            onArchive={
              onArchiveClient
                ? (e) => {
                    e.stopPropagation();
                    onArchiveClient(c.id, (c as any).wechatName);
                  }
                : undefined
            }
          />
        ))}
        {active.length === 0 && <Empty text={search ? 'No active matches' : 'No active clients'} />}
      </div>

      {/* ARCHIVED */}
      <div className="mt-8">
        <SectionBar
          title="Archived"
          count={archived.length}
          collapsible
          open={archivedOpen}
          onToggle={() => setArchivedOpen((v) => !v)}
          leadingIcon={<Archive size={14} />}
          sticky
          sub="Delivered"
        />

        <div style={archivedPanelStyle} aria-hidden={!archivedOpen}>
          <div ref={archivedInnerRef} className="pt-2">
            {archivedRendered ? (
              <div className="bg-white rounded-[1.6rem] border border-slate-200 shadow-sm overflow-hidden">
                <TableHeader />
                {archived.map((c) => (
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
                      onDeleteClient(c.id, (c as any).wechatName);
                    }}
                    // archived rows usually won't show archive action unless you wire something
                    onArchive={undefined}
                  />
                ))}
                {archived.length === 0 && <Empty text={search ? 'No archived matches' : 'No archived clients'} />}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
