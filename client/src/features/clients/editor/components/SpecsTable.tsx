import React, { useMemo, useState } from 'react';
import { Cpu, ExternalLink, Copy, Check } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { InventoryItem } from '../../../../types';
import { CORE_CATS } from '../../../../utils';

interface Props {
  data: ClientEntity;
  inventory: InventoryItem[];
  update: (field: keyof ClientEntity, val: any) => void;
  onCalculate?: () => void;
}

type SpecRow = {
  name?: string;
  sku?: string;
  cost?: number | string;
  qty?: number;
};

const SHIPPING_KEY = 'SHIPPING';

function extractPCPPLink(text: string): string {
  const m = text.match(/https?:\/\/pcpartpicker\.com\/list\/\S+/i);
  return m ? m[0] : '';
}

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

function normTokens(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function findBestMatch(namePart: string, inventory: InventoryItem[]): InventoryItem | null {
  const q = String(namePart || '').trim();
  if (!q) return null;

  const qTokens = new Set(normTokens(q));
  const qLower = q.toLowerCase();

  let best: { item: InventoryItem; score: number } | null = null;

  for (const it of inventory) {
    const n = String((it as any).name || '');
    if (!n) continue;
    const nLower = n.toLowerCase();

    // fast path
    let score = 0;
    if (nLower === qLower) score += 100;
    if (nLower.includes(qLower) || qLower.includes(nLower)) score += 25;

    const tks = normTokens(n);
    for (const t of tks) if (qTokens.has(t)) score += 2;

    // small bonus if SKU matches tokens
    const sku = String((it as any).sku || '').toLowerCase();
    if (sku && qLower.includes(sku)) score += 6;

    if (!best || score > best.score) best = { item: it, score };
  }

  // require some minimal confidence to avoid garbage matches
  if (!best || best.score < 6) return null;
  return best.item;
}

export const SpecsTable: React.FC<Props> = ({ data, inventory, update, onCalculate }) => {
  const [activeDrop, setActiveDrop] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // cost drafts so decimal typing isn't destroyed by parseFloat on each keystroke
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});

  const rawSpecs = (data as any)?.specs;

  const specsObj: Record<string, SpecRow> = useMemo(() => {
    const s: any = rawSpecs;

    return s && typeof s === 'object' ? s : {};
  }, [rawSpecs]);
  const shipRequired = Boolean((data as any).isShipping);
  const pcppLink = String((data as any).pcppLink || '').trim();

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

    const initSpecs: Record<string, SpecRow> = {};
    for (const c of CORE_CATS) initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 };

    // merge existing specs so we don't wipe manual edits
    const newSpecs: Record<string, SpecRow> = { ...initSpecs, ...(specsObj || {}) };

    const map: Record<string, string> = {
      CPU: 'CPU',
      'CPU Cooler': 'COOLER',
      Motherboard: 'MB',
      Memory: 'RAM',
      Storage: 'SSD',
      'Video Card': 'GPU',
      Case: 'CASE',
      'Power Supply': 'PSU',
      'Case Fan': 'FAN',
      Monitor: 'MONITOR',
      'Operating System': 'OTHER',
    };

    const lines = text.split('\n');
    const link = extractPCPPLink(text);

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('Custom:')) continue;

      for (const [pcppLabel, internalCat] of Object.entries(map)) {
        if (!line.startsWith(pcppLabel + ':')) continue;

        const content = line.substring(pcppLabel.length + 1).trim();
        const namePart = content.split('($')[0].trim();

        const dbMatch = findBestMatch(namePart, inventory);
        const costToUse = dbMatch ? Number((dbMatch as any).cost || 0) : 0;

        let targetKey = internalCat;
        let counter = 2;

        while (newSpecs[targetKey] && newSpecs[targetKey].name) {
          if (newSpecs[targetKey].name === (dbMatch ? (dbMatch as any).name : namePart)) break;
          targetKey = `${internalCat} ${counter}`;
          counter++;
        }

        const existing = newSpecs[targetKey] || { name: '', sku: '', cost: 0, qty: 0 };

        if (existing.name) {
          newSpecs[targetKey] = {
            ...existing,
            cost: Number(existing.cost || 0) + costToUse,
            qty: (Number(existing.qty || 1) || 1) + 1,
          };
        } else {
          newSpecs[targetKey] = {
            name: dbMatch ? String((dbMatch as any).name || namePart) : namePart,
            sku: dbMatch ? String((dbMatch as any).sku || '') : '',
            cost: costToUse,
            qty: 1,
          };
        }

        break;
      }
    }

    update('specs' as keyof ClientEntity, newSpecs as any);
    if (link) update('pcppLink' as keyof ClientEntity, link);
    onCalculate?.();
  };

  const updateSpec = (cat: string, field: keyof SpecRow, val: any) => {
    const cur = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
    const next = { ...specsObj, [cat]: { ...cur, [field]: val } };
    update('specs' as keyof ClientEntity, next as any);
    onCalculate?.();
  };

  const selectInventoryItem = (cat: string, item: InventoryItem) => {
    const cur = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
    const next = {
      ...specsObj,
      [cat]: {
        ...cur,
        name: (item as any).name,
        sku: (item as any).sku || '',
        cost: Number((item as any).cost || 0),
      },
    };
    update('specs' as keyof ClientEntity, next as any);
    setActiveDrop(null);
    onCalculate?.();
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
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center gap-3">
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

      <div className="divide-y divide-slate-100">
        {displayCats.map((cat) => {
          const spec: SpecRow = specsObj[cat] || { name: '', sku: '', cost: 0, qty: 1 };
          const dropdownOpen = activeDrop === cat;
          const nameVal = String(spec.name || '');
          const isShippingRow = cat === SHIPPING_KEY;

          const suggestions =
            dropdownOpen && !isShippingRow
              ? inventory
                  .filter((i) =>
                    String((i as any).name || '')
                      .toLowerCase()
                      .includes(nameVal.toLowerCase()),
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
              className="grid grid-cols-12 gap-4 px-5 py-3 hover:bg-slate-50/50 items-center text-sm"
            >
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                {cat}
                {Number(spec.qty || 1) > 1 ? (
                  <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">
                    x{spec.qty}
                  </span>
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
                        key={(s as any).id}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                        onMouseDown={() => selectInventoryItem(cat, s)}
                      >
                        <span className="font-bold text-slate-700 truncate">
                          {String((s as any).name || '')}
                        </span>
                        <span className="font-mono text-slate-400">
                          ${Number((s as any).cost || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="col-span-3 flex justify-end items-center gap-2">
                <div className="flex items-center bg-slate-50 rounded px-2 py-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 mr-1">$</span>
                  <input
                    inputMode="decimal"
                    className="w-20 text-right font-mono font-bold text-slate-600 bg-transparent outline-none text-xs"
                    value={costStr}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => {
                      // ensure user can type decimals smoothly
                      setCostDraft((d) => ({ ...d, [cat]: String(costStr ?? '') }));
                      // auto-select all
                      setTimeout(() => e.currentTarget.select(), 0);
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      // allow "" or digits + optional decimal
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
