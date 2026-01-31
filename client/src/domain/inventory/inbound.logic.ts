import { InventoryItem } from './inventory.types';
import { generateId, findBestMatch, guessCategory, lookupBarcode } from '../../utils';

export interface StagedItem extends InventoryItem {
  qtyInput: number;
  costInput: number;
  isMatch?: boolean;
  isApi?: boolean;
  tempSubtotal?: number;
  isGift?: boolean;
}

type ParsedInbound = {
  items: StagedItem[];
  msg: string;
  type?: string;
  orderedAt?: string | null;
};

export const processScan = async (
  code: string,
  currentBatch: StagedItem[],
  inventory: InventoryItem[],
): Promise<{ updatedBatch?: StagedItem[]; item?: StagedItem; msg: string; type?: string }> => {
  // A. Check Staging
  const batchIdx = currentBatch.findIndex((i) => i.sku === code);
  if (batchIdx >= 0) {
    const newBatch = [...currentBatch];
    newBatch[batchIdx].qtyInput += 1;
    return { updatedBatch: newBatch, msg: 'Quantity updated in staging' };
  }

  // B. Check Inventory
  const match = inventory.find(
    (i) => (i.sku && i.sku === code) || (i.keyword && i.keyword === code),
  );
  if (match) {
    const newItem: StagedItem = {
      ...match,
      qtyInput: 1,
      costInput: match.cost,
      isMatch: true,
    };
    // 绝对没有任何反斜杠的模板字符串
    return { item: newItem, msg: 'Matched existing: ' + match.name };
  }

  const neweggMatch = findInventoryByNeweggItem(code, inventory);
  if (neweggMatch) {
    const newItem: StagedItem = {
      ...neweggMatch,
      qtyInput: 1,
      costInput: neweggMatch.cost,
      isMatch: true,
    };
    return { item: newItem, msg: 'Matched existing: ' + neweggMatch.name };
  }

  // C. Check API
  const apiData = await lookupBarcode(code);

  // D. Fuzzy Match
  let fuzzyMatch: InventoryItem | null = null;
  if (apiData) {
    fuzzyMatch = findBestMatch(apiData.name, inventory);
  }

  const newItem: StagedItem = {
    id: fuzzyMatch ? fuzzyMatch.id : generateId(),
    name: fuzzyMatch ? fuzzyMatch.name : apiData ? apiData.name : 'New Item (Manual Entry)',
    category: fuzzyMatch ? fuzzyMatch.category : apiData ? apiData.category : 'OTHER',
    sku: code,
    keyword: fuzzyMatch?.keyword || '',
    quantity: fuzzyMatch?.quantity || 0,
    cost: fuzzyMatch?.cost || 0,
    price: fuzzyMatch?.price || 0,
    location: fuzzyMatch?.location || '',
    status: fuzzyMatch?.status || 'In Stock',
    notes: fuzzyMatch?.notes || '',
    photos: fuzzyMatch?.photos || [],
    metadata: fuzzyMatch?.metadata || {},
    lastUpdated: Date.now(),

    qtyInput: 1,
    costInput: 0,
    isMatch: !!fuzzyMatch,
    isApi: !!apiData,
  };

  let msg = 'Not Found - Manual Entry';
  let type = 'error';
  if (fuzzyMatch) {
    msg = 'Matched existing: ' + fuzzyMatch.name;
    type = 'success';
  } else if (apiData) {
    msg = 'Found in Global DB (New Entry)';
    type = 'info';
  }

  return { item: newItem, msg, type };
};

const NEWEGG_ITEM_MIN_LEN = 8;

