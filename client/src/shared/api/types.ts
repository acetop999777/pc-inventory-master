export type SuccessResponse = { success: true };

export type InventoryBatchResult = { success: true; updatedIds: string[] };

export type InventoryDeleteResponse = {
  success: true;
  archived?: boolean;
  refCount?: number;
  item?: unknown | null;
};

export type LogEntry = {
  id: string;
  timestamp: number;
  type: string | null;
  title: string | null;
  msg: string | null;
  meta: Record<string, unknown> | null;
};

export type DashboardStats = {
  totalProfit: number;
  totalBalanceDue: number;
  inventoryValue: number;
  totalItems: number;
  totalClients: number;
};

export type MovementLog = {
  id: number;
  inventoryId: string;
  qtyDelta: number;
  reason: string;
  unitCost: number | null;
  unitCostUsed: number | null;
  onHandAfter: number;
  avgCostAfter: number;
  occurredAt: string;
  refType: string | null;
  refId: string | null;
  vendor: string | null;
  receiptReceivedAt: string | null;
  prevQty: number;
  prevCost: number;
};

export type LookupItem = { title?: unknown; category?: unknown };
export type LookupResponse = { items: LookupItem[] };

export type ReceiptListItem = {
  id: number;
  receivedAt: string;
  vendor: string | null;
  mode: string;
  notes: string | null;
  createdAt: string;
  operationId: string;
  totalAmount: number;
};

export type ReceiptItem = {
  id: number;
  receiptId: number;
  inventoryId: string;
  qtyReceived: number;
  unitCost: string;
  lineTotal: string;
  displayName: string;
  sku: string;
};

export type InventoryUpdate = { inventoryId: string; onHandQty: number; avgCost: string };

export type ReceiptDetail = {
  receipt: {
    id: number;
    receivedAt: string;
    vendor: string | null;
    mode: string;
    notes: string | null;
    operationId: string;
    images?: string[];
  };
  items: ReceiptItem[];
  inventoryUpdates: InventoryUpdate[];
};
