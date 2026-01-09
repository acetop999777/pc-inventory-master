import { InventoryItem } from '../../types';
import { generateId, findBestMatch, guessCategory, lookupBarcode } from '../../utils';

export interface StagedItem extends InventoryItem {
    qtyInput: number;
    costInput: number;
    isMatch?: boolean;
    isApi?: boolean;
    tempSubtotal?: number;
    isGift?: boolean;
}

export const processScan = async (code: string, currentBatch: StagedItem[], inventory: InventoryItem[]): Promise<{ updatedBatch?: StagedItem[], item?: StagedItem, msg: string, type?: string }> => {
    // A. Check Staging
    const batchIdx = currentBatch.findIndex(i => i.sku === code);
    if (batchIdx >= 0) {
        const newBatch = [...currentBatch];
        newBatch[batchIdx].qtyInput += 1;
        return { updatedBatch: newBatch, msg: 'Quantity updated in staging' };
    }

    // B. Check Inventory
    const match = inventory.find(i => (i.sku && i.sku === code) || (i.keyword && i.keyword === code));
    if (match) {
        const newItem: StagedItem = {
            ...match,
            qtyInput: 1,
            costInput: match.cost,
            isMatch: true
        };
        // 绝对没有任何反斜杠的模板字符串
        return { item: newItem, msg: 'Matched existing: ' + match.name };
    }

    // C. Check API
    const apiData = await lookupBarcode(code);
    
    // D. Fuzzy Match
    let fuzzyMatch: InventoryItem | null = null;
    if (apiData) {
        fuzzyMatch = findBestMatch(apiData.name, inventory);
    }

    const newItem: StagedItem = {
        id: fuzzyMatch ? fuzzyMatch.id : generateId(),
        name: fuzzyMatch ? fuzzyMatch.name : (apiData ? apiData.name : 'New Item (Manual Entry)'),
        category: fuzzyMatch ? fuzzyMatch.category : (apiData ? apiData.category : 'OTHER'),
        sku: code,
        keyword: fuzzyMatch?.keyword || '',
        quantity: fuzzyMatch?.quantity || 0,
        cost: fuzzyMatch?.cost || 0,
        price: fuzzyMatch?.price || 0,
        location: fuzzyMatch?.location || '',
        status: fuzzyMatch?.status || 'In Stock',
        notes: fuzzyMatch?.notes || '',
        photos: fuzzyMatch?.photos || [],
        lastUpdated: Date.now(),
        
        qtyInput: 1,
        costInput: 0,
        isMatch: !!fuzzyMatch,
        isApi: !!apiData
    };

    let msg = 'Not Found - Manual Entry';
    let type = 'error';
    if (fuzzyMatch) { msg = 'Matched existing: ' + fuzzyMatch.name; type = 'success'; }
    else if (apiData) { msg = 'Found in Global DB (New Entry)'; type = 'info'; }

    return { item: newItem, msg, type };
};

export const parseNeweggText = (text: string, inventory: InventoryItem[]): { items: StagedItem[], msg: string, type?: string } => {
    try {
        const gtMatch = text.match(/Grand Total\s*\n?\$?([\d,]+\.\d{2})/);
        const grandTotal = gtMatch ? parseFloat(gtMatch[1].replace(/,/g,'')) : 0;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const items: StagedItem[] = [];

        for(let i=0; i<lines.length; i++) {
            if(lines[i].startsWith('Item #:')) {
                // Name extraction
                let name = "Unknown Item";
                let k = i - 1;
                while(k >= 0) {
                    const line = lines[k];
                    if (line.includes('Return Policy') || line.startsWith('COMBO') || line.includes('Free Gift') || line.includes('Warranty')) {
                        k--; continue;
                    }
                    name = line; break;
                }

                // Qty & Price extraction
                let qty = 1;
                let subtotal = 0;
                for(let j=1; j<8; j++) {
                    const l = lines[i+j];
                    if(!l) continue;
                    if(l.includes('ea.)')) {
                        const priceMatch = lines[i+j-1].match(/\$?([\d,]+\.\d{2})/);
                        if (priceMatch) subtotal = parseFloat(priceMatch[1].replace(/,/g, ''));
                        const qtyLine = lines[i+j-2];
                        if (qtyLine && /^\d+$/.test(qtyLine)) qty = parseInt(qtyLine);
                        break; 
                    }
                    if (l.startsWith('$') && !l.includes('ea.')) {
                        const possiblePrice = parseFloat(l.replace(/[$,]/g, ''));
                        const prevLine = lines[i+j-1];
                        if (/^\d+$/.test(prevLine)) {
                            qty = parseInt(prevLine);
                            subtotal = possiblePrice;
                            break;
                        }
                    }
                }

                const dbMatch = findBestMatch(name, inventory);
                const autoCat = dbMatch?.category || guessCategory(name);
                const isGift = lines.slice(Math.max(0, i-6), i).some(l => l.includes('Free Gift Item'));

                items.push({
                    id: dbMatch?.id || generateId(),
                    name: dbMatch?.name || name,
                    category: autoCat,
                    sku: dbMatch?.sku || '',
                    keyword: dbMatch?.keyword || '',
                    quantity: dbMatch?.quantity || 0,
                    cost: dbMatch?.cost || 0,
                    price: dbMatch?.price || 0,
                    location: dbMatch?.location || '',
                    status: dbMatch?.status || 'In Stock',
                    notes: dbMatch?.notes || '',
                    photos: dbMatch?.photos || [],
                    lastUpdated: Date.now(),
                    
                    qtyInput: qty,
                    tempSubtotal: subtotal,
                    isGift: isGift,
                    isMatch: !!dbMatch,
                    costInput: 0,
                    isApi: false
                });
            }
        }

        const validItems = items.filter(i => !i.isGift);
        const sumSubtotals = validItems.reduce((a, b) => a + (b.tempSubtotal || 0), 0);

        const finalBatch = items.map(item => {
            let finalCost = 0;
            if (!item.isGift && sumSubtotals > 0 && grandTotal > 0) {
                const weight = (item.tempSubtotal || 0) / sumSubtotals;
                finalCost = (weight * grandTotal) / item.qtyInput;
            }
            return { ...item, costInput: parseFloat(finalCost.toFixed(2)) };
        });

        if (finalBatch.length === 0) return { items: [], msg: 'No items found', type: 'error' };
        
        const matchCount = finalBatch.filter(i => i.isMatch).length;
        return { items: finalBatch, msg: 'Parsed ' + finalBatch.length + ' items' };

    } catch(e) {
        console.error(e);
        return { items: [], msg: 'Parse Error', type: 'error' };
    }
};
