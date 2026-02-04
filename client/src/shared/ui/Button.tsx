import React from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSize = 'xs' | 'icon' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  'ui-btn inline-flex items-center justify-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-ring)]';

const variants: Record<ButtonVariant, string> = {
  primary: 'ui-btn-primary hover:opacity-90',
  outline: 'border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-muted)]',
  ghost: 'border-transparent text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-muted)]',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'rounded-full px-2 py-1 text-[10px]',
  icon: 'h-7 w-7 rounded-full',
  lg: 'h-10 px-5 rounded-full text-[12px]',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'outline', size = 'xs', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});
