import React, { useMemo, useState } from 'react';
import { Cpu, ExternalLink, Copy, Check, X } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import type { UpdateClientField } from '../../types';
import { InventoryItem } from '../../../../types';
import { CORE_CATS } from '../../../../utils';
import { parsePcppText } from '../pcpp';

interface Props {
  data: ClientEntity;
  inventory: InventoryItem[];
  update: UpdateClientField;
  onCalculate?: () => void;
}

type SpecRow = {
  name?: string;
  sku?: string;
  cost?: number | string;
  qty?: number;
  needsPurchase?: boolean;
};

const SHIPPING_KEY = 'SHIPPING';
type ClientSpecs = ClientEntity['specs'];
type ClientSpecRow = ClientSpecs[string];

function upsUrlFromText(text: string): string | null {
  if (!text) return null;
  const raw = text.trim();

  // if user pasted a url, just use it
  if (/^https?:\/\//i.test(raw)) return raw;

  // try to extract UPS tracking number like 1Zxxxxxxxxxxxxxxxx
  const m = raw.match(/\b1Z[0-9A-Z]{16}\b/i);
  if (m) {
    const tn = m[0].toUpperCase();
    return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(tn)}`;
  }

  return null;
}

export const SpecsTable: React.FC<Props> = ({ data, inventory, update, onCalculate }) => {
  const [activeDrop, setActiveDrop] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // cost drafts so decimal typing isn't destroyed by parseFloat on each keystroke
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});

  const specsObj: Record<string, SpecRow> = useMemo(() => {
    const s = data.specs;
    if (!s || typeof s !== 'object') return {};

    const out: Record<string, SpecRow> = {};
    for (const [key, val] of Object.entries(s)) {
      out[key] = { ...(val as ClientSpecRow) };
    }
    return out;
  }, [data.specs]);
  const shipRequired = Boolean(data.isShipping);
  const pcppLink = String(data.pcppLink || '').trim();

  const normalizeSpecs = (specs: Record<string, SpecRow>): ClientSpecs => {
    const out: ClientSpecs = {};
    for (const [key, row] of Object.entries(specs)) {
      const costNum = Number(row.cost ?? 0);
      const qtyNum = Number(row.qty ?? 0);
      out[key] = {
        name: String(row.name ?? ''),
        sku: String(row.sku ?? ''),
        cost: Number.isFinite(costNum) ? costNum : 0,
        qty: Number.isFinite(qtyNum) ? qtyNum : 0,
        needsPurchase: Boolean(row.needsPurchase),
      };
    }
    return out;
  };

  const displayCats = useMemo(() => {
    const base = Array.from(new Set([...CORE_CATS, ...Object.keys(specsObj)]));

    // SHIPPING: only when shipping required; always last
    let withShip = base;
    if (shipRequired) withShip = Array.from(new Set([...base, SHIPPING_KEY]));
    else withShip = base.filter((c) => c !== SHIPPING_KEY);

    const sorted = withShip.sort((a, b) => {
      if (a === SHIPPING_KEY) return 1;
      if (b === SHIPPING_KEY) return -1;

      const aCore = a.split(' ')[0];
      const bCore = b.split(' ')[0];
      const ia = CORE_CATS.indexOf(aCore);
      const ib = CORE_CATS.indexOf(bCore);

      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });

    return sorted;
  }, [specsObj, shipRequired]);

  const parsePCPP = (text: string) => {
    if (!text) return;
    const parsed = parsePcppText(text, inventory);
    if (!parsed) return;

    const newSpecs: Record<string, SpecRow> = { ...parsed.specs };
    if (specsObj?.[SHIPPING_KEY]) newSpecs[SHIPPING_KEY] = specsObj[SHIPPING_KEY];

    update('specs', normalizeSpecs(newSpecs));
    if (parsed.link) update('pcppLink', parsed.link);
    onCalculate?.();
  };

  const updateSpec = (cat: string, field: keyof SpecRow, val: any) => {
    const cur = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
    const nextRow: SpecRow = { ...cur, [field]: val };
    const next = { ...specsObj, [cat]: nextRow };
    update('specs', normalizeSpecs(next));
    onCalculate?.();
  };

  const removeSpec = (cat: string) => {
    if (CORE_CATS.includes(cat) || cat === SHIPPING_KEY) return;
    const next = { ...specsObj };
    delete next[cat];
    update('specs', normalizeSpecs(next));
    setActiveDrop((cur) => (cur === cat ? null : cur));
    setCostDraft((d) => {
      const { [cat]: _, ...rest } = d;
      return rest;
    });
    onCalculate?.();
  };

  const selectInventoryItem = (cat: string, item: InventoryItem) => {
    const cur = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
    const next = {
      ...specsObj,
      [cat]: {
        ...cur,
        name: item.name,
        sku: item.sku || '',
        cost: Number(item.cost || 0),
      },
    };
    update('specs', normalizeSpecs(next));
    setActiveDrop(null);
    onCalculate?.();
  };

  const normalizeKey = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  const isMissingInInventory = (spec: SpecRow) => {
    const name = String(spec.name || '').trim();
    const sku = String(spec.sku || '').trim();
    if (!name && !sku) return false;

    const nameNorm = normalizeKey(name);
    const skuNorm = normalizeKey(sku);

    return !inventory.some((it) => {
      const invName = normalizeKey(String(it.name || ''));
      const invSku = normalizeKey(String(it.sku || ''));
      if (skuNorm && invSku && invSku === skuNorm) return true;
      if (nameNorm && invName && invName === nameNorm) return true;
      if (skuNorm && invName && invName.includes(skuNorm)) return true;
      return false;
    });
  };

  const copyLink = async () => {
    if (!pcppLink) return;
    try {
      await navigator.clipboard.writeText(pcppLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  const headerPlaceholder = pcppLink
    ? 'Re-paste to update link/specs'
    : 'Paste PCPartPicker list to auto-fill...';

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      onClick={() => setActiveDrop(null)}
    >
      <div className="md:hidden bg-slate-50 px-4 py-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
            <Cpu size={14} /> Specifications
          </h3>
          {pcppLink ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void copyLink();
              }}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100"
              title={copied ? 'Copied' : 'Copy link'}
            >
              {copied ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <Copy size={16} className="text-slate-500" />
              )}
            </button>
          ) : null}
        </div>

        {pcppLink ? (
          <a
            href={pcppLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            title={pcppLink}
          >
            <ExternalLink size={14} className="text-slate-400" />
            pcpartpicker
          </a>
        ) : null}

        <textarea
          className="w-full h-16 bg-white border border-slate-200 rounded-xl text-[11px] px-3 py-2 resize-none outline-none focus:border-blue-400 transition-all placeholder:text-slate-300"
          placeholder={headerPlaceholder}
          onChange={(e) => parsePCPP(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="hidden md:flex bg-slate-50 px-5 py-3 border-b border-slate-200 justify-between items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
            <Cpu size={14} /> Specifications
          </h3>

          {pcppLink ? (
            <div className="flex items-center gap-2 min-w-0">
              <a
                href={pcppLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                title={pcppLink}
              >
                <ExternalLink size={14} className="text-slate-400" />
                pcpartpicker
              </a>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void copyLink();
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100"
                title={copied ? 'Copied' : 'Copy link'}
              >
                {copied ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <Copy size={16} className="text-slate-500" />
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/* paste box (compact, far right) */}
        <textarea
          className="w-56 md:w-72 h-8 bg-white border border-slate-200 rounded text-[10px] px-2 py-1 resize-none outline-none focus:border-blue-400 transition-all placeholder:text-slate-300"
          placeholder={headerPlaceholder}
          onChange={(e) => parsePCPP(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="md:hidden p-4 space-y-4">
        {displayCats.map((cat) => {
          const spec: SpecRow = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
          const dropdownOpen = activeDrop === cat;
          const nameVal = String(spec.name || '');
          const isShippingRow = cat === SHIPPING_KEY;
          const canRemove = !CORE_CATS.includes(cat) && !isShippingRow;

          const suggestions =
            dropdownOpen && !isShippingRow
              ? inventory
                  .filter((i) =>
                    String(i.name || '').toLowerCase().includes(nameVal.toLowerCase()),
                  )
                  .slice(0, 5)
              : [];

          const rawCostNum = typeof spec.cost === 'number' ? spec.cost : Number(spec.cost || 0);
          const draft = costDraft[cat];
          const costStr =
            draft !== undefined ? draft : String(Number.isFinite(rawCostNum) ? rawCostNum : 0);

          const trackingUrl = isShippingRow ? upsUrlFromText(nameVal) : null;

          return (
            <div
              key={cat}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  {cat}
                  {Number(spec.qty || 1) > 1 ? (
                    <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">
                      x{spec.qty}
                    </span>
                  ) : null}
                  {isMissingInInventory(spec) ? (
                    <span
                      className="inline-flex w-1.5 h-1.5 rounded-full border-[0.5px] border-amber-400"
                      title="Needs purchase"
                      aria-label="Needs purchase"
                    />
                  ) : null}
                </div>

                {trackingUrl ? (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} />
                    Track
                  </a>
                ) : null}
              </div>

              <div className="mt-3 relative">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300"
                  placeholder={isShippingRow ? 'Tracking / URL (optional)' : 'Component Name...'}
                  value={nameVal}
                  onChange={(e) => updateSpec(cat, 'name', e.target.value)}
                  onFocus={() => setActiveDrop(isShippingRow ? null : cat)}
                  onClick={(e) => e.stopPropagation()}
                />

                {dropdownOpen && suggestions.length > 0 ? (
                  <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg border border-slate-100 z-50 mt-1 overflow-hidden">
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                        onMouseDown={() => selectInventoryItem(cat, s)}
                      >
                        <span className="font-bold text-slate-700 truncate">
                          {String(s.name || '')}
                        </span>
                        <span className="font-mono text-slate-400">
                          ${Number(s.cost || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Cost
                </div>
                <div className="mt-1 flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSpec(cat);
                      }}
                      className="mr-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 opacity-20 group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      title="Remove"
                      aria-label="Remove"
                    >
                      <X size={10} />
                    </button>
                  ) : null}
                  <span className="text-[11px] text-slate-400 mr-1">$</span>
                  <input
                    inputMode="decimal"
                    className="w-full text-right font-mono font-bold text-slate-600 bg-transparent outline-none text-sm"
                    value={costStr}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => {
                      setCostDraft((d) => ({ ...d, [cat]: String(costStr ?? '') }));
                      const target = e.currentTarget;
                      setTimeout(() => target?.select(), 0);
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!/^\d*\.?\d*$/.test(v)) return;
                      setCostDraft((d) => ({ ...d, [cat]: v }));
                    }}
                    onBlur={() => {
                      const v = costDraft[cat];
                      const n = v === undefined || v === '' ? 0 : Number(v);
                      updateSpec(cat, 'cost', Number.isFinite(n) ? n : 0);
                      setCostDraft((d) => {
                        const { [cat]: _, ...rest } = d;
                        return rest;
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block divide-y divide-slate-100">
        {displayCats.map((cat) => {
          const spec: SpecRow = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
          const dropdownOpen = activeDrop === cat;
          const nameVal = String(spec.name || '');
          const isShippingRow = cat === SHIPPING_KEY;
          const canRemove = !CORE_CATS.includes(cat) && !isShippingRow;

          const suggestions =
            dropdownOpen && !isShippingRow
              ? inventory
                  .filter((i) =>
                    String(i.name || '').toLowerCase().includes(nameVal.toLowerCase()),
                  )
                  .slice(0, 5)
              : [];

          const rawCostNum = typeof spec.cost === 'number' ? spec.cost : Number(spec.cost || 0);
          const draft = costDraft[cat];
          const costStr =
            draft !== undefined ? draft : String(Number.isFinite(rawCostNum) ? rawCostNum : 0);

          const trackingUrl = isShippingRow ? upsUrlFromText(nameVal) : null;

          return (
            <div
              key={cat}
              className="group grid grid-cols-12 gap-4 px-5 py-3 hover:bg-slate-50/50 items-center text-sm"
            >
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                {cat}
                {Number(spec.qty || 1) > 1 ? (
                  <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">
                    x{spec.qty}
                  </span>
                ) : null}
                {isMissingInInventory(spec) ? (
                  <span
                    className="inline-flex w-1 h-1 rounded-full border-[0.5px] border-amber-400"
                    title="Needs purchase"
                    aria-label="Needs purchase"
                  />
                ) : null}
              </div>

              <div className="col-span-7 relative">
                <input
                  className="w-full font-bold text-slate-700 outline-none bg-transparent placeholder:text-slate-200 pr-8"
                  placeholder={isShippingRow ? 'Tracking / URL (optional)' : 'Component Name...'}
                  value={nameVal}
                  onChange={(e) => updateSpec(cat, 'name', e.target.value)}
                  onFocus={() => setActiveDrop(isShippingRow ? null : cat)}
                  onClick={(e) => e.stopPropagation()}
                />

                {/* shipping tracking external link */}
                {trackingUrl ? (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-100"
                    title="Open tracking"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} className="text-slate-400" />
                  </a>
                ) : null}

                {dropdownOpen && suggestions.length > 0 ? (
                  <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg border border-slate-100 z-50 mt-1 overflow-hidden">
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                        onMouseDown={() => selectInventoryItem(cat, s)}
                      >
                        <span className="font-bold text-slate-700 truncate">
                          {String(s.name || '')}
                        </span>
                        <span className="font-mono text-slate-400">
                          ${Number(s.cost || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="col-span-3 flex justify-end items-center gap-2">
                {canRemove ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpec(cat);
                    }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 opacity-20 group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    title="Remove"
                    aria-label="Remove"
                  >
                    <X size={10} />
                  </button>
                ) : null}
                <div className="flex items-center bg-slate-50 rounded px-2 py-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 mr-1">$</span>
                  <input
                    inputMode="decimal"
                    className="w-20 text-right font-mono font-bold text-slate-600 bg-transparent outline-none text-xs"
                    value={costStr}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => {
                      setCostDraft((d) => ({ ...d, [cat]: String(costStr ?? '') }));
                      const target = e.currentTarget;
                      setTimeout(() => target?.select(), 0);
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!/^\d*\.?\d*$/.test(v)) return;
                      setCostDraft((d) => ({ ...d, [cat]: v }));
                    }}
                    onBlur={() => {
                      const v = costDraft[cat];
                      const n = v === undefined || v === '' ? 0 : Number(v);
                      updateSpec(cat, 'cost', Number.isFinite(n) ? n : 0);
                      setCostDraft((d) => {
                        const { [cat]: _, ...rest } = d;
                        return rest;
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
