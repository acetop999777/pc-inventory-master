import React from 'react';
import { Calendar, Trash2 } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { calculateFinancials } from '../../../../domain/client/client.logic';
import { formatMoney, formatDate } from '../../../../utils';

interface Props {
  client: ClientEntity;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const ClientRow: React.FC<Props> = ({ client, onSelect, onDelete }) => {
  const financials = calculateFinancials(client);
  const due = Number(financials.balanceDue ?? 0);
  const profit = Number(financials.profit ?? 0);

  const profitPill =
    profit >= 0 ? (
      <span className="px-2 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
        {formatMoney(profit)}
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100">
        {formatMoney(profit)}
      </span>
    );

  return (
    <div
      className="grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-slate-50 cursor-pointer group"
      onClick={onSelect}
    >
      {/* Name */}
      <div className="col-span-5 md:col-span-4">
        <div className="font-black text-slate-800 truncate">
          {(client as any).wechatName || 'Unnamed'}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {(client as any).realName || ''}
        </div>
      </div>

      {/* Date */}
      <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400">
        <Calendar size={12} className="text-slate-300" />
        {formatDate((client as any).orderDate)}
      </div>

      {/* Total / Due / Profit */}
      <div className="col-span-6 md:col-span-5 flex items-center gap-2 justify-end">
        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-slate-50 text-slate-700 border border-slate-100">
          {formatMoney((client as any).totalPrice)}
        </span>

        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-white text-slate-600 border border-slate-200">
          {formatMoney(due)}
        </span>

        {profitPill}
      </div>

      {/* Delete */}
      <div className="col-span-1 flex justify-end">
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
