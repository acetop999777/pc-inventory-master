import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InboundScanner } from './components/InboundScanner';
import { StagingArea } from './components/StagingArea';
import { StagedItem, processScan, parseNeweggText } from '../../../domain/inventory/inbound.logic';
import { InventoryItem } from '../../../types';
import { apiCallOrThrow } from '../../../utils';
import { useInventoryQuery, inventoryQueryKey } from '../../../app/queries/inventory';

export default function InboundHub() {
  const qc = useQueryClient();
  const { data } = useInventoryQuery();
  const inventory: InventoryItem[] = data ?? [];

  const [batch, setBatch] = useState<StagedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleScan = async (code: string) => {
    setLoading(true);
    const res = await processScan(code, batch, inventory);
    setLoading(false);

    if (res.updatedBatch) setBatch(res.updatedBatch);
    else if (res.item) setBatch((prev) => [res.item!, ...prev]);
  };

  const handleParse = (text: string) => {
    const res = parseNeweggText(text, inventory);
    if (res.items.length > 0) setBatch((prev) => [...res.items, ...prev]);
    else alert('No items found or parse error');
  };

  const handleCommit = async () => {
    if (!window.confirm(`Commit ${batch.length} items to inventory?`)) return;

    const payloadMap = new Map<string, InventoryItem>();

    batch.forEach((item) => {
      const existingInMap = payloadMap.get(item.id);
      const existingInDb = inventory.find((i) => i.id === item.id);
      const base = existingInMap || existingInDb || ({ ...item, quantity: 0, cost: 0 } as any);

      const baseQty = Number((base as any).quantity ?? 0);
      const baseCost = Number((base as any).cost ?? 0);
      const inQty = Number((item as any).qtyInput ?? 0);
      const inCost = Number((item as any).costInput ?? 0);

      const currentTotalVal = baseQty * baseCost;
      const newTotalVal = inQty * inCost;

      const totalQty = baseQty + inQty;
      const newAvgCost = totalQty > 0 ? (currentTotalVal + newTotalVal) / totalQty : 0;

      payloadMap.set(item.id, {
        ...(base as any),
        name: item.name,
        category: item.category,
        quantity: totalQty,
        cost: Math.round(newAvgCost * 100) / 100,
        sku: (item as any).sku,
        keyword: (item as any).keyword,
        lastUpdated: Date.now(),
        price: (base as any).price || 0,
        location: (base as any).location || '',
        status: (base as any).status || 'In Stock',
        notes: (base as any).notes || '',
        photos: (base as any).photos || [],
      });
    });

    try {
      await apiCallOrThrow('/inventory/batch', 'POST', Array.from(payloadMap.values()));
      setBatch([]);
      alert('Inventory Updated Successfully!');
      await qc.invalidateQueries({ queryKey: inventoryQueryKey });
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
