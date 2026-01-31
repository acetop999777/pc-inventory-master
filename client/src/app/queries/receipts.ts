import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';

export type ReceiptListItem = {
  id: number;
  receivedAt: string;
  vendor: string | null;
  mode: string;
  notes: string | null;
  createdAt: string;
  operationId: string;
  totalAmount: number;
};

export type ReceiptItem = {
  id: number;
  receiptId: number;
  inventoryId: string;
  qtyReceived: number;
  unitCost: string;
  lineTotal: string;
  displayName: string;
  sku: string;
};

export type ReceiptDetail = {
  receipt: {
    id: number;
    receivedAt: string;
    vendor: string | null;
    mode: string;
    notes: string | null;
    operationId: string;
    images?: string[];
  };
  items: ReceiptItem[];
  inventoryUpdates: { inventoryId: string; onHandQty: number; avgCost: string }[];
};

export const receiptsQueryKey = ['receipts'] as const;

export function useReceiptsQuery(limit = 50) {
  return useQuery<ReceiptListItem[]>({
    queryKey: [...receiptsQueryKey, limit],
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>(`/inbound/receipts?limit=${limit}`);
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
