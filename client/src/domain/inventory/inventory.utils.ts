import { apiCall } from '../../utils';
import { InventoryItem } from './inventory.types';

export const CORE_CATS = ['CPU', 'COOLER', 'MB', 'RAM', 'SSD', 'GPU', 'CASE', 'PSU'];
export const ALL_CATS = [...CORE_CATS, 'FAN', 'MONITOR', 'CUSTOM', 'OTHER'];

export const guessCategory = (name: string): string => {
  if (!name) return 'OTHER';
  const n = name.toLowerCase();

  if (n.includes('cpu') || n.includes('ryzen') || n.includes('intel') || n.includes('processor'))
    return 'CPU';
  if (
    n.includes('motherboard') ||
    n.includes('b860') ||
    n.includes('b850') ||
    n.includes('b760') ||
    n.includes('b650') ||
    n.includes('x870e') ||
    n.includes('x870') ||
    n.includes('x670') ||
    n.includes('z890') ||
    n.includes('z790')
  )
    return 'MB';
  if (n.includes('memory') || n.includes('ram') || n.includes('ddr5')) return 'RAM';
  if (
    n.includes('video card') ||
    n.includes('geforce') ||
    n.includes('rtx') ||
    n.includes('graphics card')
  )
    return 'GPU';
  if (n.includes('ssd') || n.includes('nvme') || n.includes('m.2')) return 'SSD';
  if (n.includes('cooler') || n.includes('liquid') || n.includes('aio') || n.includes('heatsink'))
    return 'COOLER';
  if (n.includes('supply') || n.includes('psu') || n.includes('modular')) return 'PSU';
  if (n.includes('case') || n.includes('tower') || n.includes('chassis') || n.includes('o11'))
    return 'CASE';
  if (n.includes('fan') || n.includes('uni fan')) return 'FAN';
  if (n.includes('monitor') || n.includes('display')) return 'MONITOR';

  return 'OTHER';
};

/**
 * Barcode lookup (legacy modules depend on it).
 * Expects server endpoint: GET /api/lookup/:code
 * Returns {name, category} or null.
 */
export async function lookupBarcode(
  code: string,
): Promise<{ name: string; category: string } | null> {
  const data: any = await apiCall(`/lookup/${encodeURIComponent(code)}`);
  if (data && Array.isArray(data.items) && data.items.length > 0) {
    const item = data.items[0];
    const title = String(item.title ?? '').trim();
    const cat = item.category ? String(item.category) : '';
    return {
      name: title,
      category: guessCategory(cat ? `${cat} ${title}` : title),
    };
  }
  return null;
}

function normalizeForMatch(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BRAND_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  { id: 'asus', patterns: [/\basus\b/, /\brog\b/, /\btuf\b/] },
  { id: 'msi', patterns: [/\bmsi\b/] },
  { id: 'gigabyte', patterns: [/\bgigabyte\b/, /\baorus\b/] },
  { id: 'asrock', patterns: [/\basrock\b/] },
  { id: 'corsair', patterns: [/\bcorsair\b/] },
  { id: 'gskill', patterns: [/\bg\.?skill\b/] },
  { id: 'teamgroup', patterns: [/\bteam\s*group\b/, /\bteamgroup\b/] },
  { id: 'kingston', patterns: [/\bkingston\b/] },
  { id: 'crucial', patterns: [/\bcrucial\b/] },
  { id: 'samsung', patterns: [/\bsamsung\b/] },
  { id: 'wd', patterns: [/\bwd\b/, /\bwd_black\b/, /\bwdblack\b/, /\bwestern\s+digital\b/] },
  { id: 'seagate', patterns: [/\bseagate\b/] },
  { id: 'sama', patterns: [/\bsama\b/] },
  { id: 'superflower', patterns: [/\bsuper\s*flower\b/] },
  { id: 'coolermaster', patterns: [/\bcooler\s*master\b/, /\bcoolermaster\b/] },
  { id: 'lianli', patterns: [/\blian\s*li\b/] },
  { id: 'nzxt', patterns: [/\bnzxt\b/] },
  { id: 'thermaltake', patterns: [/\bthermaltake\b/] },
];

const CHIPSET_TOKENS = [
  'x870e',
  'x870',
  'x670',
  'x570',
  'b860',
  'b850',
  'b760',
  'b650',
  'b550',
  'z890',
  'z790',
  'z690',
];

const SERIES_TOKENS = [
  'tuf',
  'strix',
  'crosshair',
  'apex',
  'prime',
  'proart',
  'aorus',
  'taichi',
  'phantom',
  'tomahawk',
  'mag',
  'mpg',
  'suprim',
  'ventus',
];

const MODEL_SUFFIXES = new Set([
  'a',
  'e',
  'f',
  'h',
  'i',
  'm',
  'plus',
  'pro',
  'max',
  'ultra',
  'wifi',
  'wifi7',
]);

const STOP_TOKENS = new Set([
  'gaming',
  'wifi',
  'plus',
  'pro',
  'max',
  'ultra',
  'series',
  'desktop',
  'motherboard',
  'memory',
  'ram',
  'ssd',
  'solid',
  'state',
  'drive',
  'internal',
  'pc',
  'amd',
  'intel',
  'ddr5',
  'ddr4',
  'pcie',
  'express',
  'atx',
  'matx',
  'itx',
  'black',
  'white',
]);

