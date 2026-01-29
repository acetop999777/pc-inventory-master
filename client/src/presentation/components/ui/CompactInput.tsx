import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightElement?: React.ReactNode;
  icon?: LucideIcon;
}

export const CompactInput: React.FC<Props> = ({
  label,
  rightElement,
  icon: Icon,
  className,
  ...props
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDate = props.type === 'date';

  const handleContainerClick = () => {
    if (!isDate || !inputRef.current) {
      return;
    }

    const input = inputRef.current as HTMLInputElement & { showPicker?: () => void };
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
  };

  return (
    <div
      className={`flex flex-col items-start gap-1 border-b border-slate-200 py-1.5 ${className ?? ''} md:flex-row md:items-center md:gap-2 md:h-9 ${isDate ? 'cursor-pointer' : ''}`}
      onClick={handleContainerClick}
    >
      <span className="text-[10px] font-bold text-slate-400 uppercase w-full md:w-20 shrink-0 tracking-wider select-none whitespace-nowrap leading-none">
        <span className="inline-flex items-center gap-1">
          {Icon ? <Icon size={12} className="text-slate-300" /> : null}
          {label}
        </span>
      </span>

      <input
        ref={inputRef}
        className={`w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-200 leading-none ${isDate ? 'compact-date-input cursor-pointer' : ''}`}
        {...props}
      />

      {rightElement && <div className="mt-1 md:mt-0 md:ml-2 shrink-0 self-end md:self-auto">{rightElement}</div>}
    </div>
  );
};
