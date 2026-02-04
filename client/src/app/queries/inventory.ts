import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { asArray, asRecord } from '../../shared/api/response';
import { InventoryItem } from '../../domain/inventory/inventory.types';

export const inventoryQueryKey = ['inventory'] as const;

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

export function useInventoryQuery() {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const raw = await api.get<unknown>('/inventory');
      return asArray(raw).map(normalizeInventoryRow);
    },
  });
}
