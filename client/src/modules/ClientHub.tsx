import React, { useState } from 'react';
import { Search, Plus, Calendar, Truck, Star, Trash2 } from 'lucide-react';
import {
  generateId,
  CORE_CATS,
  STATUS_STEPS,
  formatMoney,
  apiCallOrThrow,
  ApiCallError,
} from '../utils';
import { AppData, Client } from '../types';
import ClientEditor from './ClientEditor';

interface Props {
  data: AppData;
  refresh: () => void;
  notify: (msg: string, type?: string) => void;
  log: (type: string, title: string, msg: string) => void;
}

export default function ClientHub({ data, refresh, notify, log: _log }: Props) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [active, setActive] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const filtered = (data.clients || []).filter((c) =>
    JSON.stringify(c).toLowerCase().includes(search.toLowerCase()),
  );

  const handleNew = () => {
    const initSpecs: any = {};
    CORE_CATS.forEach((c) => {
      initSpecs[c] = { name: '', sku: '', cost: 0, qty: 1 };
    });

    const newClient: Client = {
      id: generateId(),
      wechatName: 'New Client',
      wechatId: '',
      realName: '',
      xhsName: '',
      xhsId: '',
      isShipping: false,
      trackingNumber: '',
      pcppLink: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      status: STATUS_STEPS[0],
      orderDate: new Date().toISOString().split('T')[0],
      depositDate: '',
      deliveryDate: '',
      totalPrice: 0,
      actualCost: 0,
      profit: 0,
      paidAmount: 0,
      specs: initSpecs,
      photos: [],
      rating: 0,
      notes: '',
    };
    setActive(newClient);
    setView('detail');
  };

  const handleSave = async (finalClient: Client, cost: number, profit: number) => {
    try {
      await apiCallOrThrow('/clients', 'POST', {
        ...finalClient,
        actualCost: cost,
        profit: profit,
      });
      refresh();
    } catch (e) {
      if (e instanceof ApiCallError) {
        const rid = e.requestId ? ` (id: ${e.requestId})` : '';
        notify(`${e.userMessage}${rid}`, 'error');
      } else notify('Save failed', 'error');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to DELETE client: ${name}?`)) return;
    try {
      await apiCallOrThrow(`/clients/${id}`, 'DELETE');
      notify('Client deleted');
      refresh();
    } catch (error) {
      if (error instanceof ApiCallError) {
        const rid = error.requestId ? ` (id: ${error.requestId})` : '';
        notify(`${error.userMessage}${rid}`, 'error');
      } else notify('Delete failed', 'error');
    }
  };

  if (view === 'detail' && active) {
    return (
      <ClientEditor
        client={active}
        inventory={data.inv}
        onUpdate={setActive}
        onSave={handleSave}
        onBack={() => setView('list')}
        notify={notify}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[95rem] mx-auto pb-32">
      <div className="flex gap-4 mb-6 items-center">
        <div className="flex-1 bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-2">
          <Search size={16} className="ml-2 text-slate-400" />
          <input
            className="w-full text-xs font-bold outline-none"
            placeholder="Search Clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={handleNew}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center">
          <div className="col-span-3">Client (WeChat)</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Order Date</div>
          <div className="col-span-2">Delivery Date</div>
          <div className="col-span-3 text-right">Financials</div>
        </div>

        {filtered.map((c) => {
          const isDelivered = c.status === 'Delivered';
          const isPaid = c.status === 'Deposit Paid';
          const statusColor = isDelivered
            ? 'bg-emerald-100 text-emerald-700'
            : isPaid
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600';

          const balanceDue = (c.totalPrice || 0) - (c.paidAmount || 0);
          const hasBalance = balanceDue > 0;

          return (
            <div
              key={c.id}
              onClick={() => {
                setActive(c);
                setView('detail');
              }}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors items-center group"
            >
              {/* 1. Client Name */}
              <div className="md:col-span-3">
                <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {c.wechatName}
                  {c.rating === 1 && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
                  {c.rating === -1 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" />
                  )}
                </div>
                <div className="md:hidden text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded ${statusColor}`}>{c.status}</span>
                  <span className="font-mono text-emerald-600 font-bold">
                    {formatMoney(c.profit)}
                  </span>
                </div>
              </div>

              {/* 2. Status */}
              <div className="hidden md:block md:col-span-2">
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${statusColor}`}
                >
                  {c.status}
                </span>
              </div>

              {/* 3. Dates */}
              <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400">
                <Calendar size={12} className="text-slate-300" />
                {c.orderDate ? c.orderDate.split('T')[0] : '-'}
              </div>
              <div className="hidden md:flex md:col-span-2 items-center gap-2 text-xs font-mono text-slate-400">
                <Truck size={12} className="text-slate-300" />
                {c.deliveryDate ? c.deliveryDate.split('T')[0] : '-'}
              </div>

              {/* 4. Financials (修复：强制单行显示) */}
              <div className="hidden md:block md:col-span-3">
                <div className="flex items-center justify-end h-full">
                  {/* 容器：gap-4 隔开每个指标，items-center 垂直居中 */}
                  <div className="flex items-center gap-4">
                    {/* Total */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-300 uppercase">Total</span>
                      <span className="text-xs font-bold text-slate-600 font-mono">
                        {formatMoney(c.totalPrice)}
                      </span>
                    </div>

                    {/* Profit */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-300 uppercase">Profit</span>
                      <span className="text-xs font-bold text-emerald-600 font-mono">
                        {formatMoney(c.profit)}
                      </span>
                    </div>

                    {/* Due (Blue) */}
                    {hasBalance ? (
                      <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md">
                        <span className="text-[9px] font-bold text-blue-400 uppercase flex items-center gap-1">
                          Due
                        </span>
                        <span className="text-xs font-black text-blue-600 font-mono">
                          {formatMoney(balanceDue)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 opacity-20">
                        <span className="text-[9px] font-bold text-slate-300 uppercase">Due</span>
                        <span className="text-xs font-bold text-slate-400">$0.00</span>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(e, c.id, c.wechatName || 'Client')}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-3"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase italic">
            No clients found
          </div>
        )}
      </div>
    </div>
  );
}
