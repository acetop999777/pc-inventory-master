import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { asArray, asRecord, tryParseJsonObject } from '../../shared/api/response';
import { ClientEntity, ClientSpecs } from '../../domain/client/client.types';

export const clientsQueryKey = ['clients'] as const;

function coerceClientSpecs(raw: Record<string, unknown>): ClientSpecs {
  const out: ClientSpecs = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const row = value as Record<string, unknown>;
    out[key] = {
      name: String(row.name ?? ''),
      sku: String(row.sku ?? ''),
      cost: Number(row.cost ?? 0) || 0,
      qty: Number(row.qty ?? 0) || 0,
      needsPurchase: row.needsPurchase === undefined ? undefined : Boolean(row.needsPurchase),
    };
  });
  return out;
}

export function normalizeClientRow(row: unknown): ClientEntity {
  const r = asRecord(row);
  const specs = coerceClientSpecs(tryParseJsonObject(r.specs));
  return {
    id: String(r.id ?? ''),
    wechatName: String(r.wechatName ?? ''),
    wechatId: String(r.wechatId ?? ''),
    realName: String(r.realName ?? ''),
    xhsName: String(r.xhsName ?? ''),
    xhsId: String(r.xhsId ?? ''),
    phone: String(r.phone ?? ''),
    rating: Number(r.rating ?? 0) || 0,
    notes: String(r.notes ?? ''),
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],

    status: String(r.status ?? 'Pending'),
    orderDate: String(r.orderDate ?? ''),
    deliveryDate: String(r.deliveryDate ?? ''),
    isShipping: Boolean(r.isShipping),
    trackingNumber: String(r.trackingNumber ?? ''),
    address: String(r.address ?? ''),
    city: String(r.city ?? ''),
    state: String(r.state ?? ''),
    zip: String(r.zip ?? ''),

    totalPrice: Number(r.totalPrice ?? 0) || 0,
    paidAmount: Number(r.paidAmount ?? 0) || 0,

    specs,
    pcppLink: String(r.pcppLink ?? ''),
  };
}

export function useClientsQuery() {
  return useQuery<ClientEntity[]>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<unknown>('/clients');
      return asArray(raw).map(normalizeClientRow);
    },
  });
}
