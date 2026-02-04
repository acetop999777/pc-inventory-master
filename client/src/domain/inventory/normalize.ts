import type { InventoryItem } from './inventory.types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
};

export function normalizeInventoryRow(row: unknown): InventoryItem {
  const r = asRecord(row);
  const cost = Number(r.cost ?? 0);
  const quantity = Number(r.quantity ?? 0);

  return {
    id: String(r.id ?? ''),
    sku: String(r.sku ?? ''),
    name: String(r.name ?? ''),
    category: String(r.category ?? ''),
    cost: Number.isFinite(cost) ? cost : 0,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    lastUpdated: Number(r.lastUpdated ?? r.last_updated ?? r.updated_at ?? Date.now()),
    keyword: typeof r.keyword === 'string' ? r.keyword : undefined,
    price: r.price !== undefined ? Number(r.price) : undefined,
    location: typeof r.location === 'string' ? r.location : undefined,
    status: typeof r.status === 'string' ? r.status : undefined,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    metadata:
      r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {},
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : undefined,
  };
}
