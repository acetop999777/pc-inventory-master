import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { InventoryItem } from '../../types';

export const inventoryQueryKey = ['inventory'] as const;

export function useInventoryQuery() {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>('/inventory');
      return Array.isArray(raw) ? raw : [];
    },
  });
}
