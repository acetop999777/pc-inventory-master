import type { ClientEntity } from './domain/client/client.types';
import type { InventoryItem } from './domain/inventory/inventory.types';

export type { InventoryItem } from './domain/inventory/inventory.types';

// 补全这个漏掉的接口
export interface AuditLog {
  id: string;
  sku: string;
  name: string;
  type: string;
  qtyChange: number;
  unitCost: number;
  totalValue: number;
  refId?: string;
  operator?: string;
  date: string;
}

export interface AppData {
  inv: InventoryItem[];
  clients: ClientEntity[];
  logs: any[];
}
