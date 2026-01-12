import React, { useState } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { InventoryItem } from '../../../../types';
import { CORE_CATS, findBestMatch } from '../../../../utils'; 

interface Props {
    data: ClientEntity;
    inventory: InventoryItem[];
    update: (field: keyof ClientEntity, val: any) => void;
    onCalculate: () => void;
}

export const SpecsTable: React.FC<Props> = ({ data, inventory, update, onCalculate }) => {
    const [activeDrop, setActiveDrop] = useState<string | null>(null);

    // 解析逻辑 (PCPP)
    const parsePCPP = (text: string) => {
        if(!text) return;
        const initSpecs: any = {};
        CORE_CATS.forEach(c => { initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 }; });
        const newSpecs = { ...initSpecs };
        const map: Record<string, string> = { 'CPU':'CPU', 'CPU Cooler':'COOLER', 'Motherboard':'MB', 'Memory':'RAM', 'Storage':'SSD', 'Video Card':'GPU', 'Case':'CASE', 'Power Supply':'PSU', 'Case Fan': 'FAN', 'Monitor': 'MONITOR', 'Operating System': 'OTHER' };
        
        const lines = text.split('\n');
        let link = '';
        lines.forEach(l => {
            const line = l.trim();
            if (!line || line.startsWith('Custom:')) return;
            if(line.includes('pcpartpicker.com/list/')) link = line.match(/(https?:\/\/\S+)/)?.[0] || '';
            for (const [pcppLabel, internalCat] of Object.entries(map)) {
                if (line.startsWith(pcppLabel + ':')) {
                    const content = line.substring(pcppLabel.length + 1).trim(); 
                    const namePart = content.split('($')[0].trim();
                    const dbMatch = findBestMatch(namePart, inventory);
                    const costToUse = dbMatch ? dbMatch.cost : 0;
                    let targetKey = internalCat;
                    let counter = 2;
                    while (newSpecs[targetKey] && newSpecs[targetKey].name) {
                        if (newSpecs[targetKey].name === (dbMatch ? dbMatch.name : namePart)) break;
                        // 修复点：移除了这里的反斜杠
                        targetKey = `${internalCat} ${counter}`;
                        counter++;
                    }
                    if (!newSpecs[targetKey]) newSpecs[targetKey] = { name: '', sku: '', cost: 0, qty: 0 };
                    if (newSpecs[targetKey].name) {
                        newSpecs[targetKey].cost += costToUse;
                        newSpecs[targetKey].qty = (newSpecs[targetKey].qty || 1) + 1;
                    } else {
                        newSpecs[targetKey] = { name: dbMatch ? dbMatch.name : namePart, sku: dbMatch?.sku || '', cost: costToUse, qty: 1 };
                    }
                    break; 
                }
            }
        });
        update('specs', newSpecs);
        if(link) update('pcppLink', link);
    };

    const updateSpec = (cat: string, field: 'name' | 'sku' | 'cost', val: any) => {
        const currentSpec = data.specs[cat] || { name: '', sku: '', cost: 0, qty: 1 };
        const newSpecs = { ...data.specs, [cat]: { ...currentSpec, [field]: val } };
        update('specs', newSpecs);
    };

    const selectInventoryItem = (cat: string, item: InventoryItem) => {
        const currentSpec = data.specs[cat] || { name: '', sku: '', cost: 0, qty: 1 };
        const newSpecs = { ...data.specs, [cat]: { ...currentSpec, name: item.name, sku: item.sku || '', cost: item.cost } };
        update('specs', newSpecs);
        setActiveDrop(null);
    };

    // 显示顺序处理
    const displayCats = Array.from(new Set([...CORE_CATS, ...Object.keys(data.specs)])).sort((a, b) => {
        const idxA = CORE_CATS.indexOf(a.split(' ')[0]);
        const idxB = CORE_CATS.indexOf(b.split(' ')[0]);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB) || a.localeCompare(b);
    });

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" onClick={() => setActiveDrop(null)}>
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Cpu size={14}/> Specifications</h3>
                <textarea className="w-1/2 h-8 bg-white border border-slate-200 rounded text-[10px] px-2 py-1 resize-none outline-none focus:border-blue-400 transition-all placeholder:text-slate-300" placeholder="Paste PCPartPicker list to auto-fill..." onChange={e=>parsePCPP(e.target.value)}/>
            </div>
            <div className="divide-y divide-slate-100">
                {displayCats.map(cat => {
                    const spec = data.specs[cat] || { name: '', sku: '', cost: 0, qty: 1 };
                    const dropdownOpen = activeDrop === cat;
                    const suggestions = dropdownOpen ? inventory.filter(i => i.name.toLowerCase().includes(spec.name.toLowerCase())).slice(0,5) : [];
                    
                    return (
                        <div key={cat} className="grid grid-cols-12 gap-4 px-5 py-3 hover:bg-slate-50/50 items-center text-sm">
                            <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">{cat} {spec.qty > 1 && <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[9px]">x{spec.qty}</span>}</div>
                            <div className="col-span-7 relative">
                                <input className="w-full font-bold text-slate-700 outline-none bg-transparent placeholder:text-slate-200" placeholder="Component Name..." value={spec.name} onChange={e=>updateSpec(cat, 'name', e.target.value)} onFocus={()=>setActiveDrop(cat)} onClick={e=>e.stopPropagation()}/>
                                {dropdownOpen && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg border border-slate-100 z-50 mt-1 overflow-hidden">
                                        {suggestions.map(s => (
                                            <div key={s.id} className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between" onMouseDown={()=>selectInventoryItem(cat, s)}>
                                                <span className="font-bold text-slate-700 truncate">{s.name}</span>
                                                <span className="font-mono text-slate-400">${s.cost}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-3 flex justify-end items-center gap-2">
                                <div className="flex items-center bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                    <span className="text-[10px] text-slate-400 mr-1">$</span>
                                    <input className="w-12 text-right font-mono font-bold text-slate-600 bg-transparent outline-none text-xs" value={spec.cost} onChange={e=>updateSpec(cat, 'cost', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
