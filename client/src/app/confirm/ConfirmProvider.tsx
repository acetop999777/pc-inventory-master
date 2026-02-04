import React from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalSubtitle,
} from '../../shared/ui';

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
    <Modal open onClose={() => onClose(dismissValue)} size="md">
      <ModalHeader>
        <ModalTitle className="text-[11px] uppercase tracking-widest text-slate-400">
          {title}
        </ModalTitle>
        <ModalSubtitle className="whitespace-pre-line">{message}</ModalSubtitle>
      </ModalHeader>
      <ModalFooter className="flex items-center justify-end gap-3">
        {hasCancel ? (
          <Button
            ref={cancelRef}
            onClick={() => onClose(false)}
            size="lg"
            variant="outline"
            className="text-slate-700"
          >
            {cancelText}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => onClose(true)}
          size="lg"
          variant="ghost"
          className={[
            'h-10 px-5 rounded-full text-[12px] font-black',
            'shadow-[0_8px_20px_rgba(15,23,42,0.16)]',
            confirmCls,
          ].join(' ')}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
