import React from 'react';

type InputSize = 'sm' | 'md' | 'lg';
type InputVariant = 'default' | 'soft' | 'ghost';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
  variant?: InputVariant;
};

const base =
  'ui-input w-full text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ui-ring)]';

const sizes: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-10 px-3',
  lg: 'h-12 px-4 text-[15px]',
};

const variants: Record<InputVariant, string> = {
  default: '',
  soft: 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400',
  ghost: 'bg-transparent border-transparent text-slate-700 placeholder:text-slate-400',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = 'md', variant = 'default', type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
});
