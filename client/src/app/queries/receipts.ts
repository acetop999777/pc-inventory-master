import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import type { ReceiptDetail, ReceiptListItem } from '../../shared/api/types';

export const receiptsQueryKey = ['receipts'] as const;

export function useReceiptsQuery(limit = 50) {
  return useQuery<ReceiptListItem[]>({
    queryKey: [...receiptsQueryKey, limit],
    queryFn: async () => {
      const raw = await apiCallOrThrow<unknown>(`/inbound/receipts?limit=${limit}`);
      return Array.isArray(raw) ? raw : [];
    },
  });
}

export function useReceiptDetailQuery(id: string) {
  return useQuery<ReceiptDetail>({
    queryKey: ['receipt', id],
    queryFn: async () => {
      return await apiCallOrThrow<ReceiptDetail>(`/inbound/receipts/${id}`);
    },
    enabled: Boolean(id),
  });
}
