import React from 'react';

type SelectSize = 'sm' | 'md' | 'lg';
type SelectVariant = 'default' | 'soft' | 'ghost';

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: SelectSize;
  variant?: SelectVariant;
  wrapperClassName?: string;
};

const base =
  'ui-select w-full text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ui-ring)] appearance-none pr-8';

const sizes: Record<SelectSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-10 px-3',
  lg: 'h-12 px-4 text-[15px]',
};

const variants: Record<SelectVariant, string> = {
  default: '',
  soft: 'bg-slate-50 border-slate-200 text-slate-700',
  ghost: 'bg-transparent border-transparent text-slate-700',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, wrapperClassName, size = 'md', variant = 'default', children, ...props },
  ref,
) {
  return (
    <div className={cx('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cx(base, sizes[size], variants[variant], className)}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ui-text-subtle)]"
      >
        <path
          d="M5.5 7.5l4.5 4.5 4.5-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
