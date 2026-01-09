import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    rightElement?: React.ReactNode;
}

export const CompactInput: React.FC<Props> = ({ label, rightElement, className, ...props }) => {
    return (
        <div className={`flex items-center border-b border-slate-200 py-2 h-10 ${className}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase w-24 shrink-0 tracking-wider select-none">
                {label}
            </span>
            <input 
                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-200"
                {...props}
            />
            {rightElement && <div className="ml-2 shrink-0">{rightElement}</div>}
        </div>
    );
};
