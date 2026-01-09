import React from 'react';
import { Camera, X, ChevronUp, ChevronDown } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { CompactInput } from '../../../components/ui/CompactInput';

interface Props {
    data: ClientEntity;
    update: (field: keyof ClientEntity, val: any) => void;
    onPhotoUpload: () => void;
    onPhotoRemove: (idx: number) => void;
}

export const IdentityCard: React.FC<Props> = ({ data, update, onPhotoUpload, onPhotoRemove }) => {
    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="mb-6">
                {/* 紧凑对齐的标题栏 */}
                <div className="flex items-center gap-2 mb-4">
                    <input 
                        className="text-2xl font-black text-slate-800 bg-transparent outline-none w-auto max-w-[220px] placeholder:text-slate-300" 
                        placeholder="Client Name" 
                        value={data.wechatName} 
                        onChange={e => update('wechatName', e.target.value)} 
                    />
                    {/* 微型评分按钮 */}
                    <div className="flex items-center bg-slate-50 rounded p-0.5 border border-slate-100 shrink-0 h-5">
                        <button onClick={() => update('rating', data.rating === 1 ? 0 : 1)} className={`w-4 h-4 flex items-center justify-center rounded transition-all ${data.rating === 1 ? 'bg-white shadow-sm text-yellow-400' : 'text-slate-300 hover:text-yellow-400 hover:bg-slate-100'}`}><ChevronUp size={10} strokeWidth={3} /></button>
                        <div className="w-px h-2.5 bg-slate-200 mx-0.5" />
                        <button onClick={() => update('rating', data.rating === -1 ? 0 : -1)} className={`w-4 h-4 flex items-center justify-center rounded transition-all ${data.rating === -1 ? 'bg-white shadow-sm text-red-500' : 'text-slate-300 hover:text-red-500 hover:bg-slate-100'}`}><ChevronDown size={10} strokeWidth={3} /></button>
                    </div>
                </div>
                
                {/* 照片流 */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group" onClick={onPhotoUpload}>
                        <Camera size={20} className="text-slate-300 group-hover:text-slate-400"/>
                    </div>
                    {data.photos && data.photos.map((p, idx) => (
                        <div key={idx} className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 relative group border border-slate-100">
                            <img src={p} alt="" className="w-full h-full object-cover"/>
                            <button className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100" onClick={() => onPhotoRemove(idx)}><X size={8}/></button>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="space-y-1">
                <div className="grid grid-cols-2 gap-4">
                    <CompactInput label="WeChat ID" value={data.wechatId} onChange={e => update('wechatId', e.target.value)} />
                    <CompactInput label="Real Name" value={data.realName} onChange={e => update('realName', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <CompactInput label="XHS Name" value={data.xhsName} onChange={e => update('xhsName', e.target.value)} />
                    <CompactInput label="XHS ID" value={data.xhsId} onChange={e => update('xhsId', e.target.value)} />
                </div>
            </div>
        </div>
    );
};
