import React, { useMemo } from 'react';
import { Package, CreditCard, TrendingUp, Zap, Star, BarChart3 } from 'lucide-react';
import { Card } from '../components/Shared';
import { formatMoney } from '../utils';
import { AppData } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { data: AppData; }

export default function Dashboard({ data }: Props) {
    const stockVal = data.inv.reduce((a, b) => a + (b.cost * b.quantity), 0);
    const revenue = data.clients.reduce((a, b) => a + (b.totalPrice || 0), 0);
    const profit = data.clients.reduce((a, b) => a + (b.profit || 0), 0);

    // 1. 利润趋势图数据 (最近 30 天)
    const chartData = useMemo(() => {
        const groups: Record<string, number> = {};
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

        data.clients.forEach(c => {
            if (!c.orderDate) return;
            const d = new Date(c.orderDate);
            if (d >= thirtyDaysAgo) {
                const dateStr = c.orderDate.split('T')[0].substring(5); // MM-DD
                groups[dateStr] = (groups[dateStr] || 0) + (c.profit || 0);
            }
        });

        return Object.entries(groups)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [data.clients]);

    // 2. 最畅销配件排行榜 (Top 5)
    const bestSellers = useMemo(() => {
        const counts: Record<string, number> = {};
        data.clients.forEach(c => {
            Object.values(c.specs).forEach(s => {
                if (s.name && !s.name.includes('New Item')) {
                    counts[s.name] = (counts[s.name] || 0) + 1;
                }
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [data.clients]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-32">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Analytics</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Intelligence</p>
                </div>
                {/* 移动端专属：快速操作提示 */}
                <div className="md:hidden flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                    <Zap size={12}/> Live Data
                </div>
            </header>

            {/* 核心指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <Card label="Inventory Value" val={formatMoney(stockVal)} color="text-blue-600" bg="bg-blue-50" icon={Package}/>
                <Card label="Total Revenue" val={formatMoney(revenue)} color="text-slate-700" bg="bg-slate-50" icon={CreditCard}/>
                <Card label="Net Profit" val={formatMoney(profit)} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp}/>
                
                {/* 移动端大按钮适配 */}
                <div className="md:hidden bg-slate-900 text-white p-6 rounded-[2rem] flex justify-between items-center shadow-xl active:scale-95 transition-transform" onClick={() => window.scrollTo(0, 1000)}>
                    <div>
                        <div className="text-lg font-black">Scan Inbound</div>
                        <div className="text-[10px] opacity-60 font-bold uppercase">Tap 'Inbound' tab below</div>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><BarChart3 size={24}/></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 利润趋势图 */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-80 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">30-Day Profit Trend</h3>
                        <div className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">+ Growth</div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold'}} />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 最畅销配件榜单 */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-80 overflow-y-auto no-scrollbar">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 sticky top-0 bg-white pb-2">Best Sellers</h3>
                    <div className="space-y-3">
                        {bestSellers.map(([name, count], i) => (
                            <div key={name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center font-black text-xs ${i===0?'bg-yellow-100 text-yellow-600':i===1?'bg-slate-200 text-slate-600':'bg-orange-100 text-orange-600'}`}>
                                    {i+1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-700 truncate">{name}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{count} Units Sold</div>
                                </div>
                                {i===0 && <Star size={12} className="text-yellow-400 fill-yellow-400"/>}
                            </div>
                        ))}
                        {bestSellers.length === 0 && <div className="text-center text-slate-300 text-xs italic mt-10">No sales data yet</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}