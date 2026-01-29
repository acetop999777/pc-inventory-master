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

export interface Client {
  id: string;
  wechatName: string;
  wechatId?: string;
  realName?: string;
  xhsName?: string;
  xhsId?: string;
  orderDate: string;
  depositDate?: string;
  deliveryDate?: string;
  pcppLink?: string;
  isShipping: boolean;
  trackingNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  status: string;
  totalPrice: number;
  actualCost: number;
  profit: number;
  paidAmount: number;
  specs: Record<
    string,
    {
      name: string;
      sku: string;
      cost: number;
      qty: number;
    }
  >;
  photos: string[];
  rating: number;
  notes: string;
}

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
