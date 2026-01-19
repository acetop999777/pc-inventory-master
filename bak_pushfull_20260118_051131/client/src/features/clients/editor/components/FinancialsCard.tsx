import React from 'react';
import { DollarSign, Wallet, HandCoins } from 'lucide-react';
import { ClientEntity, ClientFinancials } from '../../../../domain/client/client.types';
import { FinancialCard } from '../../../../presentation/components/ui/FinancialCard';
import { formatMoney } from '../../../../utils';

interface Props {
  data: ClientEntity;
  financials: ClientFinancials;
  update: (field: keyof ClientEntity, val: any) => void;
}

export const FinancialsCard: React.FC<Props> = ({ data, financials, update }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
          <DollarSign size={12} /> Total Sale
        </span>
        <div className="flex items-center">
          <span className="text-xl font-black mr-1 text-slate-400">$</span>
          <input
            className="text-xl font-black text-slate-800 bg-transparent outline-none w-full"
            value={data.totalPrice || ''}
            onChange={(e) => update('totalPrice', parseFloat(e.target.value))}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between h-24">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 flex items-center gap-1">
          <HandCoins size={12} /> Paid
        </span>
        <div className="flex items-center">
          <span className="text-xl font-black mr-1 text-blue-300">$</span>
          <input
            className="text-xl font-black text-blue-700 bg-transparent outline-none w-full"
            value={data.paidAmount || ''}
            onChange={(e) => update('paidAmount', parseFloat(e.target.value))}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* ✅ swap: Profit goes before Balance Due */}
      <FinancialCard
        label="Profit"
        amount={formatMoney(financials.profit)}
        variant={financials.profit >= 0 ? 'green' : 'slate'}
      />

      <FinancialCard
        label="Balance Due"
        amount={formatMoney(financials.balanceDue)}
        icon={Wallet}
        variant={financials.balanceDue > 0 ? 'blue' : 'slate'}
      />
    </div>
  );
};
