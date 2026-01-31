import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { InventoryItem } from '../../domain/inventory/inventory.types';
import { inventoryQueryKey, normalizeInventoryRow } from '../queries/inventory';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';

type InventoryWrite = { op: 'patch'; fields: Partial<InventoryItem> } | { op: 'delete' };

function mergeInventoryWrite(a: InventoryWrite, b: InventoryWrite): InventoryWrite {
  if (a.op === 'delete' || b.op === 'delete') return { op: 'delete' };
  return { op: 'patch', fields: { ...a.fields, ...b.fields } };
}

function coerceFields(fields: Partial<InventoryItem>): Partial<InventoryItem> {
  const f: any = { ...fields };
  if (Object.prototype.hasOwnProperty.call(f, 'cost')) f.cost = Number(f.cost ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'quantity')) f.quantity = Number(f.quantity ?? 0);
  return f;
}

export function useInventoryWriteBehind() {
  const qc = useQueryClient();
  const { queue } = useSaveQueue();

  const applyOptimistic = (id: string, fields: Partial<InventoryItem>) => {
    const nextFields = coerceFields(fields);
    qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) =>
      old.map((it) => (it.id === id ? { ...it, ...nextFields, lastUpdated: Date.now() } : it)),
    );
  };

  const removeOptimistic = (id: string) => {
    qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) =>
      old.filter((it) => it.id !== id),
    );
  };

  const update = (id: string, fields: Partial<InventoryItem>) => {
    applyOptimistic(id, fields);

    void queue.enqueue<InventoryWrite>({
      key: `inventory:${id}`,
      label: 'Inventory',
      patch: { op: 'patch', fields: coerceFields(fields) },
      merge: mergeInventoryWrite,
      write: async (w, ctx) => {
        if (w.op === 'delete') {
          await apiCallOrThrow(`/inventory/${id}`, 'DELETE', { operationId: ctx.operationId });
          return;
        }
        const updatedRow = await apiCallOrThrow<any>(`/inventory/${id}`, 'PUT', {
          ...w.fields,
          operationId: ctx.operationId,
        });
        const normalized = normalizeInventoryRow(updatedRow);

        qc.setQueryData<InventoryItem[]>(inventoryQueryKey, (old = []) =>
          old.map((it) => (it.id === id ? { ...it, ...normalized } : it)),
        );
      },
      debounceMs: 500,
    });
  };

  const remove = (id: string) => {
    removeOptimistic(id);
    void queue.enqueue<InventoryWrite>({
      key: `inventory:${id}`,
      label: 'Inventory',
      patch: { op: 'delete' },
      merge: mergeInventoryWrite,
      write: async (_w, ctx) => {
        await apiCallOrThrow(`/inventory/${id}`, 'DELETE', { operationId: ctx.operationId });
      },
      debounceMs: 0,
    });
  };

  return { update, remove };
}
