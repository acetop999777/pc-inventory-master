import React from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useReceiptsQuery, receiptsQueryKey } from '../../app/queries/receipts';
import { apiCallOrThrow } from '../../utils';
import { useAlert, useConfirm } from '../../app/confirm/ConfirmProvider';

function formatDate(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function toDateStart(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateEnd(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function ReceiptsList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const alert = useAlert();
  const { data = [] } = useReceiptsQuery(100);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const filtered = React.useMemo(() => {
    const start = toDateStart(startDate);
    const end = toDateEnd(endDate);
    return data.filter((r) => {
      const d = new Date(r.receivedAt);
      if (Number.isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  const totalAmount = React.useMemo(
    () => filtered.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
    [filtered],
  );

  const deleteReceipt = async (id: number, label: string) => {
    const ok = await confirmDialog({
      title: 'Delete Receipt',
      message: `Delete receipt ${label}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await apiCallOrThrow(`/inbound/receipts/${id}`, 'DELETE');
      qc.setQueryData<any>([...receiptsQueryKey, 100], (old = []) =>
        Array.isArray(old) ? old.filter((r: any) => r.id !== id) : old,
      );
    } catch (err: any) {
      await alert({
        title: 'Delete Failed',
        message: err?.userMessage || 'Failed to delete receipt.',
      });
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Inbound</div>
          <h1 className="text-2xl font-black text-slate-900">Receipts</h1>
        </div>
        <button
          onClick={() => nav('/inbound/receipts/new')}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition text-[11px] font-black uppercase tracking-wider"
        >
          New Receipt
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Start Date
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                End Date
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Amount
            </div>
            <div className="text-2xl font-black text-slate-900">{formatMoney(totalAmount)}</div>
            <div className="text-[11px] font-bold text-slate-400">{filtered.length} receipts</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 items-center gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-2">Date</div>
          <div className="col-span-3">Vendor</div>
          <div className="col-span-2">Mode</div>
          <div className="col-span-2">Notes</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1" />
        </div>
        {filtered.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => nav(`/inbound/receipts/${r.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') nav(`/inbound/receipts/${r.id}`);
            }}
            className="w-full grid grid-cols-12 items-center gap-4 px-5 py-3 border-b border-slate-100 text-left hover:bg-slate-50/70 cursor-pointer"
          >
            <div className="col-span-2 text-xs font-bold text-slate-700">
              {formatDate(r.receivedAt)}
            </div>
            <div className="col-span-3 text-xs font-bold text-slate-700 truncate">
              {r.vendor || '-'}
            </div>
            <div className="col-span-2 text-[11px] font-black text-slate-400 uppercase">
              {r.mode}
            </div>
            <div className="col-span-2 text-xs text-slate-500 truncate">{r.notes || ''}</div>
            <div className="col-span-2 text-xs font-mono text-slate-700 text-right">
              {formatMoney(r.totalAmount || 0)}
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteReceipt(r.id, formatDate(r.receivedAt) || String(r.id));
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs font-bold">No receipts yet</div>
        ) : null}
      </div>
    </div>
  );
}
