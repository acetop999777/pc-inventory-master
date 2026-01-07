import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { formatMoney } from '../utils';

// --- Types ---
interface ChartData {
    date: string;
    in: number;
    out: number;
}

interface DashboardStats {
    inventoryValue: number;
    totalItems: number;
    totalClients: number;
    totalProfit: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // 使用新接口获取所有数据
            // 加时间戳防止缓存
            const res = await fetch(`/api/dashboard/chart?_=${Date.now()}`);
            if(!res.ok) throw new Error('API Error');
            const data = await res.json();
            setStats(data.stats);
            setChartData(data.chart || []);
        } catch (e) {
            console.error("Dashboard load failed", e);
        } finally {
            setLoading(false);
        }
    };

    // --- Components ---
    
    const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform ${color}`}>
                <Icon size={64} />
            </div>
            <div className="relative z-10">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{title}</div>
                <div className="text-3xl font-black text-slate-800 mb-1">{value}</div>
                <div className="text-xs text-slate-400 font-medium">{sub}</div>
            </div>
        </div>
    );

    // CSS-Only Bar Chart
    const BarChart = ({ data }: { data: ChartData[] }) => {
        if (!data || data.length === 0) return <div className="h-40 flex items-center justify-center text-slate-300 text-xs uppercase font-bold">No activity data</div>;
        
        // 找出最大值以计算比例
        const maxVal = Math.max(...data.map(d => Math.max(d.in, d.out)));
        const safeMax = maxVal === 0 ? 100 : maxVal; // 防止除以0

        return (
            <div className="w-full h-48 flex items-end gap-2 md:gap-4 mt-4 px-2">
                {data.map((d, i) => {
                    const hIn = (d.in / safeMax) * 100;
                    const hOut = (d.out / safeMax) * 100;
                    const dateLabel = d.date.slice(5); // "01-06"

                    return (
                        <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative min-w-[20px]">
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                <div className="text-emerald-300">IN: {formatMoney(d.in)}</div>
                                <div className="text-red-300">OUT: {formatMoney(d.out)}</div>
                                <div className="text-slate-400 font-mono mt-1 border-t border-slate-600 pt-1">{d.date}</div>
                            </div>

                            {/* Bars */}
                            <div className="w-full flex gap-0.5 items-end h-full">
                                {d.in > 0 && <div style={{ height: `${hIn}%` }} className="flex-1 bg-emerald-400 rounded-t-sm opacity-80 group-hover:opacity-100 transition-all"></div>}
                                {d.out > 0 && <div style={{ height: `${hOut}%` }} className="flex-1 bg-red-400 rounded-t-sm opacity-80 group-hover:opacity-100 transition-all"></div>}
                            </div>
                            
                            {/* Date Label */}
                            <div className="text-[9px] text-center text-slate-300 font-mono mt-1 group-hover:text-slate-500">{dateLabel}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading Command Center...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[95rem] mx-auto pb-32 space-y-8">
            {/* 1. Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Command Center</h1>
                <p className="text-slate-400 text-sm font-medium">Real-time financial & inventory overview</p>
            </div>

            {/* 2. Key Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Inventory Value" 
                    value={formatMoney(stats?.inventoryValue || 0)} 
                    sub={`${stats?.totalItems || 0} Units in stock`}
                    icon={Package} 
                    color="text-blue-500" 
                />
                <StatCard 
                    title="Total Profit" 
                    value={formatMoney(stats?.totalProfit || 0)} 
                    sub="Lifetime gross profit"
                    icon={TrendingUp} 
                    color="text-emerald-500" 
                />
                <StatCard 
                    title="Active Clients" 
                    value={stats?.totalClients || 0} 
                    sub="Total orders processed"
                    icon={Users} 
                    color="text-purple-500" 
                />
                <StatCard 
                    title="Cash Flow (14 Days)" 
                    value={chartData.length > 0 ? "Active" : "Quiet"} 
                    sub="Recent logs detected"
                    icon={Activity} 
                    color="text-orange-500" 
                />
            </div>

            {/* 3. Financial Flow Chart */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <Wallet size={20} className="text-slate-400"/> 
                            Capital Flow (14 Days)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            <span className="text-emerald-500 font-bold">● Inbound (Investment)</span> vs <span className="text-red-400 font-bold">● Outbound (Usage)</span>
                        </p>
                    </div>
                    {/* Summary for Chart */}
                    <div className="hidden md:flex gap-6 text-right">
                        <div>
                            <div className="text-[10px] font-black text-slate-300 uppercase">Period In</div>
                            <div className="font-bold text-emerald-600">{formatMoney(chartData.reduce((a,b)=>a+b.in,0))}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-300 uppercase">Period Out</div>
                            <div className="font-bold text-red-500">{formatMoney(chartData.reduce((a,b)=>a+b.out,0))}</div>
                        </div>
                    </div>
                </div>

                {/* The Custom Bar Chart */}
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                    <BarChart data={chartData} />
                </div>
            </div>
        </div>
    );
}