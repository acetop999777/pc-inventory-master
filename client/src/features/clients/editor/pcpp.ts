import { InventoryItem } from '../../../types';
import { CORE_CATS } from '../../../utils';

export type SpecRow = { name: string; sku: string; cost: number; qty: number; needsPurchase?: boolean };
export type ParsedPcpp = { specs: Record<string, SpecRow>; link: string };

function normalizeStrict(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function tokenizePcpp(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const IMPORTANT_TOKENS = new Set(['ti', 'super', 'xt', 'pro', 'evo', 'plus', 'max', 'ultra']);

function filterInventoryByCategory(
  inventory: InventoryItem[],
  category?: string,
): InventoryItem[] {
  if (!category) return inventory;
  const catNorm = normalizeStrict(category);
  if (!catNorm) return inventory;

  const filtered = inventory.filter((it) => {
    const rawCat = String(it.category || '').trim();
    if (!rawCat) return false;
    const norm = normalizeStrict(rawCat);
    if (!norm) return false;
    if (norm === catNorm) return true;
    return norm.includes(catNorm) || catNorm.includes(norm);
  });

  return filtered.length ? filtered : inventory;
}

function matchInventoryForPcpp(
  namePart: string,
  inventory: InventoryItem[],
  category?: string,
): InventoryItem | null {
  const q = String(namePart || '').trim();
  if (!q) return null;

  const qNorm = normalizeStrict(q);
  const qTokens = tokenizePcpp(q);
  if (!qTokens.length) return null;
  const qSet = new Set(qTokens);
  const qStrongTokens = qTokens.filter((t) => t.length >= 3 || /\d/.test(t));

  let best:
    | { item: InventoryItem; score: number; matchCount: number; coverage: number }
    | null = null;

  const candidates = filterInventoryByCategory(inventory, category);

  for (const it of candidates) {
    const invName = String(it.name || '').trim();
    if (!invName) continue;

    const invNorm = normalizeStrict(invName);
    if (invNorm && invNorm === qNorm) return it;

    const tokens = tokenizePcpp(invName);
    if (!tokens.length) continue;
    const invSet = new Set(tokens);

    const qImportant = qTokens.filter((t) => IMPORTANT_TOKENS.has(t));
    if (qImportant.some((t) => !invSet.has(t))) continue;
    const invImportant = tokens.filter((t) => IMPORTANT_TOKENS.has(t));
    if (invImportant.some((t) => !qSet.has(t))) continue;

    const invDigitTokens = tokens
      .filter((t) => /\d/.test(t))
      .map((t) => normalizeStrict(t))
      .filter((t) => t.length >= 2);
    if (invDigitTokens.length > 0) {
      let ok = true;
      for (const dt of invDigitTokens) {
        if (!qNorm.includes(dt)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }

    const matchCount = tokens.filter((t) => qSet.has(t)).length;
    const minMatchCount = Math.min(3, tokens.length);
    if (matchCount < minMatchCount) continue;

    const tokenCount = tokens.length;
    const coverage = tokenCount ? matchCount / tokenCount : 0;
    if (coverage < 0.7) continue;

    const sku = String(it.sku || '').trim();
    const skuNorm = normalizeStrict(sku);
    const skuStrong = skuNorm.length >= 5 && /[a-z]/.test(skuNorm) && /\d/.test(skuNorm);
    const qStrongMatchCount = qStrongTokens.filter((t) => invSet.has(t)).length;
    const qStrongCoverage = qStrongTokens.length ? qStrongMatchCount / qStrongTokens.length : 0;

    const score =
      coverage * 100 +
      qStrongCoverage * 100 +
      matchCount +
      (skuStrong && qNorm.includes(skuNorm) ? 60 : 0);
    if (
      !best ||
      score > best.score ||
      (score === best.score && matchCount > best.matchCount) ||
      (score === best.score && matchCount === best.matchCount && coverage > best.coverage)
    ) {
      best = { item: it, score, matchCount, coverage };
    }
  }

  return best ? best.item : null;
}

/**
 * Parse PCPartPicker "Part List" text.
 * - Returns null when text empty/unparseable
 * - Specs keys follow internal categories like CPU / GPU / "GPU 2" etc
 */
export function parsePcppText(text: string, inventory: InventoryItem[]): ParsedPcpp | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const initSpecs: Record<string, SpecRow> = {};
  CORE_CATS.forEach((c) => {
    initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1, needsPurchase: false };
  });

  const specs: Record<string, SpecRow> = { ...initSpecs };

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
    Custom: 'CUSTOM',
  };

  const lines = raw.split('\n');
  let link = '';
  let customIndex = 1;

  for (const l of lines) {
    const line = l.trim();
    if (!line) continue;

    if (line.includes('pcpartpicker.com/list/')) {
      link = line.match(/(https?:\/\/\S+)/)?.[0] || link;
    }

    for (const [pcppLabel, internalCat] of Object.entries(map)) {
      if (!line.startsWith(pcppLabel + ':')) continue;

      const content = line.substring(pcppLabel.length + 1).trim();
      let namePart = content.split('($')[0].trim();
      if (!namePart && internalCat === 'CUSTOM') {
        namePart = customIndex === 1 ? 'Custom Item' : `Custom Item ${customIndex}`;
        customIndex += 1;
      }
      const dbMatch = matchInventoryForPcpp(namePart, inventory, internalCat);

      const chosenName = dbMatch ? dbMatch.name : namePart;
      const chosenSku = dbMatch?.sku || '';
      const costToUse = dbMatch ? dbMatch.cost : 0;
      const needsPurchase = !dbMatch && Boolean(chosenName);

      let targetKey = internalCat;
      let counter = 2;

      while (specs[targetKey] && specs[targetKey].name) {
        if (specs[targetKey].name === chosenName) break;
        targetKey = `${internalCat} ${counter}`;
        counter++;
      }

      if (!specs[targetKey]) specs[targetKey] = { name: '', sku: '', cost: 0, qty: 0, needsPurchase: false };

      if (specs[targetKey].name) {
        specs[targetKey].cost += costToUse;
        specs[targetKey].qty = (specs[targetKey].qty || 1) + 1;
        if (needsPurchase) specs[targetKey].needsPurchase = true;
      } else {
        specs[targetKey] = {
          name: chosenName,
          sku: chosenSku,
          cost: costToUse,
          qty: 1,
          needsPurchase,
        };
      }

      break;
    }
  }

  return { specs, link };
}
