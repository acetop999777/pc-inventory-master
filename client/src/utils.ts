import { InventoryItem } from './types';

export const API_BASE = `http://${window.location.hostname}:5001/api`;
export const generateId = (): string => Math.random().toString(36).substr(2, 9);
export const formatMoney = (n: number | undefined): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// 1. 只有这一套标准，全系统通用
export const CORE_CATS = ['CPU', 'COOLER', 'MB', 'RAM', 'SSD', 'GPU', 'CASE', 'PSU'];
export const ALL_CATS = [...CORE_CATS, 'FAN', 'MONITOR', 'CUSTOM', 'OTHER'];
export const STATUS_STEPS = ['Deposit Paid', 'Parts Ordered', 'Building', 'Ready', 'Delivered'];

// 2. 及其单纯的判断逻辑：进来的名字 -> 直接定死标准类目
export const guessCategory = (name: string): string => {
    if(!name) return 'OTHER';
    const n = name.toLowerCase();
    
    if(n.includes('cpu')||n.includes('ryzen')||n.includes('intel')||n.includes('processor')) return 'CPU';
    if(n.includes('motherboard')||n.includes('b650')||n.includes('z790')||n.includes('x670')) return 'MB';
    if(n.includes('memory')||n.includes('ram')||n.includes('ddr5')) return 'RAM';
    if(n.includes('video card')||n.includes('geforce')||n.includes('rtx')||n.includes('graphics card')) return 'GPU';
    if(n.includes('ssd')||n.includes('nvme')||n.includes('m.2')) return 'SSD';
    if(n.includes('cooler')||n.includes('liquid')||n.includes('aio')||n.includes('heatsink')) return 'COOLER';
    if(n.includes('supply')||n.includes('psu')||n.includes('modular')) return 'PSU';
    if(n.includes('case')||n.includes('tower')||n.includes('chassis')||n.includes('o11')) return 'CASE';
    if(n.includes('fan')||n.includes('uni fan')) return 'FAN';
    if(n.includes('monitor')||n.includes('display')) return 'MONITOR';
    
    return 'OTHER';
};

export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxDim = 800; 
                let w = img.width, h = img.height;
                if(w>h && w>maxDim) { h*=maxDim/w; w=maxDim; }
                else if(h>maxDim) { w*=maxDim/h; h=maxDim; }
                canvas.width=w; canvas.height=h;
                ctx?.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    });
};

export async function apiCall<T>(url: string, method='GET', body: any = null): Promise<T | null> {
    try {
        const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
        if(body) opts.body = JSON.stringify(body);
        const res = await fetch(`${API_BASE}${url}`, opts);
        return await res.json() as T;
    } catch(e) { return null; }
}

export async function lookupBarcode(code: string): Promise<{name: string, category: string} | null> {
    const data: any = await apiCall(`/lookup/${code}`);
    if (data && data.items && data.items.length > 0) {
        const item = data.items[0];
        return { 
            name: item.title, 
            category: item.category ? guessCategory(item.category+' '+item.title) : guessCategory(item.title) 
        };
    }
    return null;
}

export function findBestMatch(targetName: string, inventory: InventoryItem[]): InventoryItem | null {
    if(!targetName) return null;
    const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let best: InventoryItem | null = null; 
    let bestScore = 0;
    inventory.forEach(item => {
        let score = 0;
        const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanKey = (item.keyword || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if(cleanKey && cleanTarget.includes(cleanKey)) score += 100; 
        if(cleanTarget.includes(cleanName) && cleanName.length > 5) score += 80;
        targetName.split(' ').forEach(t => { if(t.length > 3 && item.name.toLowerCase().includes(t.toLowerCase())) score += 5; });
        if(score > bestScore) { bestScore = score; best = item; }
    });
    return bestScore > 20 ? best : null;
}