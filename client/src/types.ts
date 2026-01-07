// --- Inventory Types ---
export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    cost: number;
    price: number;
    sku: string;
    keyword?: string; // 修复：加回 keyword 字段 (设为可选)
    location: string;
    status: string;
    notes: string;
    photos: string[];
}

// --- Client/Order Types ---
export interface SpecItem {
    name: string;
    sku: string;
    cost: number;
    qty: number;
}

export interface ClientSpecs {
    [category: string]: SpecItem;
}

export interface Client {
    id: string;
    wechatName: string;
    realName: string;
    wechatId: string;
    xhsName: string;
    xhsId: string;
    isShipping: boolean;
    city: string;
    zip: string;
    state: string;
    address: string;
    trackingNumber: string;
    status: string;
    specs: ClientSpecs;
    totalPrice: number;
    actualCost: number;
    profit: number;
    orderDate: string;
    depositDate: string;
    deliveryDate: string;
    photos: string[];
    rating: number;
    pcppLink: string;
    notes: string;
}

// --- App Data ---
export interface AppData {
    inv: InventoryItem[];
    clients: Client[];
    stats: {
        inventoryValue: number;
        totalItems: number;
        totalClients: number;
        totalProfit: number;
    };
}

// --- Audit Log Types ---
export type AuditType = 'IN' | 'OUT' | 'ADJUST' | 'COMMIT';

export interface AuditLog {
    id: string;
    sku: string;
    name: string;
    type: AuditType;
    qtyChange: number;
    unitCost: number;
    totalValue: number;
    refId?: string;
    operator: string;
    date: string;
}