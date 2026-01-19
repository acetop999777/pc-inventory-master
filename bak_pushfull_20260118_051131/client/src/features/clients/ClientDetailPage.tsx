import React from 'react';
import { ArrowLeft } from 'lucide-react';

import { ClientEntity } from '../../domain/client/client.types';
import { InventoryItem } from '../../types';
import { IdentityCard, LogisticsCard, FinancialsCard, NotesCard, SpecsTable } from './editor';

type Props = {
  activeClient: ClientEntity;
  inventory: InventoryItem[];
  financials: any; // keep flexible; FinancialsCard expects ClientFinancials
  statusSteps: readonly string[];
  busy: boolean;
  hasError: boolean;
  flashSaved: boolean;
  onRetry: () => void;
  onUpdateField: (field: keyof ClientEntity, val: any) => void;
  onBack: () => void;
};

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
}: Props) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const onPhotoUpload = React.useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onPhotoRemove = React.useCallback(
    (idx: number) => {
      const prev = Array.isArray(activeClient.photos) ? activeClient.photos : [];
      const next = prev.filter((_, i) => i !== idx);
      onUpdateField('photos', next);
    },
    [activeClient.photos, onUpdateField]
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

      if (encoded.length > 0) onUpdateField('photos', [...prev, ...encoded]);
      e.target.value = '';
    },
    [activeClient.photos, onUpdateField]
  );

  const fin = React.useMemo(() => {
    const bd = Number(financials?.balanceDue ?? 0);
    return { ...(financials ?? {}), isPaidOff: bd <= 0 };
  }, [financials]);

  return (
    <div className="min-h-screen bg-slate-50">
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />

      <div className="max-w-7xl mx-auto px-5 py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-[11px] font-black uppercase tracking-wider"
            title="Back"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[60%] text-right">
            {activeClient.wechatName || 'New Client'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            <IdentityCard
              data={activeClient}
              update={onUpdateField}
              onPhotoUpload={onPhotoUpload}
              onPhotoRemove={onPhotoRemove}
            />
            <LogisticsCard data={activeClient} update={onUpdateField} statusOptions={statusSteps} />
            <NotesCard data={activeClient} update={onUpdateField} />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-6">
            <FinancialsCard data={activeClient} update={onUpdateField} financials={fin} />
            <SpecsTable data={activeClient} update={onUpdateField} inventory={inventory} />
          </div>
        </div>
      </div>
    </div>
  );
}