function extractBrandToken(text: string): string | null {
  const raw = String(text || '').toLowerCase();
  if (!raw) return null;
  for (const entry of BRAND_PATTERNS) {
    if (entry.patterns.some((p) => p.test(raw))) return entry.id;
  }
  return null;
}

function extractChipsetToken(text: string): string | null {
  const raw = String(text || '').toLowerCase();
  if (!raw) return null;
  for (const chip of CHIPSET_TOKENS) {
    if (raw.includes(chip)) return chip.toUpperCase();
  }
  return null;
}

function extractSeriesTokens(text: string): Set<string> {
  const raw = String(text || '').toLowerCase();
  const hits = new Set<string>();
  if (!raw) return hits;
  for (const token of SERIES_TOKENS) {
    if (raw.includes(token)) hits.add(token);
  }
  return hits;
}

function extractChipsetModelKeys(text: string): Set<string> {
  const raw = String(text || '').toLowerCase();
  const tokens = raw.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const keys = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    for (const base of CHIPSET_TOKENS) {
      if (token.startsWith(base)) {
        const suffix = token.slice(base.length);
        if (!suffix) {
          keys.add(base);
          continue;
        }
        if (MODEL_SUFFIXES.has(suffix)) {
          keys.add(base + suffix);
          continue;
        }
        keys.add(base);
      }

      if (token === base) {
        const next = tokens[i + 1];
        if (next && MODEL_SUFFIXES.has(next)) {
          keys.add(base + next);
        }
      }
    }
  }
  return keys;
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  let overlap = false;
  a.forEach((val) => {
    if (b.has(val)) overlap = true;
  });
  return overlap;
}

/**
 * Very lightweight fuzzy match used by inbound logic.
 * - Prefer keyword match (if inventory item.keyword is contained in target)
 * - Then substring name match
 * - Then token hits
 */
export function findBestMatch(
  targetName: string,
  inventory: InventoryItem[],
): InventoryItem | null {
  if (!targetName) return null;

  const cleanTarget = normalizeForMatch(targetName);
  if (!cleanTarget) return null;

  const targetBrand = extractBrandToken(targetName);
  const targetChipset = extractChipsetToken(targetName);
  const targetCategory = guessCategory(targetName);
  const targetSeries = extractSeriesTokens(targetName);
  const targetModelKeys = extractChipsetModelKeys(targetName);

  let best: InventoryItem | null = null;
  let bestScore = 0;

  const tokens = targetName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));

  for (const item of inventory) {
    const cleanName = normalizeForMatch(item.name);
    const cleanKey = normalizeForMatch(item.keyword || '');
    const itemBrand = extractBrandToken(`${item.name || ''} ${item.keyword || ''}`);
    const itemChipset = extractChipsetToken(`${item.name || ''} ${item.keyword || ''}`);
    const itemSeries = extractSeriesTokens(`${item.name || ''} ${item.keyword || ''}`);
    const itemModelKeys = extractChipsetModelKeys(`${item.name || ''} ${item.keyword || ''}`);

    let score = 0;

    if (targetBrand && itemBrand && targetBrand !== itemBrand) continue;
    if (targetChipset && itemChipset && targetChipset !== itemChipset) continue;

    if (targetCategory === 'MB') {
      if (targetSeries.size > 0 && itemSeries.size > 0) {
        const overlap = hasOverlap(targetSeries, itemSeries);
        if (!overlap) continue;
      }

      if (targetModelKeys.size > 0 && itemModelKeys.size > 0) {
        const overlap = hasOverlap(targetModelKeys, itemModelKeys);
        if (!overlap) continue;
      }

      if (targetSeries.size > 0 && itemSeries.size === 0) score -= 40;
      if (targetModelKeys.size > 0 && itemModelKeys.size === 0) score -= 30;
    }

    if (targetCategory !== 'OTHER' && item.category && item.category !== targetCategory) {
      score -= 60;
    }
    if (targetBrand && !itemBrand) score -= 15;
    if (targetChipset && !itemChipset) score -= 15;

    // Keyword is a strong signal
    if (cleanKey && cleanTarget.includes(cleanKey)) score += 100;

    // Exact / near-exact name containment
    if (cleanName && cleanTarget.includes(cleanName) && cleanName.length > 5) score += 80;

    // Token hits
    for (const t of tokens) {
      if (t.length <= 3) continue;
      const isModelToken = /\d/.test(t);
      if (item.name.toLowerCase().includes(t)) score += isModelToken ? 12 : 5;
      if ((item.keyword || '').toLowerCase().includes(t)) score += isModelToken ? 15 : 8;
    }

    // Small bonus: if target contains SKU-like text
    const skuValue = (item as { sku?: unknown }).sku;
    const sku = skuValue != null ? String(skuValue) : '';
    if (sku) {
      const cleanSku = normalizeForMatch(sku);
      if (cleanSku && cleanTarget.includes(cleanSku)) score += 60;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 45 ? best : null;
}
