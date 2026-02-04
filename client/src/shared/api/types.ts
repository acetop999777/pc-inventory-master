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
