import { InventoryItem } from '../../../domain/inventory/inventory.types';

const NON_BRAND_TOKENS = new Set([
  'GEFORCE',
  'RADEON',
  'GRAPHICS',
  'GRAPHIC',
  'GPU',
  'RTX',
  'RX',
]);

const BRAND_ALIASES: Record<string, string> = {
  ASUS: 'ASUS',
  ASUSTEK: 'ASUS',
  MSI: 'MSI',
  GIGABYTE: 'GIGABYTE',
  GIGA: 'GIGABYTE',
  AMD: 'AMD',
  INTEL: 'INTEL',
  NVIDIA: 'NVIDIA',
  ZOTAC: 'ZOTAC',
  PNY: 'PNY',
  ASROCK: 'ASROCK',
  POWERCOLOR: 'POWERCOLOR',
  SAPPHIRE: 'SAPPHIRE',
  XFX: 'XFX',
  GALAX: 'GALAX',
  COLORFUL: 'COLORFUL',
  INNO3D: 'INNO3D',
};

const STRICT_MODEL_CATS = new Set(['MB', 'CPU', 'GPU']);

function normalizeToken(token: string): string {
  return String(token || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeCategoryKey(category?: string): string {
  if (!category) return '';
  const base = String(category).trim().split(/\s+/)[0] || '';
  return normalizeToken(base);
}

function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function extractBrand(name: string): string | null {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const first = raw.split(/\s+/)[0] || '';
  if (!first) return null;
  const normalized = normalizeToken(first);
  if (!normalized || NON_BRAND_TOKENS.has(normalized)) return null;
  return BRAND_ALIASES[normalized] || normalized;
}

function extractMotherboardModel(name: string): string | null {
  const upper = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, ' ')
    .trim();
  if (!upper) return null;
  const hyphen = upper.match(/\b([A-Z]{1,3}\d{3,4}[A-Z]?-[A-Z0-9]{1,3})\b/);
  if (hyphen) return hyphen[1];
  const base = upper.match(/\b([A-Z]{1,3}\d{3,4}[A-Z]?)\b/);
  return base ? base[1] : null;
}

function extractCpuModel(name: string): string | null {
  const upper = String(name || '').toUpperCase();
  const patterns = [
    /\b\d{4,5}X3D\b/,
    /\b\d{4,5}X\b/,
    /\b\d{4,5}[A-Z]{1,2}\b/,
    /\b\d{3,5}[A-Z]{1,2}\b/,
    /\b\d{3,5}\b/,
  ];
  for (const re of patterns) {
    const m = upper.match(re);
    if (m) return m[0];
  }
  return null;
}

function extractGpuModel(name: string): string | null {
  const upper = String(name || '').toUpperCase();
  const nvidia = upper.match(/\b(RTX|GTX)\s?(\d{3,4})(?:\s?(TI|SUPER))?\b/);
  if (nvidia) {
    const suffix = nvidia[3] ? ` ${nvidia[3]}` : '';
    return `${nvidia[1]} ${nvidia[2]}${suffix}`;
  }
  const amd = upper.match(/\b(RX)\s?(\d{3,4})(?:\s?(XTX|XT))?\b/);
  if (amd) {
    const suffix = amd[3] ? ` ${amd[3]}` : '';
    return `RX ${amd[2]}${suffix}`;
  }
  return null;
}

function extractModelSegment(name: string, category?: string): string | null {
  const baseCat = normalizeCategoryKey(category);
  if (baseCat === 'MB') return extractMotherboardModel(name);
  if (baseCat === 'CPU') return extractCpuModel(name);
  if (baseCat === 'GPU') return extractGpuModel(name);
  return null;
}

export function filterInventoryByCategoryStrict(
  inventory: InventoryItem[],
  category?: string,
): InventoryItem[] {
  const baseCat = normalizeCategoryKey(category);
  if (!baseCat) return [];
  return inventory.filter((item) => normalizeCategoryKey(item.category) === baseCat);
}

export function matchInventoryStrict(
  name: string,
  inventory: InventoryItem[],
  category?: string,
): InventoryItem | null {
  const baseCat = normalizeCategoryKey(category);
  const query = String(name || '').trim();
  if (!query || !baseCat) return null;

  const candidates = filterInventoryByCategoryStrict(inventory, baseCat);
  if (candidates.length === 0) return null;

  if (STRICT_MODEL_CATS.has(baseCat)) {
    const qBrand = extractBrand(query);
    const qModel = extractModelSegment(query, baseCat);
    if (!qBrand || !qModel) return null;

    for (const item of candidates) {
      const itemBrand = extractBrand(item.name || '');
      const itemModel = extractModelSegment(item.name || '', baseCat);
      if (!itemBrand || !itemModel) continue;
      if (itemBrand !== qBrand) continue;
      if (itemModel !== qModel) continue;
      return item;
    }
    return null;
  }

  const qNorm = normalizeText(query);
  if (!qNorm) return null;

  for (const item of candidates) {
    const nameNorm = normalizeText(item.name || '');
    if (nameNorm && nameNorm === qNorm) return item;

    const sku = String(item.sku || '').trim();
    const skuNorm = normalizeText(sku);
    if (skuNorm && qNorm.includes(skuNorm)) return item;
  }

  return null;
}

export function getInventorySuggestions(
  query: string,
  inventory: InventoryItem[],
  category?: string,
  limit = 5,
): InventoryItem[] {
  const baseCat = normalizeCategoryKey(category);
  const raw = String(query || '').trim();
  if (!raw || !baseCat) return [];

  const candidates = filterInventoryByCategoryStrict(inventory, baseCat);
  if (candidates.length === 0) return [];

  const qNorm = normalizeText(raw);
  const qTokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  const qBrand = extractBrand(raw);
  const qModel = extractModelSegment(raw, baseCat);

  const scored = candidates
    .map((item) => {
      const name = String(item.name || '');
      const nameNorm = normalizeText(name);
      const itemBrand = extractBrand(name);
      const itemModel = extractModelSegment(name, baseCat);

      if (qBrand && itemBrand && qBrand !== itemBrand) return null;
      if (STRICT_MODEL_CATS.has(baseCat) && qModel && itemModel && qModel !== itemModel) {
        return null;
      }

      let score = 0;
      if (nameNorm && nameNorm.includes(qNorm)) score += 60;

      if (qBrand && itemBrand && qBrand === itemBrand) score += 20;
      if (qModel && itemModel && qModel === itemModel) score += 40;

      for (const token of qTokens) {
        if (name.toLowerCase().includes(token)) score += 5;
      }

      return { item, score };
    })
    .filter((s): s is { item: InventoryItem; score: number } => Boolean(s && s.score > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);

  return scored;
}
