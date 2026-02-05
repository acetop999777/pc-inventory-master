import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { decodeReceiptDetail } from '../../shared/api/decoders';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';
import { receiptsQueryKey } from '../queries/receipts';
import type { ReceiptListItem } from '../../shared/api/types';

export type ReceiptCreatePayload = {
  receivedAt?: string;
  vendor?: string;
  mode?: string;
  notes?: string;
  images?: string[];
  items: { inventoryId: string; qty: number; unitCost: number }[];
};

export function useReceiptWriteBehind() {
  const { queue } = useSaveQueue();
  const qc = useQueryClient();

  const create = (payload: ReceiptCreatePayload) => {
    void queue.enqueue<ReceiptCreatePayload>({
      key: `receipt:create:${Date.now()}`,
      label: 'Receipts',
      patch: payload,
      merge: (_prev, next) => next,
      write: async (patch, ctx) => {
        const url = '/inbound/receipts';
        const raw = await api.post<unknown>(url, {
          ...patch,
          operationId: ctx.operationId,
        });
        decodeReceiptDetail(url, raw, 'POST');
        qc.setQueryData<ReceiptListItem[]>(receiptsQueryKey, (old) =>
          Array.isArray(old) ? old : [],
        );
        qc.invalidateQueries({ queryKey: receiptsQueryKey });
      },
      debounceMs: 0,
    });
  };

  return { create };
}