function sanitizeNeweggItem(value: any): string {
  const tokens = String(value || '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g);
  if (!tokens) return '';
  for (const token of tokens) {
    if (token.length < NEWEGG_ITEM_MIN_LEN) continue;
    if (!/\d/.test(token)) continue;
    return token;
  }
  return '';
}

export function normalizeNeweggItem(value: any): string {
  return sanitizeNeweggItem(value);
}

function extractNeweggItemNumber(line: string, nextLine?: string): string {
  const direct = sanitizeNeweggItem(String(line || '').replace(/^Item\s*#:\s*/i, ''));
  if (direct) return direct;
  return sanitizeNeweggItem(nextLine);
}

function findInventoryByNeweggItem(
  code: string,
  inventory: InventoryItem[],
): InventoryItem | null {
  const target = normalizeNeweggItem(code);
  if (!target) return null;
  return (
    inventory.find((it) => {
      const meta = it?.metadata;
      if (!meta || typeof meta !== 'object') return false;
      const entry = normalizeNeweggItem((meta as { neweggItem?: unknown }).neweggItem);
      return entry && entry === target;
    }) || null
  );
}

function mergeNeweggMetadata(
  base: Record<string, any> | undefined,
  itemNumber: string,
): Record<string, any> | undefined {
  const next =
    base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  const cleaned = sanitizeNeweggItem(itemNumber);
  if (cleaned) next.neweggItem = cleaned;
  return next;
}

export function normalizeSerialNumber(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^(?:s\/n|sn|serial(?:\s*number)?)[:#]?\s*/i, '').trim();
}

function mergeSerialMetadata(
  base: Record<string, any> | undefined,
  serial: string,
): Record<string, any> | undefined {
  const next =
    base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  const cleaned = normalizeSerialNumber(serial);
  if (!cleaned) return next;
  const existingRaw = typeof next.sn === 'string' ? next.sn : '';
  if (!existingRaw) {
    next.sn = cleaned;
    return next;
  }
  const list = existingRaw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (list.includes(cleaned)) return next;
  next.sn = [...list, cleaned].join(', ');
  return next;
}

function parseNeweggOrderDate(lines: string[]): string | null {
  const idx = lines.findIndex((l) => l.toLowerCase() === 'order date:');
  if (idx === -1 || idx + 1 >= lines.length) return null;
  const raw = lines[idx + 1];
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+at\s+(\d{1,2}):(\d{2})(AM|PM)$/i);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const mer = m[6].toUpperCase();
  if (mer === 'PM' && hour < 12) hour += 12;
  if (mer === 'AM' && hour === 12) hour = 0;
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseMoney(value: string): number | null {
  const m = value.match(/\$?\s*([\d,]+\.\d{2})/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

function collectTotalsByLabel(lines: string[], label: RegExp): number[] {
  const totals: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!label.test(line)) continue;
    const inline = parseMoney(line);
    if (inline != null) {
      totals.push(inline);
      continue;
    }
    const next = lines[i + 1];
    const nextVal = next ? parseMoney(next) : null;
    if (nextVal != null) totals.push(nextVal);
  }
  return totals;
}

function parseNeweggGrandTotal(lines: string[]): number {
  const labelPriority = [
    /^grand total\b/i,
    /^total for the shipment\(s\)\b/i,
    /^order total\b/i,
  ];
  for (const label of labelPriority) {
    const totals = collectTotalsByLabel(lines, label);
    if (totals.length > 0) return totals.reduce((sum, val) => sum + val, 0);
  }

  const subtotalTotals = collectTotalsByLabel(lines, /^subtotal\b/i);
  if (subtotalTotals.length > 0) {
    return subtotalTotals.reduce((sum, val) => sum + val, 0);
  }

  return 0;
}

function parseDateFromLines(lines: string[]): Date | null {
  for (const line of lines) {
    const m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const yyyy = Number(m[3]);
      const dt = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  for (const line of lines) {
    const t = Date.parse(line);
    if (Number.isFinite(t)) return new Date(t);
  }
  return null;
}

function normalizeReceiptLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[│|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingNonAlnum(line: string): string {
  return line.replace(/^[^A-Za-z0-9]+/, '').trim();
}

function looksLikeMicroCenterText(text: string): boolean {
  const normalized = normalizeReceiptLine(text).toLowerCase();
  if (
    /micro\s*center|your sale information|transaction date|reference number|price per|total price|sale total|clearance markdown|s\/n|serial number/.test(
      normalized,
    )
  ) {
    return true;
  }
  const compact = normalized.replace(/[^a-z0-9]+/g, ' ');
  return (
    compact.includes('micro center') ||
    compact.includes('your sale information') ||
    compact.includes('transaction date') ||
    compact.includes('reference number') ||
    compact.includes('price per') ||
    compact.includes('sale total') ||
    compact.includes('clearance markdown') ||
    compact.includes('s n')
  );
}

function parseMicroCenterReadyAt(lines: string[]): string | null {
  const line = lines.find((l) => /ready by/i.test(l));
  if (!line) return null;
  const m = line.match(/ready by\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && hour < 12) hour += 12;
  if (mer === 'AM' && hour === 12) hour = 0;

  const base = parseDateFromLines(lines) || new Date();
  base.setHours(hour, minute, 0, 0);
  return base.toISOString();
}

function parseMicroCenterTransactionDate(lines: string[]): string | null {
  const direct = lines.find((l) => /transaction date/i.test(l));
  if (direct) {
    const m = direct.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const yyyy = Number(m[3]);
      const dt = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    }
  }
  const parsed = parseDateFromLines(lines);
  return parsed ? parsed.toISOString() : null;
}

function parseMicroCenterSerialLine(line: string): { serial: string; qty?: number; subtotal?: number } | null {
  if (!/(^|\b)S\/N\b|(^|\b)SN\b/i.test(line)) return null;
  const snStart = line.match(/(?:S\/N|SN)\s*[:#]?\s*/i);
  if (!snStart) return null;
  const remainder = line.slice((snStart.index || 0) + snStart[0].length).trim();
  if (!remainder) return { serial: '' };

  const fullMatch = /(\d+)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/.exec(
    remainder,
  );
  if (fullMatch && fullMatch.index != null) {
    const serial = remainder.slice(0, fullMatch.index).trim();
    const qty = parseInt(fullMatch[1], 10);
    const subtotal = parseFloat(fullMatch[3].replace(/,/g, ''));
    return { serial, qty, subtotal };
  }

  const qtyTotalMatch = /(\d+)\s+\$?([\d,]+\.\d{2})\s*$/.exec(remainder);
  if (qtyTotalMatch && qtyTotalMatch.index != null) {
    const serial = remainder.slice(0, qtyTotalMatch.index).trim();
    const qty = parseInt(qtyTotalMatch[1], 10);
    const subtotal = parseFloat(qtyTotalMatch[2].replace(/,/g, ''));
    return { serial, qty, subtotal };
  }

  return { serial: remainder.trim() };
}

function parseMicroCenterQtyLine(line: string): { qty: number; subtotal: number } | null {
  const fullMatch = /^\s*(\d+)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/.exec(line);
  if (fullMatch) {
    return {
      qty: parseInt(fullMatch[1], 10),
      subtotal: parseFloat(fullMatch[3].replace(/,/g, '')),
    };
  }
  const qtyTotalMatch = /^\s*(\d+)\s+\$?([\d,]+\.\d{2})\s*$/.exec(line);
  if (qtyTotalMatch) {
    return {
      qty: parseInt(qtyTotalMatch[1], 10),
      subtotal: parseFloat(qtyTotalMatch[2].replace(/,/g, '')),
    };
  }
  return null;
}

function parseMicroCenterSkuTable(
  lines: string[],
  inventory: InventoryItem[],
): StagedItem[] {
  const items: StagedItem[] = [];
  const isBlockedLine = (line: string) =>
    /^(?:subtotal|tax|sale total|total|clearance markdown|reference number)/i.test(line) ||
    /^sku\s+description\b/i.test(line);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = stripLeadingNonAlnum(rawLine);
    if (!/^\d{5,}\b/.test(line)) continue;
    if (isBlockedLine(line)) continue;

    let qty = 1;
    let subtotal = 0;
    let serial = '';
    let foundCost = false;
    let foundSerial = false;

    let name = '';
    const skuMatch = line.match(/^(\d{5,})\b/);
    const rest = skuMatch ? line.slice(skuMatch[1].length).trim() : line;
    if (rest) {
      const full = /(.+?)\s+(\d+)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/.exec(
        rest,
      );
      if (full) {
        name = full[1].trim();
        qty = parseInt(full[2], 10);
        subtotal = parseFloat(full[4].replace(/,/g, ''));
        foundCost = true;
      } else {
        const qtyTotal = /(.+?)\s+(\d+)\s+\$?([\d,]+\.\d{2})\s*$/.exec(rest);
        if (qtyTotal) {
          name = qtyTotal[1].trim();
          qty = parseInt(qtyTotal[2], 10);
          subtotal = parseFloat(qtyTotal[3].replace(/,/g, ''));
          foundCost = true;
        } else {
          name = rest.trim();
        }
      }
    } else {
      const nextLine = lines[i + 1];
      if (nextLine && !isBlockedLine(nextLine) && !/^s\/n\b|^sn\b/i.test(nextLine)) {
        name = nextLine.trim();
      }
    }
    if (!name) continue;

    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const nextRaw = lines[j];
      const next = stripLeadingNonAlnum(nextRaw);
      if (!next) continue;
      if (/^\d{5,}\b/.test(next)) break;
      if (isBlockedLine(next)) break;

      const snInfo = parseMicroCenterSerialLine(next);
      if (snInfo) {
        if (!foundSerial && snInfo.serial) {
          serial = snInfo.serial;
          foundSerial = true;
        }
        if (!foundCost && snInfo.qty != null && snInfo.subtotal != null) {
          qty = snInfo.qty;
          subtotal = snInfo.subtotal;
          foundCost = true;
        }
        continue;
      }

      if (!foundCost) {
        const qtyLine = parseMicroCenterQtyLine(next);
        if (qtyLine) {
          qty = qtyLine.qty;
          subtotal = qtyLine.subtotal;
          foundCost = true;
          continue;
        }

        if (/^\d+$/.test(next)) {
          const priceMatch = lines[j + 1]?.match(/\$?([\d,]+\.\d{2})/);
          if (priceMatch) {
            qty = parseInt(next, 10);
            subtotal = parseFloat(priceMatch[1].replace(/,/g, ''));
            foundCost = true;
          }
        }
      }
    }

    const dbMatch = findBestMatch(name, inventory);
    const autoCat = dbMatch?.category || guessCategory(name);
    const unitCost = qty > 0 && subtotal > 0 ? subtotal / qty : 0;

    items.push({
      id: dbMatch?.id || generateId(),
      name: dbMatch?.name || name,
      category: autoCat,
      sku: dbMatch?.sku || '',
      keyword: dbMatch?.keyword || '',
      quantity: dbMatch?.quantity || 0,
      cost: dbMatch?.cost || 0,
      price: dbMatch?.price || 0,
      location: dbMatch?.location || '',
      status: dbMatch?.status || 'In Stock',
      notes: dbMatch?.notes || '',
      photos: dbMatch?.photos || [],
      metadata: mergeSerialMetadata(dbMatch?.metadata, serial),
      lastUpdated: Date.now(),

      qtyInput: qty,
      costInput: parseFloat(unitCost.toFixed(2)),
      isMatch: !!dbMatch,
      isApi: false,
    });
  }

  return items;
}

function parseMicroCenterSkuLabel(
  lines: string[],
  inventory: InventoryItem[],
): StagedItem[] {
  const items: StagedItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = stripLeadingNonAlnum(lines[i]);
    if (!/^SKU:/i.test(line)) continue;

    let name = 'Unknown Item';
    let k = i - 1;
    while (k >= 0) {
      const prev = lines[k];
      if (
        /pickup items|pickup order items|item\s+qty\s+subtotal|ready by/i.test(prev)
      ) {
        k--;
        continue;
      }
      name = prev;
      break;
    }

    let qty = 1;
    let subtotal = 0;
    let serial = '';
    let foundCost = false;
    let foundSerial = false;
    for (let j = 1; j < 8; j++) {
      const l = lines[i + j];
      if (!l) continue;
      const snInfo = parseMicroCenterSerialLine(l);
      if (snInfo) {
        if (!foundSerial && snInfo.serial) {
          serial = snInfo.serial;
          foundSerial = true;
        }
        if (!foundCost && snInfo.qty != null && snInfo.subtotal != null) {
          qty = snInfo.qty;
          subtotal = snInfo.subtotal;
          foundCost = true;
          continue;
        }
      }
      if (!foundCost) {
        const pairMatch = l.match(/^\s*(\d+)\s+\$?([\d,]+\.\d{2})/);
        if (pairMatch) {
          qty = parseInt(pairMatch[1], 10);
          subtotal = parseFloat(pairMatch[2].replace(/,/g, ''));
          foundCost = true;
          break;
        }
        if (/^\d+$/.test(l)) {
          const next = lines[i + j + 1];
          const priceMatch = next?.match(/\$?([\d,]+\.\d{2})/);
          if (priceMatch) {
            qty = parseInt(l, 10);
            subtotal = parseFloat(priceMatch[1].replace(/,/g, ''));
            foundCost = true;
            break;
          }
        }
      }
    }

    const dbMatch = findBestMatch(name, inventory);
    const autoCat = dbMatch?.category || guessCategory(name);
    const unitCost = qty > 0 && subtotal > 0 ? subtotal / qty : 0;

    items.push({
      id: dbMatch?.id || generateId(),
      name: dbMatch?.name || name,
      category: autoCat,
      sku: dbMatch?.sku || '',
      keyword: dbMatch?.keyword || '',
      quantity: dbMatch?.quantity || 0,
      cost: dbMatch?.cost || 0,
      price: dbMatch?.price || 0,
      location: dbMatch?.location || '',
      status: dbMatch?.status || 'In Stock',
      notes: dbMatch?.notes || '',
      photos: dbMatch?.photos || [],
      metadata: mergeSerialMetadata(dbMatch?.metadata, serial),
      lastUpdated: Date.now(),

      qtyInput: qty,
      costInput: parseFloat(unitCost.toFixed(2)),
      isMatch: !!dbMatch,
      isApi: false,
    });
  }

  return items;
}

export const parseNeweggText = (text: string, inventory: InventoryItem[]): ParsedInbound => {
  try {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const grandTotal = parseNeweggGrandTotal(lines);
    const items: StagedItem[] = [];
    const orderedAt = parseNeweggOrderDate(lines);

    for (let i = 0; i < lines.length; i++) {
      if (/^Item\s*#:/i.test(lines[i])) {
        // Name extraction
        let name = 'Unknown Item';
        let k = i - 1;
        while (k >= 0) {
          const line = lines[k];
          if (
            line.includes('Return Policy') ||
            line.startsWith('COMBO') ||
            line.includes('Free Gift') ||
            line.includes('Warranty')
          ) {
            k--;
            continue;
          }
          name = line;
          break;
        }

        const itemNumber = extractNeweggItemNumber(lines[i], lines[i + 1]);

        // Qty & Price extraction
        let qty = 1;
        let subtotal = 0;
        for (let j = 1; j < 8; j++) {
          const l = lines[i + j];
          if (!l) continue;
          if (l.includes('ea.)')) {
            const priceMatch = lines[i + j - 1].match(/\$?([\d,]+\.\d{2})/);
            if (priceMatch) subtotal = parseFloat(priceMatch[1].replace(/,/g, ''));
            const qtyLine = lines[i + j - 2];
            if (qtyLine && /^\d+$/.test(qtyLine)) qty = parseInt(qtyLine);
            break;
          }
          if (l.startsWith('$') && !l.includes('ea.')) {
            const possiblePrice = parseFloat(l.replace(/[$,]/g, ''));
            const prevLine = lines[i + j - 1];
            if (/^\d+$/.test(prevLine)) {
              qty = parseInt(prevLine);
              subtotal = possiblePrice;
              break;
            }
          }
        }

        const dbMatch = itemNumber
          ? findInventoryByNeweggItem(itemNumber, inventory)
          : findBestMatch(name, inventory);
        const autoCat = dbMatch?.category || guessCategory(name);
        const isGift = lines.slice(Math.max(0, i - 6), i).some((l) => l.includes('Free Gift Item'));

        items.push({
          id: dbMatch?.id || generateId(),
          name: dbMatch?.name || name,
          category: autoCat,
          sku: dbMatch?.sku || '',
          keyword: dbMatch?.keyword || '',
          quantity: dbMatch?.quantity || 0,
          cost: dbMatch?.cost || 0,
          price: dbMatch?.price || 0,
          location: dbMatch?.location || '',
          status: dbMatch?.status || 'In Stock',
          notes: dbMatch?.notes || '',
          photos: dbMatch?.photos || [],
          metadata: mergeNeweggMetadata(dbMatch?.metadata, itemNumber),
          lastUpdated: Date.now(),

          qtyInput: qty,
          tempSubtotal: subtotal,
          isGift: isGift,
          isMatch: !!dbMatch,
          costInput: 0,
          isApi: false,
        });
      }
    }

    const validItems = items.filter((i) => !i.isGift);
    const sumSubtotals = validItems.reduce((a, b) => a + (b.tempSubtotal || 0), 0);

    const finalBatch = items.map((item) => {
      let finalCost = 0;
      if (!item.isGift && sumSubtotals > 0 && grandTotal > 0) {
        const weight = (item.tempSubtotal || 0) / sumSubtotals;
        finalCost = (weight * grandTotal) / item.qtyInput;
      }
      return { ...item, costInput: parseFloat(finalCost.toFixed(2)) };
    });

    if (finalBatch.length === 0)
      return { items: [], msg: 'No items found', type: 'error', orderedAt };

    return { items: finalBatch, msg: 'Parsed ' + finalBatch.length + ' items', orderedAt };
  } catch (e) {
    console.error(e);
    return { items: [], msg: 'Parse Error', type: 'error', orderedAt: null };
  }
};

export const parseMicroCenterText = (text: string, inventory: InventoryItem[]): ParsedInbound => {
  try {
    const lines = text
      .split('\n')
      .map((l) => normalizeReceiptLine(l))
      .filter((l) => l.length > 0);

    const looksLikeMicroCenter =
      looksLikeMicroCenterText(lines.join(' ')) ||
      lines.some((l) => /micro\s*center/i.test(l)) ||
      lines.some((l) =>
        /(your sale information|transaction date|reference number|price per|total price|sale total|clearance markdown|s\/n:)/i.test(
          l,
        ),
      );
    if (!looksLikeMicroCenter) {
      return { items: [], msg: 'No items found', type: 'error', orderedAt: null };
    }

    const orderedAt = parseMicroCenterTransactionDate(lines) || parseMicroCenterReadyAt(lines);
    let startIdx = lines.findIndex((l) => /your sale information/i.test(l));
    if (startIdx < 0) startIdx = 0;
    const headerIdx = lines.findIndex(
      (l, idx) =>
        idx >= startIdx &&
        /^sku\b.*\bdescription\b/i.test(l),
    );
    const parseStart = headerIdx >= 0 ? headerIdx + 1 : startIdx;
    let endIdx = lines.findIndex(
      (l, idx) =>
        idx > parseStart
        && /^(subtotal|tax|sale total|total)\b/i.test(l),
    );
    if (endIdx < 0) endIdx = lines.length;
    const section = lines.slice(parseStart, endIdx);

    let items = parseMicroCenterSkuTable(section, inventory);
    if (items.length === 0) items = parseMicroCenterSkuLabel(lines, inventory);

    if (items.length === 0) {
      return { items: [], msg: 'No items found', type: 'error', orderedAt };
    }

    return { items, msg: 'Parsed ' + items.length + ' items', orderedAt };
  } catch (e) {
    console.error(e);
    return { items: [], msg: 'Parse Error', type: 'error', orderedAt: null };
  }
};
