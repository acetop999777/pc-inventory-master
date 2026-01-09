import React, { useState, useMemo, useRef } from 'react';
import { ClientEntity } from './domain/client/client.types';
import { calculateFinancials, createEmptyClient } from './domain/client/client.logic';
import { IdentityCard } from './presentation/modules/ClientEditor/components/IdentityCard';
import { LogisticsCard } from './presentation/modules/ClientEditor/components/LogisticsCard';
import { FinancialsCard } from './presentation/modules/ClientEditor/components/FinancialsCard';
import { FileText, Camera, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';

// 临时把 STATUS_STEPS 放在这，以后移入 Domain
const STATUS_STEPS = ['Pending', 'Deposit', 'Building', 'Ready', 'Delivered'];

export default function App() {
    const [client, setClient] = useState<ClientEntity>(createEmptyClient());
    const fileRef = useRef<HTMLInputElement>(null);
    const financials = useMemo(() => calculateFinancials(client), [client]);

    const updateField = (field: keyof ClientEntity, val: any) => {
        setClient(prev => ({ ...prev, [field]: val }));
    };

    // 模拟照片功能
    const handlePhoto = () => {}; 
    const removePhoto = () => {};

    return (
        <div className="min-h-screen bg-slate-50/50 pb-40">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button className="text-slate-500 hover:text-slate-800"><ChevronLeft size={20}/></button>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <span className="font-black text-lg text-slate-800">{client.wechatName || 'New Client'}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <CheckCircle2 size={12} className="text-emerald-500"/> Saved
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
                {/* Left Col */}
                <div className="col-span-12 xl:col-span-4 space-y-6">
                    <IdentityCard 
                        data={client} 
                        update={updateField} 
                        onPhotoUpload={() => fileRef.current?.click()} 
                        onPhotoRemove={removePhoto} 
                    />
                    <LogisticsCard 
                        data={client} 
                        update={updateField} 
                        statusOptions={STATUS_STEPS}
                    />
                    
                    {/* Notes Card (简单内联) */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                         <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14} className="text-slate-400"/> Notes</h3>
                         <textarea 
                            className="w-full h-24 bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs font-medium resize-none outline-none focus:border-blue-200 transition-colors"
                            value={client.notes}
                            onChange={e => updateField('notes', e.target.value)}
                         />
                         <input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={handlePhoto}/>
                    </div>
                </div>

                {/* Right Col */}
                <div className="col-span-12 xl:col-span-8 space-y-6">
                    <FinancialsCard 
                        data={client} 
                        financials={financials} 
                        update={updateField}
                    />
                    
                    {/* Specs Placeholder (Next Phase) */}
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 border-dashed">
                        Specs Module Coming in Phase 3...
                    </div>
                </div>
            </div>
        </div>
    );
}
