import React, { useState } from 'react';
import { InboundScanner } from './components/InboundScanner';
import { StagingArea } from './components/StagingArea';
import { StagedItem, processScan, parseNeweggText } from '../../../domain/inventory/inbound.logic';
import { InventoryItem } from '../../../types';
import { apiCall } from '../../../utils';

interface Props {
    inventory?: InventoryItem[];
}

export default function InboundHub({ inventory = [] }: Props) {
    const [batch, setBatch] = useState<StagedItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. 扫码处理
    const handleScan = async (code: string) => {
        setLoading(true);
        const res = await processScan(code, batch, inventory);
        setLoading(false);
        
        if (res.updatedBatch) {
            setBatch(res.updatedBatch);
            // 这里可以加一个 toast 通知
        } else if (res.item) {
            setBatch(prev => [res.item!, ...prev]);
        }
    };

    // 2. 文本解析处理
    const handleParse = (text: string) => {
        const res = parseNeweggText(text, inventory);
        if (res.items.length > 0) {
            setBatch(prev => [...res.items, ...prev]);
        } else {
            alert('No items found or parse error');
        }
    };

    // 3. 提交处理 (包含加权成本合并逻辑)
    const handleCommit = async () => {
        if (!window.confirm(`Commit ${batch.length} items to inventory?`)) return;

        const payloadMap = new Map<string, InventoryItem>();
        
        // 预处理：将 batch 数据合并到 Map 中 (处理 batch 内重复项)
        batch.forEach(item => {
            // 注意：这里我们使用 item.id。如果是 New Item，id 是 generateId() 生成的唯一值
            // 如果是 Matched Item，id 是现有库存的 id
            
            const existingInMap = payloadMap.get(item.id);
            
            // 还需要检查它是否已经在 inventory 数据库中 (为了计算加权平均)
            const existingInDb = inventory.find(i => i.id === item.id);
            
            // 基础数据源 (Map优先，其次DB，最后是自身)
            const base = existingInMap || existingInDb || { ...item, quantity: 0, cost: 0 };
            
            // 计算新的加权成本
            const currentTotalVal = (base.quantity * base.cost);
            const newTotalVal = (item.qtyInput * item.costInput);
            const totalQty = base.quantity + item.qtyInput;
            const newCost = totalQty > 0 ? (currentTotalVal + newTotalVal) / totalQty : 0;

            payloadMap.set(item.id, {
                ...base,
                // 覆盖/更新字段
                name: item.name, // 允许改名
                category: item.category,
                quantity: totalQty,
                cost: parseFloat(newCost.toFixed(2)),
                sku: item.sku,
                keyword: item.keyword,
                lastUpdated: Date.now(),
                // 继承其他必填字段
                price: base.price || 0,
                location: base.location || '',
                status: base.status || 'In Stock',
                notes: base.notes || '',
                photos: base.photos || []
            });
        });
        
        try {
            await apiCall('/inventory/batch', 'POST', Array.from(payloadMap.values()));
            setBatch([]);
            alert('Inventory Updated Successfully!');
            // 触发 App.tsx 刷新由父组件控制
            window.location.reload(); // 简单粗暴刷新以获取最新数据
        } catch (e) {
            console.error(e);
            alert('Failed to commit batch');
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                <InboundScanner onScan={handleScan} onParse={handleParse} loading={loading} />
                <StagingArea batch={batch} inventory={inventory} setBatch={setBatch} onCommit={handleCommit} />
            </div>
        </div>
    );
}
