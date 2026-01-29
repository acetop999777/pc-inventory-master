import React from 'react';
import { Calendar, Truck } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { CompactInput } from '../../../../presentation/components/ui/CompactInput';

type Props = {
  data: ClientEntity;
  update: (field: keyof ClientEntity, val: any) => void;

  // accept both names to avoid future prop-drift
  statusOptions?: readonly string[];
  statusSteps?: readonly string[];
};

function normalizeOptions(statusOptions?: readonly string[], statusSteps?: readonly string[]) {
  const opts = (statusOptions ?? statusSteps ?? []) as readonly string[];
  return opts.length ? opts : (['Pending', 'In Progress', 'Ready', 'Delivered'] as const);
}

export const LogisticsCard: React.FC<Props> = ({ data, update, statusOptions, statusSteps }) => {
  const options = normalizeOptions(statusOptions, statusSteps);
  const currentIndex = Math.max(0, options.indexOf((data as any).status || options[0]));

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100">
      <h3 className="font-black uppercase text-xs mb-6 text-slate-400 tracking-widest flex items-center gap-2">
        <Calendar size={14} />
        Workflow Status
      </h3>

      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        {options.map((s) => {
          const active = (data as any).status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => update('status' as keyof ClientEntity, s)}
              className={[
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition',
                active
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200',
              ].join(' ')}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="hidden md:flex justify-between items-center relative mb-6">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10" />
        {options.map((s, i) => (
          <div
            key={s}
            onClick={() => update('status' as keyof ClientEntity, s)}
            className="group flex flex-col items-center gap-2 cursor-pointer"
          >
            <div
              className={[
                'w-4 h-4 rounded-full border-2 transition-all',
                i <= currentIndex
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-slate-300 group-hover:border-blue-300',
              ].join(' ')}
            />
            <span
              className={[
                'text-[8px] font-bold uppercase transition-colors',
                (data as any).status === s ? 'text-blue-600' : 'text-slate-300',
              ].join(' ')}
            >
              {String(s).split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CompactInput
            type="date"
            label="Order Date"
            value={(data as any).orderDate ? String((data as any).orderDate).split('T')[0] : ''}
            onChange={(e) => update('orderDate' as keyof ClientEntity, e.target.value)}
          />
          <CompactInput
            type="date"
            label="Delivery Date"
            value={
              (data as any).deliveryDate ? String((data as any).deliveryDate).split('T')[0] : ''
            }
            onChange={(e) => update('deliveryDate' as keyof ClientEntity, e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CompactInput
            label="City"
            value={(data as any).city || ''}
            onChange={(e) => update('city' as keyof ClientEntity, e.target.value)}
          />
          <CompactInput
            label="Zip"
            value={(data as any).zip || ''}
            onChange={(e) => update('zip' as keyof ClientEntity, e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-slate-50">
          <div
            className="flex items-center gap-2 mb-3 cursor-pointer"
            onClick={() => update('isShipping' as keyof ClientEntity, !(data as any).isShipping)}
          >
            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${(data as any).isShipping ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${(data as any).isShipping ? 'translate-x-4' : ''}`}
              />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <Truck size={12} /> Shipping Required
            </span>
          </div>

          {(data as any).isShipping && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              <CompactInput
                label="Address"
                value={(data as any).address || ''}
                onChange={(e) => update('address' as keyof ClientEntity, e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CompactInput
                  label="State"
                  value={(data as any).state || ''}
                  onChange={(e) => update('state' as keyof ClientEntity, e.target.value)}
                />
                <CompactInput
                  label="Phone"
                  value={(data as any).phone || ''}
                  onChange={(e) => update('phone' as keyof ClientEntity, e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
