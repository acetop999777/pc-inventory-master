import React from 'react';
import { Calendar, Truck, Phone } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { CompactInput } from '../../../../presentation/components/ui/CompactInput';

interface Props {
  data: ClientEntity;
  update: (field: keyof ClientEntity, val: any) => void;
  statusOptions: readonly string[];
}

export const LogisticsCard: React.FC<Props> = ({ data, update, statusOptions }) => {
  const currentStatus = data.status || (statusOptions[0] ?? '');

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
      <h3 className="font-black uppercase text-xs mb-6 text-slate-400 tracking-widest flex items-center gap-2">
        <Calendar size={14} /> Workflow Status
      </h3>

      <div className="flex justify-between items-center relative mb-8 px-2">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10" />
        {statusOptions.map((s, i) => {
          const activeIdx = Math.max(0, statusOptions.indexOf(currentStatus));
          const filled = i <= activeIdx;
          return (
            <div
              key={s}
              onClick={() => update('status', s)}
              className="group flex flex-col items-center gap-2 cursor-pointer"
            >
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  filled ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-300'
                }`}
              />
              <span
                className={`text-[8px] font-bold uppercase transition-colors ${
                  currentStatus === s ? 'text-blue-600' : 'text-slate-300'
                }`}
              >
                {s.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <CompactInput
            type="date"
            label="Order Date"
            value={data.orderDate ? data.orderDate.split('T')[0] : ''}
            onChange={(e) => update('orderDate', e.target.value)}
          />
          <CompactInput
            type="date"
            label="Delivery Date"
            value={data.deliveryDate ? data.deliveryDate.split('T')[0] : ''}
            onChange={(e) => update('deliveryDate', e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-slate-50">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <CompactInput label="City" value={data.city} onChange={(e) => update('city', e.target.value)} />
            <CompactInput label="State" value={data.state} onChange={(e) => update('state', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <CompactInput label="Zip Code" value={data.zip} onChange={(e) => update('zip', e.target.value)} />
            <CompactInput
              label="Phone"
              icon={Phone}
              value={(data as any).phone ?? ''}
              onChange={(e) => update('phone' as keyof ClientEntity, e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => update('isShipping', !data.isShipping)}>
            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${data.isShipping ? 'bg-blue-600' : 'bg-slate-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${data.isShipping ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <Truck size={12} /> Shipping Required
            </span>
          </div>

          {data.isShipping && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              <CompactInput label="Address" value={data.address} onChange={(e) => update('address', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <CompactInput label="Tracking" value={data.trackingNumber} onChange={(e) => update('trackingNumber', e.target.value)} />
                <CompactInput label="Zip+4 (opt)" value={(data as any).zip4 ?? ''} onChange={(e) => update('zip' as keyof ClientEntity, e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
