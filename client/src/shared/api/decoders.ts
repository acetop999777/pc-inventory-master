import { ApiCallError, HttpMethod } from './http';
import { normalizeClientRow } from '../../domain/client';
import type { ClientEntity } from '../../domain/client';
import type { InventoryItem } from '../../domain/inventory/inventory.types';
import { normalizeInventoryRow } from '../../domain/inventory/normalize';
import type {
  DashboardStats,
  InventoryBatchResult,
  InventoryDeleteResponse,
  InventoryUpdate,
  LogEntry,
  LookupResponse,
  MovementLog,
  ReceiptDetail,
  ReceiptItem,
  ReceiptListItem,
  SuccessResponse,
} from './types';

type DecodeContext = {
  url: string;
  expected: string;
  method?: HttpMethod;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function decodeError(ctx: DecodeContext, body: unknown): never {
  throw new ApiCallError({
    message: `Invalid response for ${ctx.expected}`,
    url: ctx.url,
    method: ctx.method ?? 'GET',
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

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

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

function normalizeLogEntry(row: unknown, url: string): LogEntry {
  const r = ensureRecord(row, { url, expected: 'LogEntry' });
  const meta = isRecord(r.meta) ? r.meta : null;
  return {
    id: toString(r.id ?? ''),
    timestamp: toNumber(r.timestamp ?? 0),
    type: toNullableString(r.type) ?? null,
    title: toNullableString(r.title) ?? null,
    msg: toNullableString(r.msg) ?? null,
    meta,
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

export function decodeDashboardStats(
  url: string,
  raw: unknown,
  method: HttpMethod = 'GET',
): DashboardStats {
  const r = ensureRecord(raw, { url, expected: 'DashboardStats', method });
  return {
    totalProfit: toNumber(r.totalProfit ?? r.total_profit ?? 0),
    totalBalanceDue: toNumber(r.totalBalanceDue ?? r.total_balance_due ?? r.total_balance ?? 0),
    inventoryValue: toNumber(r.inventoryValue ?? r.inventory_value ?? 0),
    totalItems: toNumber(r.totalItems ?? r.total_items ?? 0),
    totalClients: toNumber(r.totalClients ?? r.total_clients ?? 0),
  };
}

export function decodeInventoryMovements(
  url: string,
  raw: unknown,
  method: HttpMethod = 'GET',
): MovementLog[] {
  const arr = ensureArray(raw, { url, expected: 'MovementLog[]', method });
  return arr.map((row) => {
    const r = ensureRecord(row, { url, expected: 'MovementLog', method });
    return {
      id: toNumber(r.id),
      inventoryId: toString(r.inventoryId ?? r.inventory_id ?? ''),
      qtyDelta: toNumber(r.qtyDelta ?? r.qty_delta ?? 0),
      reason: toString(r.reason ?? ''),
      unitCost: toNullableNumber(r.unitCost ?? r.unit_cost ?? null),
      unitCostUsed: toNullableNumber(r.unitCostUsed ?? r.unit_cost_used ?? null),
      onHandAfter: toNumber(r.onHandAfter ?? r.on_hand_after ?? 0),
      avgCostAfter: toNumber(r.avgCostAfter ?? r.avg_cost_after ?? 0),
      occurredAt: toString(r.occurredAt ?? r.occurred_at ?? ''),
      refType: toNullableString(r.refType ?? r.ref_type ?? null),
      refId: toNullableString(r.refId ?? r.ref_id ?? null),
      vendor: toNullableString(r.vendor ?? r.receipt_vendor ?? null),
      receiptReceivedAt: toNullableString(
        r.receiptReceivedAt ?? r.receipt_received_at ?? null,
      ),
      prevQty: toNumber(r.prevQty ?? r.prev_qty ?? 0),
      prevCost: toNumber(r.prevCost ?? r.prev_cost ?? 0),
    };
  });
}

export function decodeLookupResponse(
  url: string,
  raw: unknown,
  method: HttpMethod = 'GET',
): LookupResponse {
  const r = ensureRecord(raw, { url, expected: 'LookupResponse', method });
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  return {
    items: itemsRaw.map((item) => {
      if (!isRecord(item)) return {};
      return { title: item.title, category: item.category };
    }),
  };
}

export function decodeLogs(
  url: string,
  raw: unknown,
  method: HttpMethod = 'GET',
): LogEntry[] {
  const arr = ensureArray(raw, { url, expected: 'LogEntry[]', method });
  return arr.map((row) => normalizeLogEntry(row, url));
}

export function decodeInventoryBatchResult(
  url: string,
  raw: unknown,
  method: HttpMethod = 'POST',
): InventoryBatchResult {
  const r = ensureRecord(raw, { url, expected: 'InventoryBatchResult', method });
  if (r.success !== true) decodeError({ url, expected: 'InventoryBatchResult', method }, raw);
  const updated = r.updatedIds ?? r.updated_ids;
  const idsRaw = Array.isArray(updated) ? updated : [];
  return {
    success: true,
    updatedIds: idsRaw.map((id: unknown) => String(id)),
  };
}

export function decodeSuccessResponse(
  url: string,
  raw: unknown,
  method: HttpMethod = 'POST',
): SuccessResponse {
  const r = ensureRecord(raw, { url, expected: 'SuccessResponse', method });
  if (r.success !== true) decodeError({ url, expected: 'SuccessResponse', method }, raw);
  return { success: true };
}

export function decodeInventoryDeleteResponse(
  url: string,
  raw: unknown,
  method: HttpMethod = 'DELETE',
): InventoryDeleteResponse {
  const r = ensureRecord(raw, { url, expected: 'InventoryDeleteResponse', method });
  if (r.archived === true) {
    const item = r.item ? normalizeInventoryRow(r.item) : null;
    return {
      success: true,
      archived: true,
      refCount: toNumber(r.refCount ?? r.ref_count ?? 0),
      item,
    };
  }
  if (r.success !== true) decodeError({ url, expected: 'InventoryDeleteResponse', method }, raw);
  return { success: true };
}

export function decodeInventoryUpdateResponse(
  url: string,
  raw: unknown,
  method: HttpMethod = 'PUT',
): InventoryItem | null {
  const r = ensureRecord(raw, { url, expected: 'InventoryUpdateResponse', method });
  if (r.success === true) return null;
  return normalizeInventoryRow(r);
}

export function decodeReceiptDetail(
  url: string,
  raw: unknown,
  method: HttpMethod = 'GET',
): ReceiptDetail {
  const root = ensureRecord(raw, { url, expected: 'ReceiptDetail', method });
  const receipt = ensureRecord(root.receipt, { url, expected: 'ReceiptDetail.receipt', method });
  const items = ensureArray(root.items, { url, expected: 'ReceiptDetail.items[]', method });

  const updatesRaw = root.inventoryUpdates ?? root.inventory_updates;
  const updates =
    updatesRaw === undefined
      ? []
      : ensureArray(updatesRaw, { url, expected: 'InventoryUpdate[]', method });

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
