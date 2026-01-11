import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useSaveQueue } from './SaveQueueProvider';

export function SyncStatusPill() {
  const { snapshot } = useSaveQueue();
  const syncing = snapshot.pendingCount > 0 || snapshot.inFlightCount > 0;
  const hasError = snapshot.errorCount > 0;

  const label = hasError ? 'Needs sync' : syncing ? 'Syncing...' : 'Saved';

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border ${
        hasError
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : syncing
            ? 'bg-slate-50 text-slate-500 border-slate-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}>
        {hasError ? (
          <AlertTriangle size={12} className="text-amber-500" />
        ) : syncing ? (
          <Loader2 size={12} className="animate-spin text-blue-500" />
        ) : (
          <CheckCircle2 size={12} className="text-emerald-500" />
        )}
        {label}
      </div>
    </div>
  );
}
