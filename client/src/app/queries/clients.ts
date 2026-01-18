import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';

export const clientsQueryKey = ['clients'] as const;

function tryParseJsonObject(x: any): any {
  if (x == null) return {};
  if (typeof x === 'object') return x;
  if (typeof x === 'string') {
    try {
      const v = JSON.parse(x);
      return typeof v === 'object' && v != null ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeClientRow(row: any): ClientEntity {
  return {
    id: String(row?.id ?? ''),
    wechatName: String(row?.wechatName ?? ''),
    wechatId: String(row?.wechatId ?? ''),
    realName: String(row?.realName ?? ''),
    xhsName: String(row?.xhsName ?? ''),
    xhsId: String(row?.xhsId ?? ''),
    phone: String(row?.phone ?? ''),
    rating: Number(row?.rating ?? 0) || 0,
    notes: String(row?.notes ?? ''),
    photos: Array.isArray(row?.photos) ? row.photos : [],

    status: String(row?.status ?? 'Pending'),
    orderDate: String(row?.orderDate ?? ''),
    deliveryDate: String(row?.deliveryDate ?? ''),
    isShipping: Boolean(row?.isShipping),
    trackingNumber: String(row?.trackingNumber ?? ''),
    address: String(row?.address ?? ''),
    city: String(row?.city ?? ''),
    state: String(row?.state ?? ''),
    zip: String(row?.zip ?? ''),

    totalPrice: Number(row?.totalPrice ?? 0) || 0,
    paidAmount: Number(row?.paidAmount ?? 0) || 0,

    specs: tryParseJsonObject(row?.specs),
    pcppLink: String(row?.pcppLink ?? ''),
  };
}

export function useClientsQuery() {
  return useQuery<ClientEntity[]>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>('/clients');
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map(normalizeClientRow);
    },
  });
}
