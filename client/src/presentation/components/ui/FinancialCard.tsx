import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
    label: string;
    amount: string | number;
    icon?: LucideIcon;
    variant?: 'default' | 'blue' | 'green' | 'slate';
}

export const FinancialCard: React.FC<Props> = ({ label, amount, icon: Icon, variant = 'default' }) => {
    const styles = {
        default: 'bg-white border-slate-200 text-slate-800',
        slate: 'bg-slate-50 border-slate-200 text-slate-600',
        blue: 'bg-blue-50/50 border-blue-100 text-blue-700',
        green: 'bg-emerald-50/50 border-emerald-100 text-emerald-700'
    };

    const labelColors = {
        default: 'text-slate-400',
        slate: 'text-slate-400',
        blue: 'text-blue-500',
        green: 'text-emerald-500'
    };

    return (
        <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between h-24 ${styles[variant]}`}>
            <label className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 block ${labelColors[variant]} flex items-center gap-1`}>
                {Icon && <Icon size={12} />} {label}
            </label>
            <div className="text-xl font-black truncate">
                {amount}
            </div>
        </div>
    );
};
