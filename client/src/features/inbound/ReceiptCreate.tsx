import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryQuery } from '../../app/queries/inventory';
import { useInventoryWriteBehind } from '../../app/writeBehind/inventoryWriteBehind';
import { useReceiptWriteBehind } from '../../app/writeBehind/receiptWriteBehind';
import { useAlert } from '../../app/confirm/ConfirmProvider';
import {
  normalizeNeweggItem,
  normalizeSerialNumber,
  parseMicroCenterText,
  parseNeweggText,
  processScan,
  StagedItem,
} from '../../domain/inventory/inbound.logic';
import { ALL_CATS, guessCategory } from '../../domain/inventory/inventory.utils';
import { apiCallOrThrow } from '../../shared/api/http';
import { compressImage, generateId } from '../../utils';

const MODES = ['MANUAL', 'SCAN', 'SUMMARY'];

type Line = {
  id: string;
  inventoryId: string;
  name: string;
  category: string;
  sku: string;
  keyword: string;
  qty: string;
  unitCost: string;
  metadata?: Record<string, any>;
};

function makeId() {
  return `line_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ReceiptCreate() {
  const nav = useNavigate();
  const alert = useAlert();
  const { data: inventory = [] } = useInventoryQuery();
  const { update: updateInventory } = useInventoryWriteBehind();
  const { create } = useReceiptWriteBehind();

  const [receivedAt, setReceivedAt] = useState<string>('');
  const [vendor, setVendor] = useState('');
  const [mode, setMode] = useState('MANUAL');
  const [notes, setNotes] = useState('');
  const [inputText, setInputText] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const uploadRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([
    {
      id: makeId(),
      inventoryId: '',
      name: '',
      category: '',
      sku: '',
      keyword: '',
      qty: '1',
      unitCost: '0',
    },
  ]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: makeId(),
        inventoryId: '',
        name: '',
        category: '',
        sku: '',
        keyword: '',
        qty: '1',
        unitCost: '0',
      },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const appendImagesFromFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const encoded: string[] = [];
    for (const f of files) {
      if (!String(f.type || '').startsWith('image/')) continue;
      try {
        const url = await compressImage(f);
        if (url) encoded.push(url);
      } catch {
        // ignore
      }
    }
    if (encoded.length > 0) {
      setImages((prev) => [...prev, ...encoded]);
    }
  };

  const normalizeKey = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  const scoreMatch = (line: Line, it: typeof inventory[number]) => {
    const sku = normalizeKey(line.sku);
    const key = normalizeKey(line.keyword);
    const invKey = normalizeKey(String(it.keyword || ''));
    const name = normalizeKey(line.name);
    const invSku = normalizeKey(String(it.sku || ''));
    const invName = normalizeKey(String(it.name || ''));

    let score = 0;
    if (sku && invSku && sku === invSku) score += 200;
    if (sku && invSku && sku.includes(invSku)) score += 120;
    if (key && invKey && key === invKey) score += 90;
    if (key && invName && invName.includes(key)) score += 70;
    if (name && invName && invName.includes(name)) score += 60;
    if (name && invKey && name.includes(invKey)) score += 40;
    if (name && invName && invName === name) score += 140;
    return score;
  };

  const inventoryById = useMemo(
    () => new Map(inventory.map((it) => [it.id, it])),
    [inventory],
  );

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = Number(l.qty || 0);
      const cost = Number(l.unitCost || 0);
      return sum + qty * cost;
    }, 0);
  }, [lines]);

  const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  };

  const toIso = (val: string) => {
    if (!val) return undefined;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const itemsFromStaged = (staged: StagedItem[]) => {
    return staged.map((s) => ({
      id: makeId(),
      inventoryId: s.isMatch ? String(s.id || '') : '',
      name: String(s.name || ''),
      category: String(s.category || guessCategory(String(s.name || ''))),
      sku: String(s.sku || ''),
      keyword: String(s.keyword || ''),
      qty: String(s.qtyInput || 1),
      unitCost: String(Number(s.costInput || 0)),
      metadata: s.metadata && typeof s.metadata === 'object' ? { ...s.metadata } : undefined,
    }));
  };

  const mergeSerialValue = (existingRaw: any, incomingRaw: any) => {
    const incoming = normalizeSerialNumber(incomingRaw);
    if (!incoming) return { value: existingRaw, changed: false };
    const existing = typeof existingRaw === 'string' ? existingRaw : '';
    if (!existing) return { value: incoming, changed: true };
    const list = existing
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (list.includes(incoming)) return { value: existing, changed: false };
    return { value: [...list, incoming].join(', '), changed: true };
  };

  const syncLineMetadata = (sourceLines: Line[], createdMap: Map<string, string>) => {
    const updates = new Map<string, Record<string, any>>();

    for (const line of sourceLines) {
      const inventoryId = line.inventoryId || createdMap.get(line.id) || '';
      if (!inventoryId) continue;
      const inv = inventoryById.get(inventoryId);
      if (!inv) continue;
      const parsedItem = normalizeNeweggItem(line.metadata?.neweggItem);
      const existingItem = normalizeNeweggItem(inv.metadata?.neweggItem);
      const baseMeta =
        inv.metadata && typeof inv.metadata === 'object' && !Array.isArray(inv.metadata)
          ? inv.metadata
          : {};
      let nextMeta: Record<string, any> | null = null;

      if (parsedItem && !existingItem) {
        nextMeta = { ...(nextMeta || baseMeta), neweggItem: parsedItem };
      }

      const serialMerge = mergeSerialValue(baseMeta.sn, line.metadata?.sn);
      if (serialMerge.changed) {
        nextMeta = { ...(nextMeta || baseMeta), sn: serialMerge.value };
      }

      if (nextMeta) updates.set(inventoryId, nextMeta);
    }

    updates.forEach((metadata, inventoryId) => {
      updateInventory(inventoryId, { metadata });
    });
  };

  const parseInput = async () => {
    const text = inputText.trim();
    if (!text) return;

    const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    const looksLikeMicroCenter =
      /micro\s*center|your sale information|transaction date|reference number|price per|total price|sale total|clearance markdown|s\/n:/i.test(
        text,
      ) ||
      /micro center|your sale information|transaction date|reference number|price per|total price|sale total|clearance markdown|s n/.test(
        normalized,
      );
    const parsedMicroCenter = parseMicroCenterText(text, inventory);
    if (parsedMicroCenter.items.length > 0) {
      if (parsedMicroCenter.orderedAt) setReceivedAt(toLocalInput(parsedMicroCenter.orderedAt));
      setVendor((prev) => (prev.trim() ? prev : 'Micro Center'));
      setMode('SUMMARY');
      setLines(itemsFromStaged(parsedMicroCenter.items));
      return;
    }
    if (looksLikeMicroCenter) {
      await alert({ title: 'Parse Failed', message: parsedMicroCenter.msg });
      return;
    }

    if (/order\s+summary|order\s+date|item\s+#:/i.test(text)) {
      const parsed = parseNeweggText(text, inventory);
      if (parsed.orderedAt) setReceivedAt(toLocalInput(parsed.orderedAt));
      if (parsed.items.length === 0) {
        await alert({ title: 'Parse Failed', message: parsed.msg });
        return;
      }
      setVendor((prev) => (prev.trim() ? prev : 'Newegg'));
      setMode('SUMMARY');
      setLines(itemsFromStaged(parsed.items));
      return;
    }

    // treat as scan codes (one per line)
    const codes = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (codes.length === 0) return;
    setScanBusy(true);
    let batch: StagedItem[] = [];
    for (const code of codes) {
      const res = await processScan(code, batch, inventory);
      if (res.updatedBatch) batch = res.updatedBatch;
      else if (res.item) batch = [res.item, ...batch];
    }
    setScanBusy(false);
    if (batch.length === 0) {
      await alert({ title: 'Scan', message: 'No items recognized.' });
      return;
    }
    setMode('SCAN');
    setLines(itemsFromStaged(batch));
  };

  const submit = async () => {
    const meaningfulLines = lines.filter((l) =>
      [l.name, l.sku, l.keyword].some((v) => String(v || '').trim()),
    );

    if (meaningfulLines.length === 0) {
      await alert({ title: 'Missing Items', message: 'Please add at least one item.' });
      return;
    }

    const newLines = meaningfulLines.filter((l) => !l.inventoryId);
    const createdMap = new Map<string, string>();

    if (newLines.length > 0) {
      const operationId = `invbatch:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const createItems = newLines.map((l) => {
        const id = generateId();
        createdMap.set(l.id, id);
        const name = String(l.name || l.sku || l.keyword || 'New Item').trim();
        return {
          id,
          name,
          category: l.category || guessCategory(name),
          sku: l.sku || '',
          keyword: l.keyword || '',
          metadata: l.metadata && typeof l.metadata === 'object' ? l.metadata : undefined,
          qtyDelta: 0,
          unitCost: 0,
          status: 'In Stock',
        };
      });

      try {
        await apiCallOrThrow('/inventory/batch', 'POST', {
          operationId,
          items: createItems,
        });
        setLines((prev) =>
          prev.map((l) =>
            createdMap.has(l.id)
              ? { ...l, inventoryId: createdMap.get(l.id) || '' }
              : l,
          ),
        );
      } catch (err: any) {
        await alert({
          title: 'Inventory Create Failed',
          message: err?.userMessage || 'Failed to create new inventory items. Please try again.',
        });
        return;
      }
    }

    syncLineMetadata(meaningfulLines, createdMap);

    const merged = new Map<string, { qty: number; total: number }>();
    meaningfulLines.forEach((l) => {
      const inventoryId = l.inventoryId || createdMap.get(l.id) || '';
      if (!inventoryId) return;
      const qty = Number(l.qty || 0);
      const cost = Number(l.unitCost || 0);
      if (qty <= 0) return;
      const cur = merged.get(inventoryId) || { qty: 0, total: 0 };
      cur.qty += qty;
      cur.total += qty * cost;
      merged.set(inventoryId, cur);
    });

    const items = Array.from(merged.entries()).map(([inventoryId, v]) => ({
      inventoryId,
      qty: v.qty,
      unitCost: v.qty > 0 ? v.total / v.qty : 0,
    }));

    if (items.length === 0) {
      await alert({ title: 'Missing Items', message: 'Please add at least one item.' });
      return;
    }

    create({
      receivedAt: toIso(receivedAt),
      vendor: vendor || undefined,
      mode,
      notes: notes || undefined,
      images: images.length > 0 ? images : undefined,
      items,
    });

    nav('/inbound/receipts');
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto" onClick={() => setActiveSuggest(null)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => nav('/inbound/receipts')}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400"
          >
            Back
          </button>
          <h1 className="text-2xl font-black text-slate-900 mt-1">New Receipt</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</div>
          <div className="text-xl font-black text-slate-900">${total.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ordered At</div>
            <input
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor</div>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Newegg"
              className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode</div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scan / Order Summary Input</div>
          <div className="mt-2 flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste Newegg order summary or scan codes (one per line)"
              className="flex-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 h-24 resize-none"
            />
            <button
              onClick={parseInput}
              disabled={scanBusy}
              className="self-start inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition text-[11px] font-black uppercase tracking-wider"
            >
              {scanBusy ? 'Parsing...' : 'Parse'}
            </button>
          </div>
          <div className="mt-2 text-[10px] font-bold text-slate-400">
            Summary mode auto-fills Ordered At. Scan mode uses DB + UPC lookup.
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Receipt Photos
            </div>
            <button
              onClick={() => uploadRef.current?.click()}
              className="text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800"
            >
              Upload
            </button>
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              await appendImagesFromFiles(files);
              e.target.value = '';
            }}
          />

          <div
            className={[
              'mt-3 rounded-2xl border border-dashed px-4 py-4 transition',
              dragActive ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50',
            ].join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragActive(false);
              const files = Array.from(e.dataTransfer.files || []);
              await appendImagesFromFiles(files);
            }}
            onClick={() => uploadRef.current?.click()}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Drag & drop images here, or click to upload
            </div>

            {images.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={`${img.slice(0, 18)}-${idx}`}
                    className="relative group rounded-xl overflow-hidden border border-slate-100 bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewSrc(img);
                    }}
                  >
                    <img src={img} alt="" className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImages((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[10px] font-bold text-slate-400">
                Optional: add photos now or later in receipt detail.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-3">Item Name</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">SKU/UPC</div>
          <div className="col-span-2">Keyword</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-1">Unit Cost</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1" />
        </div>

        {lines.map((line) => {
          const qty = Number(line.qty || 0);
          const cost = Number(line.unitCost || 0);
          const lineTotal = qty * cost;
          const suggestions =
            activeSuggest === line.id
              ? inventory
                  .map((it) => ({ it, score: scoreMatch(line, it) }))
                  .filter((s) => s.score > 20)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 6)
              : [];
          return (
            <div
              key={line.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 md:py-3 border-b border-slate-100 items-center"
            >
              <div className="md:col-span-3 relative">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Item Name
                </div>
                <input
                  value={line.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateLine(line.id, {
                      name,
                      category: guessCategory(name),
                      inventoryId: '',
                      keyword: '',
                    });
                  }}
                  onFocus={() => setActiveSuggest(line.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Item name..."
                />
                {activeSuggest === line.id && suggestions.length > 0 ? (
                  <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg border border-slate-100 z-50 mt-1 overflow-hidden">
                    {suggestions.map(({ it }) => (
                      <div
                        key={it.id}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                        onMouseDown={() => {
                          updateLine(line.id, {
                            inventoryId: it.id,
                            name: it.name || '',
                            category: it.category || '',
                            sku: it.sku || '',
                            keyword: it.keyword || '',
                            metadata:
                              it.metadata && typeof it.metadata === 'object'
                                ? it.metadata
                                : undefined,
                          });
                          setActiveSuggest(null);
                        }}
                      >
                        <span className="font-bold text-slate-700 truncate">
                          {it.name || it.sku || it.id}
                        </span>
                        <span className="font-mono text-slate-400">
                          {it.category} {it.sku ? `• ${it.sku}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Category
                </div>
                <select
                  value={line.category}
                  onChange={(e) => updateLine(line.id, { category: e.target.value })}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="">Select</option>
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  SKU / UPC
                </div>
                <input
                  value={line.sku}
                  onChange={(e) => updateLine(line.id, { sku: e.target.value, inventoryId: '' })}
                  onFocus={() => setActiveSuggest(line.id)}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="SKU/UPC"
                />
              </div>
              <div className="md:col-span-2">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Keyword
                </div>
                <input
                  value={line.keyword}
                  onChange={(e) => updateLine(line.id, { keyword: e.target.value, inventoryId: '' })}
                  onFocus={() => setActiveSuggest(line.id)}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
                  placeholder="Keyword"
                />
              </div>
              <div className="md:col-span-1">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Qty
                </div>
                <input
                  value={line.qty}
                  onChange={(e) => updateLine(line.id, { qty: e.target.value })}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="md:col-span-1">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Unit Cost
                </div>
                <input
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.id, { unitCost: e.target.value })}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="md:col-span-1 text-right text-xs font-mono text-slate-600">
                <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-left">
                  Line Total
                </div>
                ${Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : '0.00'}
              </div>
              <div className="md:col-span-1 text-right">
                <button
                  onClick={() => removeLine(line.id)}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              {!line.inventoryId ? (
                <div className="md:col-span-12 text-[10px] font-black uppercase tracking-widest text-amber-600">
                  Unmatched - a new inventory item will be created
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="px-5 py-3 flex items-center justify-between">
          <button
            onClick={addLine}
            className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            + Add line
          </button>
          <button
            onClick={submit}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition text-[11px] font-black uppercase tracking-wider"
          >
            Submit Receipt
          </button>
        </div>
      </div>

      {previewSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-slate-900/70"
            onClick={() => setPreviewSrc(null)}
          />
          <div className="relative max-w-4xl w-full">
            <button
              type="button"
              onClick={() => setPreviewSrc(null)}
              className="absolute -top-10 right-0 text-white text-sm font-bold"
            >
              Close
            </button>
            <img
              src={previewSrc}
              alt="Receipt"
              className="w-full max-h-[80vh] object-contain rounded-2xl bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
