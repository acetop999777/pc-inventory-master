import React from 'react';
import { DollarSign, Wallet, HandCoins } from 'lucide-react';
import { ClientEntity, ClientFinancials } from '../../../../domain/client/client.types';
import type { UpdateClientField } from '../../types';
import { FinancialCard } from '../../../../shared/ui/FinancialCard';
import { formatMoney } from '../../../../shared/lib/format';

interface Props {
  data: ClientEntity;
  financials: ClientFinancials;
  update: UpdateClientField;
}

function parseMoney(raw: string, fallback: number): number {
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  // allow "45." while typing; finalize on blur only
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

export const FinancialsCard: React.FC<Props> = ({ data, financials, update }) => {
  const [totalText, setTotalText] = React.useState<string>(
    data.totalPrice == null ? '' : String(data.totalPrice),
  );
  const [paidText, setPaidText] = React.useState<string>(
    data.paidAmount == null ? '' : String(data.paidAmount),
  );

  const focusRef = React.useRef<'total' | 'paid' | null>(null);

  React.useEffect(() => {
    if (focusRef.current !== 'total') {
      setTotalText(data.totalPrice == null ? '' : String(data.totalPrice));
    }
  }, [data.totalPrice]);

  React.useEffect(() => {
    if (focusRef.current !== 'paid') {
      setPaidText(data.paidAmount == null ? '' : String(data.paidAmount));
    }
  }, [data.paidAmount]);

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
            value={totalText}
            inputMode="decimal"
            placeholder="0.00"
            onFocus={(e) => {
              focusRef.current = 'total';
              e.currentTarget.select();
            }}
            onBlur={() => {
              focusRef.current = null;
              update('totalPrice', parseMoney(totalText, Number(data.totalPrice ?? 0)));
            }}
            onChange={(e) => setTotalText(e.target.value)}
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
            value={paidText}
            inputMode="decimal"
            placeholder="0.00"
            onFocus={(e) => {
              focusRef.current = 'paid';
              e.currentTarget.select();
            }}
            onBlur={() => {
              focusRef.current = null;
              update('paidAmount', parseMoney(paidText, Number(data.paidAmount ?? 0)));
            }}
            onChange={(e) => setPaidText(e.target.value)}
          />
        </div>
      </div>

      <FinancialCard
        label="Balance Due"
        amount={formatMoney(financials.balanceDue)}
        icon={Wallet}
        variant={Number(financials.balanceDue ?? 0) > 0 ? 'blue' : 'slate'}
      />

      <FinancialCard
        label="Profit"
        amount={formatMoney(financials.profit)}
        variant={Number(financials.profit ?? 0) >= 0 ? 'green' : 'slate'}
      />
    </div>
  );
};
