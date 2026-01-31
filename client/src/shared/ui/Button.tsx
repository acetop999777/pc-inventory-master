import React from 'react';

type ButtonVariant = 'outline';
type ButtonSize = 'xs' | 'icon';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  'inline-flex items-center justify-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

const variants: Record<ButtonVariant, string> = {
  outline: 'border border-slate-200 text-slate-500 hover:bg-slate-50',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'rounded-full px-2 py-1 text-[10px]',
  icon: 'h-7 w-7 rounded-full',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  className,
  variant = 'outline',
  size = 'xs',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
