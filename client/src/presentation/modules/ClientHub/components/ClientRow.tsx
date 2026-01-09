import React from 'react';
import { Calendar, Truck, Star, Trash2, Wallet } from 'lucide-react';
import { ClientEntity } from '../../../../domain/client/client.types';
import { calculateFinancials } from '../../../../domain/client/client.logic';
import { formatMoney } from '../../../../utils';

interface Props {
    client: ClientEntity;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const ClientRow: React.FC<Props> = ({ client, onSelect, onDelete }) => {
    const financials = calculateFinancials(client);
    
    const isDelivered = client.status === 'Delivered';
    const isPaid = client.status === 'Deposit Paid';
    const statusColor = isDelivered ? 'bg-emerald-100 text-emerald-700' : (isPaid ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600');

    return (
        <div onClick={onSelect} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors items-center group">
            <div className="md:col-span-3">
                <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                    {client.wechatName || 'Unnamed Client'}
                    {client.rating === 1 && <Star size={10} className="text-yellow-400 fill-yellow-400"/>}
                    {client.rating === -1 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" />}
                </div>
            </div>
            
            <div className="hidden md:block md:col-span-2">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${statusColor}`}>
                    {client.status}
                </span>
            </div>
            
            <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400">
                <Calendar size={12} className="text-slate-300"/>{client.orderDate ? client.orderDate.split('T')[0] : '-'}
            </div>
            <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400">
                <Truck size={12} className="text-slate-300"/>{client.deliveryDate ? client.deliveryDate.split('T')[0] : '-'}
            </div>
            
            <div className="hidden md:block md:col-span-3">
                <div className="flex items-center justify-end h-full">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-300 uppercase">Total</span>
                            <span className="text-xs font-bold text-slate-600 font-mono">{formatMoney(client.totalPrice)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-300 uppercase">Profit</span>
                            <span className="text-xs font-bold text-emerald-600 font-mono">{formatMoney(financials.profit)}</span>
                        </div>
                        {financials.balanceDue > 0 ? (
                            <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md">
                                <span className="text-[9px] font-bold text-blue-400 uppercase flex items-center gap-1">Due</span>
                                <span className="text-xs font-black text-blue-600 font-mono">{formatMoney(financials.balanceDue)}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 opacity-20">
                                <span className="text-[9px] font-bold text-slate-300 uppercase">Due</span>
                                <span className="text-xs font-bold text-slate-400">$0.00</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-3" title="Delete"><Trash2 size={16}/></button>
                </div>
            </div>
        </div>
    );
};
