import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import type { ReceiptDetail, ReceiptListItem } from '../../shared/api/types';
import { decodeReceiptDetail, decodeReceipts } from '../../shared/api/decoders';

export const receiptsQueryKey = ['receipts'] as const;

export function useReceiptsQuery(limit = 50) {
  return useQuery<ReceiptListItem[]>({
    queryKey: [...receiptsQueryKey, limit],
    queryFn: async () => {
      const url = `/inbound/receipts?limit=${limit}`;
      const raw = await api.get<unknown>(url);
      return decodeReceipts(url, raw);
    },
  });
}

export function useReceiptDetailQuery(id: string) {
  return useQuery<ReceiptDetail>({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const url = `/inbound/receipts/${id}`;
      const raw = await api.get<unknown>(url);
      return decodeReceiptDetail(url, raw);
    },
    enabled: Boolean(id),
  });
}
