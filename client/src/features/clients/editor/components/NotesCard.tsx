import React from 'react';
import { FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';

interface Props {
  data: ClientEntity;
  update: (field: keyof ClientEntity, val: any) => void;
}

export const NotesCard: React.FC<Props> = ({ data, update }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-slate-400" /> Notes
        </h3>
        {/* 评分箭头移到这里，解决对齐难题 */}
        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
          <button
            onClick={() => update('rating', data.rating === 1 ? 0 : 1)}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${data.rating === 1 ? 'bg-white shadow-sm text-yellow-400' : 'text-slate-300 hover:text-yellow-400 hover:bg-slate-100'}`}
          >
            <ChevronUp size={14} strokeWidth={3} />
          </button>
          <div className="w-px h-3 bg-slate-200 mx-0.5" />
          <button
            onClick={() => update('rating', data.rating === -1 ? 0 : -1)}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${data.rating === -1 ? 'bg-white shadow-sm text-red-500' : 'text-slate-300 hover:text-red-500 hover:bg-slate-100'}`}
          >
            <ChevronDown size={14} strokeWidth={3} />
          </button>
        </div>
      </div>
      <textarea
        className="w-full h-24 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-medium resize-none outline-none focus:border-blue-200 transition-colors"
        value={data.notes}
        onChange={(e) => update('notes', e.target.value)}
        placeholder="Add notes here..."
      />
    </div>
  );
};
