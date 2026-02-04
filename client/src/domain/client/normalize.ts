import { asRecord, tryParseJsonObject } from '../../shared/api/response';
import { ClientEntity, ClientSpecs } from './client.types';

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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const normalized = cleaned.replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = toNumber(v);
    if (n !== null) return n;
  }
  return null;
}

export function normalizeClientRow(row: unknown): ClientEntity {
  const r = asRecord(row);
  const specs = coerceClientSpecs(tryParseJsonObject(r.specs));
  const createdAt =
    typeof r.createdAt === 'string'
      ? r.createdAt
      : typeof r.created_at === 'string'
        ? r.created_at
        : undefined;

  const paidAmount =
    firstNumber(r.paidAmount, r.amountPaid, r.paid, r.depositPaid, r.deposit) ?? 0;

  const totalPrice =
    firstNumber(
      r.totalPrice,
      r.total_price,
      r.orderTotal,
      r.total,
      r.order_total,
      r.price,
      r.orderAmount,
      r.order_amount,
    ) ?? 0;

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
    orderDate: String(r.orderDate ?? r.order_date ?? ''),
    deliveryDate: String(r.deliveryDate ?? r.delivery_date ?? ''),
    createdAt,
    isShipping: Boolean(r.isShipping),
    trackingNumber: String(r.trackingNumber ?? ''),
    address: String(r.address ?? ''),
    city: String(r.city ?? ''),
    state: String(r.state ?? ''),
    zip: String(r.zip ?? ''),

    totalPrice,
    paidAmount,

    specs,
    pcppLink: String(r.pcppLink ?? ''),
  };
}
