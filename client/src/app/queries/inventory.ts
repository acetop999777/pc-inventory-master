import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { InventoryItem } from '../../domain/inventory/inventory.types';
import { decodeInventory } from '../../shared/api/decoders';

export const inventoryQueryKey = ['inventory'] as const;

export function useInventoryQuery() {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const raw = await api.get<unknown>('/inventory');
      return decodeInventory('/inventory', raw);
    },
  });
}
