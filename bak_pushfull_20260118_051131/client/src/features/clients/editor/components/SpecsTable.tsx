import React, { useCallback, useMemo, useState } from 'react';
import { Cpu, ExternalLink, Copy } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { InventoryItem } from '../../../../types';
import { CORE_CATS, findBestMatch } from '../../../../utils';

interface Props {
  data: ClientEntity;
  inventory: InventoryItem[];
  update: (field: keyof ClientEntity, val: any) => void;
}

type SpecRow = { name: string; sku: string; cost: number; qty: number };

const SHIPPING_KEY = 'Shipping';

function firstUrl(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

function upsTrackingUrl(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';

  // 如果用户直接填了 URL，优先当 URL
  const url = firstUrl(s);
  if (url) return url;

  // UPS 常见格式：1Z + 16 位字母数字
  const m = s.toUpperCase().match(/\b1Z[0-9A-Z]{16}\b/);
  if (m) {
    const t = m[0];
    return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(t)}`;
  }

  return '';
}

// 允许输入小数：不因为 parseFloat 立刻把 '.' 吃掉
function isLooseNumber(raw: string): boolean {
  return /^(\d+(\.\d*)?|\.\d+)?$/.test(raw); // '', '12', '12.', '12.3', '.3'
}

export const SpecsTable: React.FC<Props> = ({ data, inventory, update }) => {
  const [activeDrop, setActiveDrop] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});

  const getSpec = useCallback(
    (cat: string): SpecRow => {
      const specs: any = (data as any).specs || {};
      const s = specs[cat] || {};
      return {
        name: String(s.name ?? ''),
        sku: String(s.sku ?? ''),
        cost: Number.isFinite(Number(s.cost)) ? Number(s.cost) : 0,
        qty: Number.isFinite(Number(s.qty)) ? Number(s.qty) : 1,
      };
    },
    [data]
  );

  const setSpec = useCallback(
    (cat: string, patch: Partial<SpecRow>) => {
      const specs: any = (data as any).specs || {};
      const cur = getSpec(cat);
      const nextSpec: SpecRow = { ...cur, ...patch };
      const nextSpecs = { ...specs, [cat]: nextSpec };
      update('specs' as keyof ClientEntity, nextSpecs);
    },
    [data, getSpec, update]
  );

  const selectInventoryItem = useCallback(
    (cat: string, item: InventoryItem) => {
      setSpec(cat, { name: item.name, sku: item.sku || '', cost: Number(item.cost) || 0 });
      setActiveDrop(null);
    },
    [setSpec]
  );

  const parsePCPP = useCallback(
    (text: string) => {
      if (!text) return;

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

      // 先保留非核心类目 + Shipping
      const existing: any = (data as any).specs || {};
      const preserved: any = {};
      Object.entries(existing).forEach(([k, v]) => {
        const head = String(k).split(' ')[0];
        if (!CORE_CATS.includes(head) && k !== SHIPPING_KEY) preserved[k] = v;
      });
      if (existing[SHIPPING_KEY]) preserved[SHIPPING_KEY] = existing[SHIPPING_KEY];

      // 重置核心类目再填充（避免旧 PCPP 残留）
      const newSpecs: any = { ...preserved };
      CORE_CATS.forEach((c) => {
        newSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 };
      });

      const lines = text.split('\n');
      let link = '';

      for (const l of lines) {
        const line = l.trim();
        if (!line || line.startsWith('Custom:')) continue;

        if (line.includes('pcpartpicker.com/list/')) {
          const u = firstUrl(line);
          if (u) link = u;
        }

        for (const [pcppLabel, internalCat] of Object.entries(map)) {
          if (line.startsWith(pcppLabel + ':')) {
            const content = line.substring(pcppLabel.length + 1).trim();
            const namePart = content.split('($')[0].trim();

            const dbMatch = findBestMatch(namePart, inventory);
            const costToUse = dbMatch ? Number(dbMatch.cost) || 0 : 0;

            let targetKey = internalCat;
            let counter = 2;

            while (newSpecs[targetKey] && newSpecs[targetKey].name) {
              if (newSpecs[targetKey].name === (dbMatch ? dbMatch.name : namePart)) break;
              targetKey = `${internalCat} ${counter}`;
              counter++;
            }

            if (!newSpecs[targetKey]) newSpecs[targetKey] = { name: '', sku: '', cost: 0, qty: 0 };

            if (newSpecs[targetKey].name) {
              newSpecs[targetKey].cost += costToUse;
              newSpecs[targetKey].qty = (newSpecs[targetKey].qty || 1) + 1;
            } else {
              newSpecs[targetKey] = {
                name: dbMatch ? dbMatch.name : namePart,
                sku: dbMatch?.sku || '',
                cost: costToUse,
                qty: 1,
              };
            }
            break;
          }
        }
      }

      update('specs' as keyof ClientEntity, newSpecs);
      if (link) update('pcppLink' as keyof ClientEntity, link);
    },
    [data, inventory, update]
  );

  const showShipping = !!(data as any).isShipping;

  const displayCats = useMemo(() => {
    const specs: any = (data as any).specs || {};
    const keys = Object.keys(specs);
    const base = Array.from(new Set([...CORE_CATS, ...keys]));
    if (showShipping && !base.includes(SHIPPING_KEY)) base.push(SHIPPING_KEY);

    // 排序：按 CORE_CATS 顺序，其余字母序；Shipping 强制最后
    base.sort((a, b) => {
      if (a === SHIPPING_KEY) return 1;
      if (b === SHIPPING_KEY) return -1;
      const idxA = CORE_CATS.indexOf(String(a).split(' ')[0]);
      const idxB = CORE_CATS.indexOf(String(b).split(' ')[0]);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB || String(a).localeCompare(String(b));
    });

    // 非 shipping 的时候隐藏 shipping 行
    if (!showShipping) return base.filter((k) => k !== SHIPPING_KEY);
    return base;
  }, [data, showShipping]);

  const hasLink = !!(data as any).pcppLink;

  const onCopyLink = useCallback(async () => {
    const link = String((data as any).pcppLink || '').trim();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // ignore
    }
  }, [data]);

  const placeholder = hasLink ? 'Re-paste to update link/specs' : 'Paste PCPartPicker list...';

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      onClick={() => setActiveDrop(null)}
    >
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-3">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <Cpu size={14} />
          Specifications
        </h3>

        <div className="flex-1" />

        {hasLink && (
          <div className="flex items-center gap-1">
            <a
              href={(data as any).pcppLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100"
              title="Open PCPartPicker"
            >
              pcpartpicker <ExternalLink size={12} />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink();
              }}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100"
              title="Copy link"
              aria-label="Copy link"
            >
              <Copy size={14} />
            </button>
          </div>
        )}

        <textarea
          className="w-56 md:w-72 h-8 bg-white border border-slate-200 rounded text-[10px] px-2 py-1 resize-none outline-none focus:border-blue-400 transition-all placeholder:text-slate-300"
          placeholder={placeholder}
          onChange={(e) => parsePCPP(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="divide-y divide-slate-100">
        {displayCats.map((cat) => {
          const spec = getSpec(cat);
          const isShippingRow = cat === SHIPPING_KEY;

          const dropdownOpen = activeDrop === cat && !isShippingRow;
          const suggestions =
            dropdownOpen && spec.name
              ? inventory
                  .filter((i) => i.name.toLowerCase().includes(spec.name.toLowerCase()))
                  .slice(0, 5)
              : [];

          const trackingUrl = isShippingRow ? upsTrackingUrl(spec.name) : '';

          const costText = costDraft[cat] ?? String(spec.cost ?? 0);

          const setCostText = (raw: string) => {
            setCostDraft((prev) => ({ ...prev, [cat]: raw }));

            // 允许输入中间态：'12.' 或 '.'，不强行写回 number
            if (!isLooseNumber(raw)) return;

            if (raw === '' || raw === '.') {
              setSpec(cat, { cost: 0 });
              return;
            }

            // 末尾是 '.' 时不写回，避免吃掉点
            if (raw.endsWith('.')) return;

            const n = parseFloat(raw);
            if (!Number.isFinite(n)) return;
            setSpec(cat, { cost: n });
          };

          const commitCostText = () => {
            const raw = (costDraft[cat] ?? '').trim();
            if (raw === '' || raw === '.') {
              setSpec(cat, { cost: 0 });
              setCostDraft((prev) => ({ ...prev, [cat]: '0' }));
              return;
            }
            const n = parseFloat(raw);
            if (!Number.isFinite(n)) {
              // 回滚显示为当前 spec.cost
              setCostDraft((prev) => ({ ...prev, [cat]: String(spec.cost ?? 0) }));
              return;
            }
            setSpec(cat, { cost: n });
            setCostDraft((prev) => ({ ...prev, [cat]: String(n) }));
          };

          return (
            <div
              key={cat}
              className="grid grid-cols-12 gap-4 px-5 py-3 hover:bg-slate-50/50 items-center text-sm"
            >
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                {cat}
                {!isShippingRow && spec.qty > 1 && (
                  <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">x{spec.qty}</span>
                )}

                {isShippingRow && trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100 text-slate-500"
                    title="Open tracking"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div className="col-span-7 relative">
                <input
                  className="w-full font-bold text-slate-700 outline-none bg-transparent placeholder:text-slate-200"
                  placeholder={isShippingRow ? 'UPS tracking / notes...' : 'Component Name...'}
                  value={spec.name}
                  onChange={(e) => setSpec(cat, { name: e.target.value })}
                  onFocus={() => !isShippingRow && setActiveDrop(cat)}
                  onClick={(e) => e.stopPropagation()}
                />

                {dropdownOpen && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg border border-slate-100 z-50 mt-1 overflow-hidden">
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                        onMouseDown={() => selectInventoryItem(cat, s)}
                      >
                        <span className="font-bold text-slate-700 truncate">{s.name}</span>
                        <span className="font-mono text-slate-400">${s.cost}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-3 flex justify-end items-center gap-2">
                <div className="flex items-center bg-slate-50 rounded px-2 py-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 mr-1">$</span>
                  <input
                    className="w-16 text-right font-mono font-bold text-slate-600 bg-transparent outline-none text-xs"
                    inputMode="decimal"
                    value={costText}
                    onChange={(e) => setCostText(e.target.value)}
                    onFocus={(e) => {
                      e.stopPropagation();
                      (e.target as HTMLInputElement).select();
                    }}
                    onBlur={commitCostText}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0.00"
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
