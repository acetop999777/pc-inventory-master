import React, { useState } from 'react';
import { Scan, Box, Loader2 } from 'lucide-react';

interface Props {
    onScan: (code: string) => Promise<void>;
    onParse: (text: string) => void;
    loading: boolean;
}

export const InboundScanner: React.FC<Props> = ({ onScan, onParse, loading }) => {
    const [scanVal, setScanVal] = useState('');
    const [textVal, setTextVal] = useState('');

    const handleScanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(scanVal.trim()) {
            onScan(scanVal);
            setScanVal('');
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* 1. Barcode Scanner */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex-shrink-0">
                <h3 className="font-black uppercase text-xs mb-4 text-slate-400 tracking-widest flex items-center gap-2">
                    <Scan size={14}/> Scanner Input
                </h3>
                <form onSubmit={handleScanSubmit} className="relative">
                    {loading ? <Loader2 className="absolute left-4 top-3.5 text-blue-500 animate-spin" size={20}/> : <Scan className="absolute left-4 top-3.5 text-slate-400" size={20}/>}
                    <input 
                        autoFocus 
                        className="w-full bg-slate-50 pl-12 pr-4 py-3.5 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300" 
                        placeholder="Scan SKU / UPC..." 
                        value={scanVal} 
                        onChange={e=>setScanVal(e.target.value)}
                    />
                </form>
            </div>

            {/* 2. Newegg Parsing */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                <h3 className="font-black uppercase text-xs mb-4 text-slate-400 tracking-widest flex items-center gap-2">
                    <Box size={14}/> Newegg Import
                </h3>
                <textarea 
                    className="flex-1 bg-slate-50 rounded-xl p-4 text-xs font-mono mb-4 outline-none resize-none focus:ring-2 focus:ring-blue-100 transition-all leading-relaxed placeholder:text-slate-300" 
                    placeholder="Paste Newegg Order Summary (Control+A, Control+C)..." 
                    value={textVal} 
                    onChange={e=>setTextVal(e.target.value)}
                />
                <button 
                    onClick={() => { onParse(textVal); setTextVal(''); }} 
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex-shrink-0"
                >
                    Analyze & Extract
                </button>
            </div>
        </div>
    );
};
