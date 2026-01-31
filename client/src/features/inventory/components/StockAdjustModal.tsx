import React from 'react';
import { X } from 'lucide-react';
import { InventoryItem } from '../../../domain/inventory/inventory.types';

type Mode = 'add' | 'remove';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function StockAdjustModal(props: {
  open: boolean;
  item: InventoryItem | null;
  initialMode?: Mode;
  onClose: () => void;
  onApply: (payload: { quantity: number; cost: number }) => void;
}) {
  const { open, item, onClose, onApply } = props;

  const [mode, setMode] = React.useState<Mode>(props.initialMode ?? 'add');
  const [qtyInput, setQtyInput] = React.useState<string>('1');
  const [unitCostInput, setUnitCostInput] = React.useState<string>('0');

  React.useEffect(() => {
    if (!open || !item) return;
    setMode(props.initialMode ?? 'add');
    setQtyInput('1');
    setUnitCostInput(String(Number(item.cost ?? 0)));
  }, [open, item, props.initialMode]);

  if (!open || !item) return null;

  const currentQty = clampInt(Number(item.quantity ?? 0));
  const currentAvg = Number(item.cost ?? 0);

  const qty = clampInt(Number(qtyInput));
  const unitCostRaw = Number(unitCostInput);
  const hasValidUnitCost = Number.isFinite(unitCostRaw) && unitCostRaw >= 0;
  const unitCost = hasValidUnitCost ? unitCostRaw : currentAvg;
  const effectiveQty = mode === 'remove' ? Math.min(qty, currentQty) : qty;

  const previewQty =
    mode === 'add' ? currentQty + effectiveQty : Math.max(0, currentQty - effectiveQty);

  const previewAvg =
    mode === 'add'
      ? previewQty > 0
        ? Math.max(0, (currentQty * currentAvg + effectiveQty * unitCost) / previewQty)
        : 0
      : previewQty > 0
        ? Math.max(0, (currentQty * currentAvg - effectiveQty * unitCost) / previewQty)
        : 0;

  const canApply = effectiveQty > 0 && hasValidUnitCost;

  const apply = () => {
    if (!canApply) return;
    onApply({ quantity: previewQty, cost: round2(previewAvg) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999]">
      {/* overlay */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <div className="text-sm font-black text-slate-900">Update Stock</div>
              <div className="text-xs text-slate-500 font-bold mt-0.5">
                {item.name} <span className="text-slate-300">·</span> {item.category}
              </div>
            </div>
            <button
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 grid grid-cols-12 gap-6">
            {/* left: form */}
            <div className="col-span-12 md:col-span-7 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Current
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Quantity
                    </div>
                    <div className="mt-1 font-mono text-lg font-black text-slate-800">
                      {currentQty}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      WAC Avg Cost
                    </div>
                    <div className="mt-1 font-mono text-lg font-black text-slate-800">
                      ${round2(currentAvg)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Action
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('add')}
                    className={`px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider ${
                      mode === 'add'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Add Stock
                  </button>
                  <button
                    onClick={() => setMode('remove')}
                    className={`px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider ${
                      mode === 'remove'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Remove Stock
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {mode === 'add' ? 'Add Quantity' : 'Remove Quantity'}
                  </div>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    inputMode="numeric"
                  />
                  <div className="text-[11px] text-slate-400">Integer ≥ 1</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Unit Cost (this update)
                  </div>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-200"
                    value={unitCostInput}
                    onChange={(e) => setUnitCostInput(e.target.value)}
                    inputMode="decimal"
                  />
                  <div className="text-[11px] text-slate-400">
                    Used to compute new WAC (add or remove)
                  </div>
                </div>
              </div>
            </div>

            {/* right: preview */}
            <div className="col-span-12 md:col-span-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sticky top-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Preview
                </div>

                <div className="mt-3 space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      New Quantity
                    </div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-800">
                      {previewQty}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      New WAC Avg Cost
                    </div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-800">
                      ${round2(previewAvg)}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      {mode === 'remove'
                        ? 'WAC = (oldQty*oldAvg - removeQty*unitCost) / (oldQty-removeQty)'
                        : 'WAC = (oldQty*oldAvg + addQty*unitCost) / (oldQty+addQty)'}
                    </div>
                  </div>

                  {!canApply && (
                    <div className="text-[11px] text-red-500 font-bold">
                      Please enter a valid quantity and unit cost.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={apply}
                    disabled={!canApply}
                    className={`flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${
                      canApply
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Apply
                  </button>
                </div>

                <div className="mt-3 text-[10px] text-slate-400 font-bold">
                  Changes save in background (Syncing → Saved).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
