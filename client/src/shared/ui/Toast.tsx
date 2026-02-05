import React from 'react';

type ToastTone = 'default' | 'success' | 'warning' | 'danger';

type ToastOptions = {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastRecord = ToastOptions & { id: string };

type ToastFn = (opts: ToastOptions) => void;

const ToastContext = React.createContext<ToastFn | null>(null);

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function useToast(): ToastFn {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = React.useCallback<ToastFn>(
    (opts) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const toast: ToastRecord = {
        id,
        tone: 'default',
        durationMs: 3200,
        ...opts,
      };
      setToasts((prev) => [...prev, toast]);

      if (toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => remove(id), toast.durationMs);
      }
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-[90] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const tone = toast.tone ?? 'default';
  const styles: Record<ToastTone, string> = {
    default: 'bg-white border-slate-200 text-slate-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-rose-50 border-rose-200 text-rose-800',
  };

  return (
    <div
      className={cx(
        'rounded-2xl border shadow-lg px-4 py-3 text-sm font-semibold',
        styles[tone],
      )}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {toast.title ? (
            <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
              {toast.title}
            </div>
          ) : null}
          <div className="mt-1 text-[13px] leading-snug">{toast.message}</div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-[11px] font-black uppercase tracking-widest opacity-50 hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
