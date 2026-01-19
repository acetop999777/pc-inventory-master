import React from 'react';
import type { ClientDetailPageProps } from './types';
import { IdentityCard, LogisticsCard, FinancialsCard, NotesCard, SpecsTable } from './editor';

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
      const prev = Array.isArray((activeClient as any).photos) ? (activeClient as any).photos : [];
      const next = prev.filter((_: any, i: number) => i !== idx);
      onUpdateField('photos' as any, next);
    },
    [activeClient, onUpdateField],
  );

  const onFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const prev = Array.isArray((activeClient as any).photos) ? (activeClient as any).photos : [];
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
        onUpdateField('photos' as any, [...prev, ...encoded]);
      }

      e.target.value = '';
    },
    [activeClient, onUpdateField],
  );

  const title = (activeClient as any).wechatName || 'Client';

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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header: keep clean; global SyncStatusPill already exists */}
        <div className="flex items-center justify-between mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left */}
          <div className="lg:col-span-5 space-y-6">
            <IdentityCard
              data={activeClient as any}
              update={onUpdateField as any}
              onPhotoUpload={onPhotoUpload}
              onPhotoRemove={onPhotoRemove}
            />
            <LogisticsCard
              data={activeClient as any}
              update={onUpdateField as any}
              statusOptions={statusSteps}
            />
            <NotesCard data={activeClient as any} update={onUpdateField as any} />
          </div>

          {/* Right */}
          <div className="lg:col-span-7 space-y-6">
            <FinancialsCard
              data={activeClient as any}
              update={onUpdateField as any}
              financials={financials as any}
            />
            <SpecsTable
              data={activeClient as any}
              update={onUpdateField as any}
              inventory={inventory as any}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
