import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';
import { calculateFinancials } from '../../domain/client/client.logic';
import { clientsQueryKey } from '../queries/clients';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';

type ClientWrite =
  | { op: 'upsert'; fields: Partial<ClientEntity>; base?: ClientEntity }
  | { op: 'delete' };

function mergeClientWrite(a: ClientWrite, b: ClientWrite): ClientWrite {
  if (a.op === 'delete' || b.op === 'delete') return { op: 'delete' };
  return {
    op: 'upsert',
    fields: { ...a.fields, ...b.fields },
    base: b.base ?? a.base,
  };
}

function coerce(fields: Partial<ClientEntity>): Partial<ClientEntity> {
  const f: any = { ...fields };
  if (Object.prototype.hasOwnProperty.call(f, 'totalPrice')) f.totalPrice = Number(f.totalPrice ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'paidAmount')) f.paidAmount = Number(f.paidAmount ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'rating')) f.rating = Number(f.rating ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'isShipping')) f.isShipping = Boolean(f.isShipping);
  return f;
}

function upsertInList(old: ClientEntity[], id: string, next: ClientEntity): ClientEntity[] {
  const has = old.some((c) => c.id === id);
  if (!has) return [next, ...old];
  return old.map((c) => (c.id === id ? { ...c, ...next } : c));
}

export function useClientWriteBehind() {
  const qc = useQueryClient();
  const { queue } = useSaveQueue();

  const applyOptimisticIfExists = (id: string, fields: Partial<ClientEntity>) => {
    const nextFields = coerce(fields);
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => {
      if (!old.some((c) => c.id === id)) return old;
      return old.map((c) => (c.id === id ? { ...c, ...nextFields } : c));
    });
  };

  const removeOptimisticIfExists = (id: string) => {
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => old.filter((c) => c.id !== id));
  };

  const update = (id: string, fields: Partial<ClientEntity>, base?: ClientEntity) => {
    applyOptimisticIfExists(id, fields);

    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'upsert', fields: coerce(fields), base },
      merge: mergeClientWrite,
      write: async (w) => {
        if (w.op === 'delete') {
          await apiCallOrThrow(`/clients/${id}`, 'DELETE');
          return;
        }

        const list = qc.getQueryData<ClientEntity[]>(clientsQueryKey) ?? [];
        const current = list.find((c) => c.id === id) ?? w.base;
        if (!current) throw new Error(`Client not found in cache; base required for id=${id}`);

        const merged: ClientEntity = { ...current, ...w.fields };
        const fin = calculateFinancials(merged);

        await apiCallOrThrow('/clients', 'POST', {
          ...merged,
          actualCost: fin.totalCost,
          profit: fin.profit,
        });

        qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => upsertInList(old, id, merged));
      },
      debounceMs: 700,
    });
  };

  const remove = (id: string) => {
    removeOptimisticIfExists(id);
    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'delete' },
      merge: mergeClientWrite,
      write: async () => {
        await apiCallOrThrow(`/clients/${id}`, 'DELETE');
      },
      debounceMs: 0,
    });
  };

  return { update, remove };
}
