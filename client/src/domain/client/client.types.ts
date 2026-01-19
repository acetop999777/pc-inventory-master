export interface ClientSpecs {
  [category: string]: {
    name: string;
    sku: string;
    cost: number;
    qty: number;
  };
}

export interface ClientEntity {
  id: string;
  // Identity
  wechatName: string;
  wechatId: string;
  realName: string;
  xhsName: string;
  xhsId: string;
  phone: string;
  rating: number; // 1, 0, -1
  notes: string;
  photos: string[];

  // Logistics
  status: string;
  orderDate: string; // ISO String YYYY-MM-DD
  deliveryDate: string; // ISO String YYYY-MM-DD
  isShipping: boolean;
  trackingNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;

  // Financials
  totalPrice: number;
  paidAmount: number;

  // Specs
  specs: ClientSpecs;
  pcppLink: string;
}

// 纯逻辑：计算衍生数据
export interface ClientFinancials {
  totalCost: number;
  profit: number;
  balanceDue: number;
  isPaidOff: boolean;
}
