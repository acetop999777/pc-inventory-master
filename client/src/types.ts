import type { ClientEntity } from './domain/client/client.types';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  cost: number;
  quantity: number;
  lastUpdated: number;
  keyword?: string;
  price?: number;
  location?: string;
  status?: string;
  notes?: string;
  metadata?: Record<string, any>;
  photos?: string[];
}

export type Client = ClientEntity;

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
  clients: Client[];
  logs: any[];
}
