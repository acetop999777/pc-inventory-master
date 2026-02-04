import { ApiCallError } from './http';
import { normalizeClientRow } from '../../domain/client';
import type { ClientEntity } from '../../domain/client';
import type { InventoryItem } from '../../domain/inventory/inventory.types';
import { normalizeInventoryRow } from '../../domain/inventory/normalize';
import type { InventoryUpdate, ReceiptDetail, ReceiptItem, ReceiptListItem } from './types';

type DecodeContext = {
  url: string;
  expected: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function decodeError(ctx: DecodeContext, body: unknown): never {
  throw new ApiCallError({
    message: `Invalid response for ${ctx.expected}`,
    url: ctx.url,
    method: 'GET',
    kind: 'PARSE',
    status: 200,
    responseBody: body,
    code: 'INVALID_RESPONSE',
    requestId: undefined,
    details: { expected: ctx.expected },
    retryable: false,
    retriable: false,
    userMessage: 'Invalid response from server.',
  });
}

function ensureArray(value: unknown, ctx: DecodeContext): unknown[] {
  if (!Array.isArray(value)) decodeError(ctx, value);
  return value;
}

function ensureRecord(value: unknown, ctx: DecodeContext): Record<string, unknown> {
  if (!isRecord(value)) decodeError(ctx, value);
  return value;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

function normalizeReceiptListItem(row: unknown, url: string): ReceiptListItem {
  const r = ensureRecord(row, { url, expected: 'ReceiptListItem' });
  return {
    id: toNumber(r.id),
    receivedAt: toString(r.receivedAt ?? r.received_at ?? ''),
    vendor: toNullableString(r.vendor),
    mode: toString(r.mode ?? ''),
    notes: toNullableString(r.notes),
    createdAt: toString(r.createdAt ?? r.created_at ?? ''),
    operationId: toString(r.operationId ?? r.operation_id ?? ''),
    totalAmount: toNumber(r.totalAmount ?? r.total_amount ?? 0),
  };
}

function normalizeReceiptItem(row: unknown, url: string): ReceiptItem {
  const r = ensureRecord(row, { url, expected: 'ReceiptItem' });
  return {
    id: toNumber(r.id),
    receiptId: toNumber(r.receiptId ?? r.receipt_id ?? 0),
    inventoryId: toString(r.inventoryId ?? r.inventory_id ?? ''),
    qtyReceived: toNumber(r.qtyReceived ?? r.qty_received ?? 0),
    unitCost: toString(r.unitCost ?? r.unit_cost ?? ''),
    lineTotal: toString(r.lineTotal ?? r.line_total ?? ''),
    displayName: toString(r.displayName ?? r.display_name ?? ''),
    sku: toString(r.sku ?? ''),
  };
}

function normalizeInventoryUpdate(row: unknown, url: string): InventoryUpdate {
  const r = ensureRecord(row, { url, expected: 'InventoryUpdate' });
  return {
    inventoryId: toString(r.inventoryId ?? r.inventory_id ?? ''),
    onHandQty: toNumber(r.onHandQty ?? r.on_hand_qty ?? 0),
    avgCost: toString(r.avgCost ?? r.avg_cost ?? ''),
  };
}

export function decodeClients(url: string, raw: unknown): ClientEntity[] {
  const arr = ensureArray(raw, { url, expected: 'ClientEntity[]' });
  return arr.map(normalizeClientRow);
}

export function decodeInventory(url: string, raw: unknown): InventoryItem[] {
  const arr = ensureArray(raw, { url, expected: 'InventoryItem[]' });
  return arr.map(normalizeInventoryRow);
}

export function decodeReceipts(url: string, raw: unknown): ReceiptListItem[] {
  const arr = ensureArray(raw, { url, expected: 'ReceiptListItem[]' });
  return arr.map((row) => normalizeReceiptListItem(row, url));
}

export function decodeReceiptDetail(url: string, raw: unknown): ReceiptDetail {
  const root = ensureRecord(raw, { url, expected: 'ReceiptDetail' });
  const receipt = ensureRecord(root.receipt, { url, expected: 'ReceiptDetail.receipt' });
  const items = ensureArray(root.items, { url, expected: 'ReceiptDetail.items[]' });

  const updatesRaw = root.inventoryUpdates ?? root.inventory_updates;
  const updates = updatesRaw === undefined ? [] : ensureArray(updatesRaw, { url, expected: 'InventoryUpdate[]' });

  return {
    receipt: {
      id: toNumber(receipt.id),
      receivedAt: toString(receipt.receivedAt ?? receipt.received_at ?? ''),
      vendor: toNullableString(receipt.vendor),
      mode: toString(receipt.mode ?? ''),
      notes: toNullableString(receipt.notes),
      operationId: toString(receipt.operationId ?? receipt.operation_id ?? ''),
      images: Array.isArray(receipt.images)
        ? receipt.images.filter((img) => typeof img === 'string')
        : undefined,
    },
    items: items.map((row) => normalizeReceiptItem(row, url)),
    inventoryUpdates: updates.map((row) => normalizeInventoryUpdate(row, url)),
  };
}
