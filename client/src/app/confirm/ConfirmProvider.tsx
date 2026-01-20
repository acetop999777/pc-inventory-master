import React from 'react';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  tone?: 'default' | 'danger';
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function useAlert(): (opts: Omit<ConfirmOptions, 'cancelText' | 'tone'> & { title?: string }) => Promise<void> {
  const confirm = useConfirm();
  return React.useCallback(
    async (opts) => {
      await confirm({
        ...opts,
        cancelText: null,
        confirmText: opts.confirmText ?? 'OK',
        tone: 'default',
      });
    },
    [confirm],
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{
    open: boolean;
    opts: ConfirmOptions | null;
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, opts: null, resolve: null });

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState((prev) => {
        // if something is already open, cancel it to avoid dangling promises
        prev.resolve?.(false);
        return { open: true, opts, resolve };
      });
    });
  }, []);

  const close = React.useCallback((v: boolean) => {
    setState((prev) => {
      prev.resolve?.(v);
      return { open: false, opts: null, resolve: null };
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && state.opts ? (
        <ConfirmDialog opts={state.opts} onClose={close} />
      ) : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  opts,
  onClose,
}: {
  opts: ConfirmOptions;
  onClose: (v: boolean) => void;
}) {
  const {
    title = 'Confirm',
    message,
    cancelText = 'Cancel',
    confirmText = 'OK',
    tone = 'default',
  } = opts;

  const hasCancel = cancelText !== null;
  const dismissValue = hasCancel ? false : true;

  const cancelRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(dismissValue);
      if (e.key === 'Enter') onClose(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, dismissValue]);

  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-500'
      : 'bg-slate-900 text-white hover:bg-slate-800';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => onClose(dismissValue)}
    >
      <div
        className="w-full max-w-md rounded-[2rem] bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            {title}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-slate-800 leading-snug">
            {message}
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          {hasCancel ? (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onClose(false)}
              className="h-10 px-5 rounded-full bg-white border border-slate-200 text-[12px] font-black text-slate-700 hover:bg-slate-50"
            >
              {cancelText}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onClose(true)}
            className={[
              'h-10 px-5 rounded-full text-[12px] font-black',
              'shadow-[0_8px_20px_rgba(15,23,42,0.16)]',
              confirmCls,
            ].join(' ')}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
