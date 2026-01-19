import { InventoryItem } from '../../../types';
import { CORE_CATS, findBestMatch } from '../../../utils';

export type SpecRow = { name: string; sku: string; cost: number; qty: number };
export type ParsedPcpp = { specs: Record<string, SpecRow>; link: string };

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
      const dbMatch = findBestMatch(namePart, inventory);

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
