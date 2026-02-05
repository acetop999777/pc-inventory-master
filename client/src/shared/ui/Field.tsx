import React from 'react';

type FieldProps = {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  controlClassName?: string;
  helpClassName?: string;
  children: React.ReactNode;
};

const labelBase = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
const helpBase = 'mt-2 text-[10px] font-bold text-slate-400';

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx(labelBase, className)}>{children}</div>;
}

export function FieldHelp({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx(helpBase, className)}>{children}</div>;
}

export function Field({
  label,
  helpText,
  className,
  labelClassName,
  controlClassName,
  helpClassName,
  children,
}: FieldProps) {
  return (
    <div className={className}>
      {label ? <FieldLabel className={labelClassName}>{label}</FieldLabel> : null}
      <div className={cx(label ? 'mt-2' : undefined, controlClassName)}>{children}</div>
      {helpText ? <FieldHelp className={helpClassName}>{helpText}</FieldHelp> : null}
    </div>
  );
}
