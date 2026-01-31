import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { InventoryItem } from '../../domain/inventory/inventory.types';

export const inventoryQueryKey = ['inventory'] as const;

export function normalizeInventoryRow(row: any): InventoryItem {
  const cost = Number(row?.cost ?? 0);
  const quantity = Number(row?.quantity ?? 0);

  return {
    id: String(row?.id ?? ''),
    sku: String(row?.sku ?? ''),
    name: String(row?.name ?? ''),
    category: String(row?.category ?? ''),
    cost: Number.isFinite(cost) ? cost : 0,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    lastUpdated: Number(row?.lastUpdated ?? row?.last_updated ?? row?.updated_at ?? Date.now()),
    keyword: row?.keyword ?? undefined,
    price: row?.price !== undefined ? Number(row.price) : undefined,
    location: row?.location ?? undefined,
    status: row?.status ?? undefined,
    notes: row?.notes ?? undefined,
    metadata:
      row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    photos: Array.isArray(row?.photos) ? row.photos : undefined,
  };
}

export function useInventoryQuery() {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>('/inventory');
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map(normalizeInventoryRow);
    },
  });
}
