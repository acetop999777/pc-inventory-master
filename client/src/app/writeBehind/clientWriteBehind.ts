import { useQueryClient } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { ClientEntity } from '../../domain/client/client.types';
import { calculateFinancials } from '../../domain/client/client.logic';
import { clientsQueryKey } from '../queries/clients';
import { useSaveQueue } from '../saveQueue/SaveQueueProvider';

type ClientWrite = { op: 'patch'; fields: Partial<ClientEntity> } | { op: 'delete' };

function mergeClientWrite(a: ClientWrite, b: ClientWrite): ClientWrite {
  if (a.op === 'delete' || b.op === 'delete') return { op: 'delete' };
  return { op: 'patch', fields: { ...a.fields, ...b.fields } };
}

function coerceFields(fields: Partial<ClientEntity>): Partial<ClientEntity> {
  const f: any = { ...fields };
  const toMoney = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  if (Object.prototype.hasOwnProperty.call(f, 'totalPrice')) f.totalPrice = toMoney(f.totalPrice);
  if (Object.prototype.hasOwnProperty.call(f, 'paidAmount')) f.paidAmount = toMoney(f.paidAmount);
  if (Object.prototype.hasOwnProperty.call(f, 'rating')) f.rating = Number(f.rating ?? 0);
  if (Object.prototype.hasOwnProperty.call(f, 'isShipping')) f.isShipping = Boolean(f.isShipping);
  return f;
}

function upsert(list: ClientEntity[], next: ClientEntity): ClientEntity[] {
  const i = list.findIndex((c) => c.id === next.id);
  if (i === -1) return [next, ...list];
  const copy = list.slice();
  copy[i] = { ...copy[i], ...next };
  return copy;
}

export function useClientWriteBehind() {
  const qc = useQueryClient();
  const { queue } = useSaveQueue();

  const applyOptimistic = (id: string, fields: Partial<ClientEntity>, base?: ClientEntity) => {
    const nextFields = coerceFields(fields);
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => {
      const cur = old.find((c) => c.id === id) ?? base;
      if (!cur) return old;
      const merged: ClientEntity = { ...cur, ...nextFields };
      return upsert(old, merged);
    });
  };

  const removeOptimistic = (id: string) => {
    qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => old.filter((c) => c.id !== id));
  };

  const update = (id: string, fields: Partial<ClientEntity>, base?: ClientEntity) => {
    applyOptimistic(id, fields, base);

    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'patch', fields: coerceFields(fields) },
      merge: mergeClientWrite,
      write: async (w, ctx) => {
        if (w.op === 'delete') {
          await apiCallOrThrow(`/clients/${id}`, 'DELETE', { operationId: ctx.operationId });
          return;
        }

        const list = qc.getQueryData<ClientEntity[]>(clientsQueryKey) ?? [];
        const cur = list.find((c) => c.id === id) ?? base;
        if (!cur) throw new Error(`Client not found in cache; base required for id=${id}`);

        const merged: ClientEntity = { ...cur, ...w.fields };
        const fin = calculateFinancials(merged);

        await apiCallOrThrow('/clients', 'POST', {
          ...merged,
          actualCost: fin.totalCost,
          profit: merged.totalPrice > 0 ? fin.profit : null,
          operationId: ctx.operationId,
        });

        qc.setQueryData<ClientEntity[]>(clientsQueryKey, (old = []) => upsert(old, merged));
      },
      debounceMs: 700,
    });
  };

  const remove = (id: string) => {
    removeOptimistic(id);
    void queue.enqueue<ClientWrite>({
      key: `client:${id}`,
      label: 'Clients',
      patch: { op: 'delete' },
      merge: mergeClientWrite,
      write: async (_w, ctx) => {
        await apiCallOrThrow(`/clients/${id}`, 'DELETE', { operationId: ctx.operationId });
      },
      debounceMs: 0,
    });
  };

  return { update, remove };
}
