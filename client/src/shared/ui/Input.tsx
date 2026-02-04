import React from 'react';

type InputSize = 'sm' | 'md' | 'lg';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: InputSize;
};

const base =
  'ui-input w-full text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ui-ring)]';

const sizes: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-10 px-3',
  lg: 'h-12 px-4 text-[15px]',
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = 'md', type = 'text', ...props },
  ref,
) {
  return (
    <input ref={ref} type={type} className={cx(base, sizes[inputSize], className)} {...props} />
  );
});
