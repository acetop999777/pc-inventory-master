import React, { useState, useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface InlineEditProps {
    value: string | number | undefined;
    onSave: (val: string) => void;
    className?: string;
    confirm?: boolean;
}

export const InlineEdit: React.FC<InlineEditProps> = ({ value, onSave, className, confirm=false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempVal, setTempVal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => setTempVal(value), [value]);
    useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);
    
    const finish = () => {
        if (tempVal !== value) {
            if (confirm) {
                if (window.confirm("Change value?")) onSave(String(tempVal));
                else setTempVal(value);
            } else {
                onSave(String(tempVal));
            }
        }
        setIsEditing(false);
    };
    
    if (isEditing) return <input ref={inputRef} className={`w-full bg-white border border-blue-400 rounded px-1 outline-none shadow-sm ${className}`} value={tempVal} onChange={e=>setTempVal(e.target.value)} onBlur={finish} onKeyDown={e=>{if(e.key==='Enter') finish(); if(e.key==='Escape') setIsEditing(false);}}/>;
    return <div onClick={()=>setIsEditing(true)} className={`cursor-pointer hover:bg-blue-50 px-1 rounded border border-transparent hover:border-blue-100 ${className}`}>{value || <span className="text-slate-300 italic">Empty</span>}</div>;
};

interface CardProps {
    label: string;
    val: string;
    color: string;
    bg: string;
    icon: LucideIcon;
}

export const Card: React.FC<CardProps> = ({ label, val, color, bg, icon: Icon }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center`}><Icon size={24}/></div>
        <div><div className="text-3xl font-black text-slate-900 tracking-tight">{val}</div><div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div></div>
    </div>
);

interface NavIconProps {
    icon: LucideIcon;
    active: boolean;
    onClick: () => void;
    label: string;
}

export const NavIcon: React.FC<NavIconProps> = ({icon:I, active, onClick, label}) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all group ${active?'text-blue-600 -translate-y-1':'text-slate-400 hover:text-slate-600'}`}>
        <div className={`p-2 rounded-xl transition-colors ${active?'bg-blue-50':'group-hover:bg-slate-50'}`}><I size={24} strokeWidth={active?2.5:2}/></div>
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
);