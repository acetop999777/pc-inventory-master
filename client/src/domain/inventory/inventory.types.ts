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
