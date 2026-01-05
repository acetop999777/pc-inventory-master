export interface InventoryItem {
    id: string;
    category: string;
    name: string;
    keyword?: string;
    sku?: string;
    quantity: number;
    cost: number;
}

export interface SpecItem {
    name: string;
    sku: string;
    cost: number;
    qty: number;
}

export interface ClientSpecs {
    [key: string]: SpecItem;
}

export interface Client {
    id: string;
    wechatName: string;
    wechatId?: string;
    realName?: string;
    xhsName?: string;
    xhsId?: string;
    
    orderDate?: string;
    depositDate?: string;
    deliveryDate?: string;
    
    status: string;
    
    totalPrice: number;
    actualCost: number;
    profit: number;
    
    specs: ClientSpecs;
    photos: string[]; 
    rating: number;   
    notes: string;
    
    isShipping: boolean;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    trackingNumber?: string;
    pcppLink?: string;
}

export interface AppData {
    inv: InventoryItem[];
    clients: Client[];
    logs: any[];
}