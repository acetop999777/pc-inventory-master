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
