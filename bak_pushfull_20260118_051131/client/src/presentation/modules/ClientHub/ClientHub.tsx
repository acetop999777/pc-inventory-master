import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronDown, Archive } from 'lucide-react';
import { ClientRow } from './components/ClientRow';
import { ClientEntity } from '../../../domain/client/client.types';

interface Props {
  clients: ClientEntity[];
  onSelectClient: (client: ClientEntity) => void;
  onNewClient: () => void;
  onDeleteClient: (id: string, name: string) => void;
}

function norm(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function isDelivered(c: ClientEntity) {
  return norm((c as any).status) === 'delivered';
}

function sortByMostRecent(a: ClientEntity, b: ClientEntity) {
  const aT = Date.parse(String((a as any).orderDate ?? '')) || 0;
  const bT = Date.parse(String((b as any).orderDate ?? '')) || 0;
  return bT - aT;
}

export default function ClientHub({ clients, onSelectClient, onNewClient, onDeleteClient }: Props) {
  const [search, setSearch] = useState('');
  const [archivedOpen, setArchivedOpen] = useState(false);

  // 让关闭时也能“动画收起”后再卸载内容（避免突然消失）
  const [archivedRendered, setArchivedRendered] = useState(false);

  const matches = (c: ClientEntity) => {
    const q = norm(search);
    if (!q) return true;
    const hay = [
      (c as any).wechatName,
      (c as any).wechatId,
      (c as any).realName,
      (c as any).xhsName,
      (c as any).xhsId,
      (c as any).city,
      (c as any).state,
      (c as any).trackingNumber,
    ]
      .map(norm)
      .join(' ');
    return hay.includes(q);
  };

  const { active, archived } = useMemo(() => {
    const filtered = (clients ?? []).filter(matches);
    const a = filtered.filter((c) => !isDelivered(c)).sort(sortByMostRecent);
    const r = filtered.filter((c) => isDelivered(c)).sort(sortByMostRecent);
    return { active: a, archived: r };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, search]);

  // 打开时渲染内容；关闭时等动画结束再卸载
  useLayoutEffect(() => {
    if (archivedOpen) {
      setArchivedRendered(true);
      return;
    }
    const t = window.setTimeout(() => setArchivedRendered(false), 280);
    return () => window.clearTimeout(t);
  }, [archivedOpen]);

  const TableHeader = () => (
    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center">
      <div className="col-span-3">Client (WeChat)</div>
      <div className="col-span-2">Status</div>
      <div className="col-span-2">Order Date</div>
      <div className="col-span-2">Delivery Date</div>
      <div className="col-span-3 text-right">Financials</div>
    </div>
  );

  const Empty = ({ text }: { text: string }) => (
    <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase italic">{text}</div>
  );

  function SectionLabel({
    title,
    count,
    collapsible,
    open,
    onToggle,
    leadingIcon,
    sticky,
  }: {
    title: string;
    count: number;
    collapsible?: boolean;
    open?: boolean;
    onToggle?: () => void;
    leadingIcon?: React.ReactNode;
    sticky?: boolean;
  }) {
    const inner = !collapsible ? (
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</div>
          <span className="text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
            {count}
          </span>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 group"
        aria-expanded={Boolean(open)}
      >
        <div className="flex items-center gap-2">
          {leadingIcon ? <span className="text-slate-400">{leadingIcon}</span> : null}
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600">
            {title}
          </div>
          <span className="text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
            {count}
          </span>
        </div>

        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
    );

    if (sticky) {
      return (
        <div className="sticky top-4 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-slate-50/70 backdrop-blur border-y border-slate-200/60">
          {inner}
        </div>
      );
    }

    return <div className="mb-2">{inner}</div>;
  }

  // ===== Real measured-height collapse animation (no max-height hacks) =====
  const archivedInnerRef = useRef<HTMLDivElement | null>(null);
  const [archivedHeight, setArchivedHeight] = useState(0);

  useLayoutEffect(() => {
    if (!archivedRendered) return;
    const el = archivedInnerRef.current;
    if (!el) return;

    const measure = () => {
      // scrollHeight = content真实高度
      setArchivedHeight(el.scrollHeight || 0);
    };

    measure();

    // 内容变化（比如搜索过滤、字体加载、行数变化）自动更新高度
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    // 某些情况下（字体/图片加载）ResizeObserver不一定立刻触发，补一帧
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
    transition: 'height 280ms ease, opacity 200ms ease',
    pointerEvents: archivedOpen ? 'auto' : 'none',
  };

  return (
    <div className="p-4 md:p-8 max-w-[95rem] mx-auto pb-32">
      {/* Search + New */}
      <div className="flex gap-4 mb-6 items-center">
        <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
          <Search size={16} className="ml-2 text-slate-400" />
          <input
            className="w-full text-xs font-bold outline-none"
            placeholder="Search Clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={onNewClient}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-transform"
          title="New client"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* ACTIVE */}
      <SectionLabel title="Active" count={active.length} />
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <TableHeader />
        {active.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            onSelect={() => onSelectClient(c)}
            onDelete={(e) => {
              e.stopPropagation();
              onDeleteClient(c.id, (c as any).wechatName);
            }}
          />
        ))}
        {active.length === 0 && <Empty text={search ? 'No active matches' : 'No active clients'} />}
      </div>

      {/* ARCHIVED */}
      <div className="mt-8">
        <SectionLabel
          title="Archived"
          count={archived.length}
          collapsible
          open={archivedOpen}
          onToggle={() => setArchivedOpen((v) => !v)}
          leadingIcon={<Archive size={14} />}
          sticky
        />

        <div style={archivedPanelStyle} aria-hidden={!archivedOpen}>
          <div ref={archivedInnerRef} className="pt-2">
            {archivedRendered ? (
              <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <TableHeader />
                {archived.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    onSelect={() => onSelectClient(c)}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteClient(c.id, (c as any).wechatName);
                    }}
                  />
                ))}
                {archived.length === 0 && (
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
