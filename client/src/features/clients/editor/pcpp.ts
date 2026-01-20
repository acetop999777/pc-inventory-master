import { InventoryItem } from '../../../types';
import { CORE_CATS } from '../../../utils';

export type SpecRow = { name: string; sku: string; cost: number; qty: number };
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

function matchInventoryForPcpp(namePart: string, inventory: InventoryItem[]): InventoryItem | null {
  const q = String(namePart || '').trim();
  if (!q) return null;

  const qNorm = normalizeStrict(q);
  const qTokens = tokenizePcpp(q);
  if (!qTokens.length) return null;
  const qSet = new Set(qTokens);

  let best: { item: InventoryItem; score: number } | null = null;

  for (const it of inventory) {
    const invName = String((it as any).name || '').trim();
    if (!invName) continue;

    const invNorm = normalizeStrict(invName);
    if (invNorm && invNorm === qNorm) return it;

    const sku = String((it as any).sku || '').trim();
    const skuNorm = normalizeStrict(sku);
    if (skuNorm && qNorm.includes(skuNorm)) return it;

    const tokens = tokenizePcpp(invName);
    if (!tokens.length) continue;

    const strongTokens = tokens.filter((t) => t.length >= 4 || /\d/.test(t));
    if (strongTokens.length < 2) continue;

    let ok = true;
    for (const t of strongTokens) {
      if (!qSet.has(t)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const score = strongTokens.length;
    if (!best || score > best.score) best = { item: it, score };
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
    initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 };
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
  };

  const lines = raw.split('\n');
  let link = '';

  for (const l of lines) {
    const line = l.trim();
    if (!line || line.startsWith('Custom:')) continue;

    if (line.includes('pcpartpicker.com/list/')) {
      link = line.match(/(https?:\/\/\S+)/)?.[0] || link;
    }

    for (const [pcppLabel, internalCat] of Object.entries(map)) {
      if (!line.startsWith(pcppLabel + ':')) continue;

      const content = line.substring(pcppLabel.length + 1).trim();
      const namePart = content.split('($')[0].trim();
      const dbMatch = matchInventoryForPcpp(namePart, inventory);

      const chosenName = dbMatch ? dbMatch.name : namePart;
      const chosenSku = dbMatch?.sku || '';
      const costToUse = dbMatch ? dbMatch.cost : 0;

      let targetKey = internalCat;
      let counter = 2;

      while (specs[targetKey] && specs[targetKey].name) {
        if (specs[targetKey].name === chosenName) break;
        targetKey = `${internalCat} ${counter}`;
        counter++;
      }

      if (!specs[targetKey]) specs[targetKey] = { name: '', sku: '', cost: 0, qty: 0 };

      if (specs[targetKey].name) {
        specs[targetKey].cost += costToUse;
        specs[targetKey].qty = (specs[targetKey].qty || 1) + 1;
      } else {
        specs[targetKey] = { name: chosenName, sku: chosenSku, cost: costToUse, qty: 1 };
      }

      break;
    }
  }

  return { specs, link };
}
