import React, { useRef } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';

import { ClientEntity } from '../../domain/client/client.types';
import { InventoryItem } from '../../types';

import { IdentityCard, LogisticsCard, FinancialsCard, NotesCard, SpecsTable } from './editor';

type Props = {
  activeClient: ClientEntity;
  inventory: InventoryItem[];
  financials: any;

  statusSteps: string[];

  busy: boolean;
  hasError: boolean;
  flashSaved: boolean;

  onBack: () => void;
  onRetry: () => void;
  onUpdateField: (field: keyof ClientEntity, val: any) => void;
};

export function ClientDetailPage(props: Props) {
  const {
    activeClient,
    inventory,
    financials,
    statusSteps,
    busy,
    hasError,
    flashSaved,
    onBack,
    onRetry,
    onUpdateField,
  } = props;

  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen pb-40 animate-in slide-in-from-right duration-300">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-800 transition-colors"
            title={busy ? 'Syncing before leaving…' : hasError ? 'Sync failed' : 'Back'}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <span className="font-black text-lg text-slate-800">
            {activeClient.wechatName || 'New Client'}
          </span>
        </div>

        {(busy || hasError || flashSaved) && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {hasError ? (
              <>
                <AlertTriangle size={12} className="text-amber-600" />
                <span className="text-amber-700">Needs Sync</span>
                <button
                  onClick={onRetry}
                  className="ml-2 px-2 py-1 rounded-full bg-white border border-amber-200 hover:bg-amber-50 text-amber-700"
                  title="Retry"
                >
                  Retry
                </button>
              </>
            ) : busy ? (
              <>
                <Loader2 size={12} className="animate-spin text-blue-500" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-emerald-700">Saved</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-4 space-y-6">
          <IdentityCard
            data={activeClient}
            update={onUpdateField}
            onPhotoUpload={() => fileRef.current?.click()}
            onPhotoRemove={() => {}}
          />
          <LogisticsCard data={activeClient} update={onUpdateField} statusOptions={statusSteps} />
          <NotesCard data={activeClient} update={onUpdateField} />
          <input type="file" multiple hidden ref={fileRef} accept="image/*" onChange={() => {}} />
        </div>

        <div className="col-span-12 xl:col-span-8 space-y-6">
          <FinancialsCard data={activeClient} financials={financials} update={onUpdateField} />
          <SpecsTable data={activeClient} inventory={inventory} update={onUpdateField} onCalculate={() => {}} />
        </div>
      </div>
    </div>
  );
}
