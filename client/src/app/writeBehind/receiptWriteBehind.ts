import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';
import { receiptsQueryKey } from '../queries/receipts';
import type { ReceiptDetail, ReceiptListItem } from '../../shared/api/types';

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
        await apiCallOrThrow<ReceiptDetail>('/inbound/receipts', 'POST', {
          ...patch,
          operationId: ctx.operationId,
        });
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
