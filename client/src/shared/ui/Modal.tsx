import React from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  size?: ModalSize;
  children: React.ReactNode;
  dismissOnBackdrop?: boolean;
};

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Modal({
  open,
  onClose,
  size = 'md',
  dismissOnBackdrop = true,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[6px]"
        onMouseDown={() => (dismissOnBackdrop ? onClose?.() : null)}
      />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className={cx(
            'w-full rounded-[2rem] bg-white border border-slate-200 shadow-2xl overflow-hidden',
            sizes[size],
          )}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({
  children,
  className,
  divider = false,
}: {
  children: React.ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={cx(
        'px-6 pt-6 pb-4',
        divider ? 'border-b border-slate-100' : undefined,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx('px-6 py-4', className)}>{children}</div>;
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx('px-6 pb-6', className)}>{children}</div>;
}

export function ModalTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('text-sm font-black text-slate-900', className)}>
      {children}
    </div>
  );
}

export function ModalSubtitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mt-2 text-[14px] font-semibold text-slate-800 leading-snug', className)}>
      {children}
    </div>
  );
}
