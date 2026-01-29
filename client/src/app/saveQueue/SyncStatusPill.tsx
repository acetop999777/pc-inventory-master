import React, { useSyncExternalStore } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, X, Copy } from 'lucide-react';
import { useSaveQueue } from './SaveQueueProvider';

function safeStringify(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    try {
      return String(v);
    } catch {
      return '[unserializable]';
    }
  }
}

function normalizeErr(e: any) {
  const kind = e?.name || e?.kind || 'ERROR';
  const status = e?.status ?? e?.httpStatus ?? undefined;
  const code = e?.code ?? undefined;
  const requestId = e?.requestId ?? e?.error?.requestId ?? undefined;
  const retryable =
    typeof e?.retryable === 'boolean'
      ? e.retryable
      : typeof e?.retriable === 'boolean'
        ? e.retriable
        : undefined;

  const message = e?.userMessage ?? e?.message ?? (typeof e === 'string' ? e : '') ?? '';

  const details = e?.details ?? e?.error?.details ?? undefined;

  return { kind, status, code, requestId, retryable, message, details, raw: e };
}

export function SyncStatusPill() {
  const { queue } = useSaveQueue();

  const snap = useSyncExternalStore(
    queue.subscribe,
    () => queue.getSnapshot(),
    () => queue.getSnapshot(),
  );

  const busy = snap.pendingCount + snap.inFlightCount > 0;
  const hasError = snap.errorCount > 0;

  const errorKeys = snap.keys.filter((k) => k.hasError);
  const topErrRaw: any = (errorKeys[0]?.lastError as any) ?? null;
  const topErr = normalizeErr(topErrRaw);

  const errorTitle = (() => {
    if (!hasError) return '';
    const head = [
      topErr.kind ? String(topErr.kind) : 'ERROR',
      topErr.status ? String(topErr.status) : null,
      topErr.code ? String(topErr.code) : null,
      topErr.requestId ? `rid:${String(topErr.requestId)}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    const body = topErr.message ? `: ${topErr.message}` : '';
    return (head + body).slice(0, 240);
  })();
  const anyRetriable = errorKeys.some((k) => {
    const e: any = k.lastError as any;
    const v = typeof e?.retryable === 'boolean' ? e.retryable : e?.retriable;
    return v !== false; // default true
  });

  const canRetry = hasError && !busy && anyRetriable;
  const failureCount = errorKeys.length;

  const [showSaved, setShowSaved] = React.useState(false);
  const prevBusyRef = React.useRef(false);
  const tRef = React.useRef<any>(null);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const prevBusy = prevBusyRef.current;
    prevBusyRef.current = busy;

    // busy -> idle：短暂显示 Saved
    if (prevBusy && !busy && !hasError) {
      setShowSaved(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setShowSaved(false), 900);
      return;
    }

    // 有错误：不显示 Saved
    if (hasError) setShowSaved(false);

    // idle 且无错误：不显示任何东西
    if (!busy && !hasError) setShowSaved(false);
  }, [busy, hasError]);

  // ✅ idle 时不渲染（彻底去掉“常驻状态条”）
  if (!busy && !hasError && !showSaved) return null;

  const retryAll = () => {
    void queue.flushAll({ timeoutMs: 8000 });
  };

  const detailsPayload = {
    summary: {
      kind: topErr.kind,
      status: topErr.status,
      code: topErr.code,
      requestId: topErr.requestId,
      retryable: topErr.retryable,
      message: topErr.message,
    },
    details: topErr.details,
    raw: topErr.raw,
  };

  const detailsText = safeStringify(detailsPayload);

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(detailsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return '';
    }
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[999]">
        <div
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm',
            'text-[10px] font-black uppercase tracking-wider',
            hasError
              ? 'bg-red-50 border-red-200 text-red-700'
              : busy
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700',
          ].join(' ')}
          title={hasError ? errorTitle : undefined}
        >
          {hasError ? (
            <>
              <AlertTriangle size={14} />
              <span>Needs Sync ({failureCount})</span>

              {canRetry ? (
                <button
                  onClick={retryAll}
                  className="ml-2 px-2 py-1 rounded-full bg-white border border-red-200 hover:bg-red-50"
                  title="Apply pending changes"
                >
                  Fix & retry
                </button>
              ) : (
                <span className="ml-2 px-2 py-1 rounded-full bg-white border border-red-200">
                  Fix inputs
                </span>
              )}

              <button
                onClick={() => setDetailsOpen(true)}
                className="ml-2 px-2 py-1 rounded-full bg-white border border-red-200 hover:bg-red-50"
                title="Show error details"
              >
                Details
              </button>
            </>
          ) : busy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {hasError ? (
        <div className="fixed top-16 right-4 z-[998] w-[420px] max-w-[90vw]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Sync Errors • {failureCount}
            </div>
            <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100">
              {errorKeys.map((k) => {
                const err = normalizeErr(k.lastError as any);
                const retryable =
                  typeof err.retryable === 'boolean' ? err.retryable : err.retryable == null;
                const label = k.label || k.key;
                const reqId = err.requestId ? String(err.requestId) : '';
                const code = err.code ? String(err.code) : 'ERROR';
                const message = err.message || 'Request failed';
                return (
                  <div key={k.key} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-black text-slate-700 truncate">
                        {label}
                      </div>
                      <div className="text-[10px] text-slate-400">{formatTime(k.updatedAt)}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600">{message}</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {code}
                      {reqId ? ` • rid:${reqId}` : ''}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {retryable ? (
                        <button
                          onClick={() => queue.retryKey(k.key)}
                          className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50"
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          Needs Fix
                        </span>
                      )}
                      <button
                        onClick={() => queue.dismissKey(k.key)}
                        className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {detailsOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-slate-900/40 flex items-center justify-center p-4"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="text-xs font-black uppercase tracking-widest text-slate-700">
                Save Error Details
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyDetails}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
                  title="Copy JSON"
                >
                  <Copy size={14} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setDetailsOpen(false)}
                  className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4">
              <pre className="text-[11px] leading-5 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-[70vh]">
                {detailsText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SyncStatusPill;
