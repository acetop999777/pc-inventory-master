import React from 'react';
import type { ClientDetailPageProps } from './types';
import { IdentityCard, LogisticsCard, FinancialsCard, NotesCard, SpecsTable } from './editor';
import { formatMoney } from '../../shared/lib/format';

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export function ClientDetailPage({
  activeClient,
  inventory,
  financials,
  statusSteps,
  onUpdateField,
  onBack,
}: ClientDetailPageProps) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const onPhotoUpload = React.useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onPhotoRemove = React.useCallback(
    (idx: number) => {
      const prev = Array.isArray(activeClient.photos) ? activeClient.photos : [];
      const next = prev.filter((_: string, i: number) => i !== idx);
      onUpdateField('photos', next);
    },
    [activeClient, onUpdateField],
  );

  const onFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const prev = Array.isArray(activeClient.photos) ? activeClient.photos : [];
      const picked = Array.from(files);

      const encoded: string[] = [];
      for (const f of picked) {
        try {
          if (!String(f.type || '').startsWith('image/')) continue;
          const url = await readFileAsDataUrl(f);
          if (url) encoded.push(url);
        } catch {
          // ignore single file failure
        }
      }

      if (encoded.length > 0) {
        onUpdateField('photos', [...prev, ...encoded]);
      }

      e.target.value = '';
    },
    [activeClient, onUpdateField],
  );

  const title = activeClient.wechatName || 'Client';
  const statusLabel = String(activeClient.status || 'Status').trim() || 'Status';
  const orderDate = String(activeClient.orderDate || '').split('T')[0] || '—';
  const deliveryDate = String(activeClient.deliveryDate || '').split('T')[0] || '—';
  const profitValue = Number(financials.profit ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="md:hidden mb-6">
          <button
            onClick={onBack}
            className="h-9 px-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-wider"
          >
            Back
          </button>

          <div className="mt-4 relative overflow-hidden rounded-[28px] bg-slate-900 p-5 text-white shadow-xl">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Client
            </div>
            <div className="mt-1 text-2xl font-black tracking-tight">{title}</div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200">
                {statusLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-300">
                Order {orderDate}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-300">
                Delivery {deliveryDate}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                  Balance Due
                </div>
                <div className="mt-1 text-lg font-black">
                  {formatMoney(Number(financials.balanceDue ?? 0))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                  Profit
                </div>
                <div
                  className={[
                    'mt-1 text-lg font-black',
                    profitValue >= 0 ? 'text-emerald-300' : 'text-rose-300',
                  ].join(' ')}
                >
                  {formatMoney(profitValue)}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 -bottom-10 h-24 w-24 rounded-full bg-emerald-400/20 blur-3xl" />
          </div>
        </div>

        {/* Header: keep clean; global SyncStatusPill already exists */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="h-9 px-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-wider"
          >
            Back
          </button>

          <div className="text-sm font-black text-slate-800 truncate max-w-[65%]" title={title}>
            {title}
          </div>

          <div className="w-[44px]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left */}
          <div className="lg:col-span-5 space-y-4 md:space-y-6">
            <IdentityCard
              data={activeClient}
              update={onUpdateField}
              onPhotoUpload={onPhotoUpload}
              onPhotoRemove={onPhotoRemove}
            />
            <LogisticsCard
              data={activeClient}
              update={onUpdateField}
              statusOptions={statusSteps}
            />
            <NotesCard data={activeClient} update={onUpdateField} />
          </div>

          {/* Right */}
          <div className="lg:col-span-7 space-y-4 md:space-y-6">
            <FinancialsCard
              data={activeClient}
              update={onUpdateField}
              financials={financials}
            />
            <SpecsTable
              data={activeClient}
              update={onUpdateField}
              inventory={inventory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
