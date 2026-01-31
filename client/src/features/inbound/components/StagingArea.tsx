import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { StagedItem } from '../../../domain/inventory/inbound.logic';
import { InventoryItem } from '../../../domain/inventory/inventory.types';
import { ALL_CATS } from '../../../domain/inventory/inventory.utils';

interface Props {
  batch: StagedItem[];
  inventory: InventoryItem[];
  setBatch: (items: StagedItem[]) => void;
  onCommit: () => void;
}

export const StagingArea: React.FC<Props> = ({ batch, inventory, setBatch, onCommit }) => {
  const [activeDrop, setActiveDrop] = useState<number | null>(null);

  const updateItem = (idx: number, field: keyof StagedItem, val: any) => {
    const newBatch = [...batch];
    newBatch[idx] = { ...newBatch[idx], [field]: val };
    setBatch(newBatch);
  };

  // 手动关联逻辑
  const matchToLocal = (idx: number, localItem: InventoryItem) => {
    const newBatch = [...batch];
    newBatch[idx] = {
      ...newBatch[idx],
      id: localItem.id,
      name: localItem.name,
      sku: localItem.sku,
      keyword: localItem.keyword,
      category: localItem.category,
      quantity: localItem.quantity,
      cost: localItem.cost,
      price: localItem.price,
      isMatch: true,
      // 继承其他属性
      location: localItem.location,
      status: localItem.status,
    };
    setBatch(newBatch);
    setActiveDrop(null);
  };

  return (
    <div
      className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col h-full min-h-0"
      onClick={() => setActiveDrop(null)}
    >
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">
          Staging ({batch.length})
        </h3>
        {batch.length > 0 && (
          <button
            onClick={onCommit}
            className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-lg active:scale-95 transition-all hover:bg-slate-800"
          >
            Commit All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar pb-10">
        {batch.map((item, i) => {
          const suggestions =
            activeDrop === i
              ? inventory
                  .filter((inv) => {
                    const searchStr = item.name.toLowerCase();
                    return (
                      inv.name.toLowerCase().includes(searchStr) ||
                      (inv.keyword && searchStr.includes(inv.keyword.toLowerCase()))
                    );
                  })
                  .slice(0, 5)
              : [];

          return (
            <div
              key={i}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-blue-200 transition-colors relative animate-in slide-in-from-bottom-2 duration-300"
            >
              {/* Row 1: Name Input & Dropdown */}
              <div className="flex justify-between items-start relative">
                <div className="w-full relative">
                  <input
                    className="font-bold text-sm w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-300"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDrop(i);
                    }}
                    placeholder="Item Name..."
                  />
                  {activeDrop === i && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl border border-slate-100 z-50 mt-2 p-1 overflow-hidden animate-in fade-in zoom-in-95">
                      {suggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            matchToLocal(i, s);
                          }}
                          className="px-3 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center"
                        >
                          <div className="truncate pr-2 font-bold text-slate-700">{s.name}</div>
                          <div className="text-slate-400 font-mono text-[10px] whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">
                            LINK
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setBatch(batch.filter((_, idx) => idx !== i))}
                  className="ml-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Row 2: Tags & Category */}
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.isMatch ? 'bg-emerald-50 text-emerald-600' : item.isApi ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}
                >
                  {item.isMatch ? 'Matched' : item.isApi ? 'API Found' : 'New'}
                </span>
                {item.isGift && (
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase bg-purple-50 text-purple-600">
                    Gift
                  </span>
                )}

                <select
                  className="text-[10px] font-bold bg-slate-50 text-slate-500 rounded-lg px-2 py-1 outline-none uppercase cursor-pointer hover:bg-slate-100 transition-colors"
                  value={item.category}
                  onChange={(e) => updateItem(i, 'category', e.target.value)}
                >
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Qty & Cost Inputs */}
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3 border border-transparent focus-within:border-blue-200 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span>
                  <input
                    type="number"
                    className="bg-transparent text-right font-black text-sm w-12 outline-none"
                    value={item.qtyInput}
                    onChange={(e) => updateItem(i, 'qtyInput', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between px-3 border border-transparent focus-within:border-blue-200 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cost</span>
                  <div className="flex items-center">
                    <span className="text-xs font-bold text-emerald-600 mr-0.5">$</span>
                    <input
                      type="number"
                      className="bg-transparent text-right font-black text-sm w-20 outline-none text-emerald-600"
                      value={item.costInput}
                      onChange={(e) => updateItem(i, 'costInput', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: SKU */}
              <div className="flex justify-between items-center">
                <input
                  className="text-[10px] font-mono text-slate-400 bg-transparent outline-none w-full placeholder:text-slate-200"
                  placeholder="SKU / UPC Code"
                  value={item.sku}
                  onChange={(e) => updateItem(i, 'sku', e.target.value)}
                />
                {item.isMatch && (
                  <span className="text-[9px] text-slate-300 font-bold ml-2 whitespace-nowrap">
                    ID_LINKED
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
