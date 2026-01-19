import React, { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Activity, RefreshCw, Calendar, Wallet } from 'lucide-react';
import { apiCall } from '../utils';

type GroupBy = 'day' | 'week' | 'month';

type Stats = {
  inventoryValue: number;
  totalProfit: number;
  totalBalanceDue: number;
  totalItems: number;
  totalClients: number;
};

type ChartPoint = {
  date: string;
  profit: number;
};

export default function Dashboard({ notify }: { notify?: (msg: string, type?: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiCall('/dashboard/stats');
      if (res) setStats(res as Stats);
    } catch (e) {
      console.error(e);
      notify?.('Failed to load stats', 'error');
    }
  }, [notify]);

  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const res = await apiCall('/dashboard/profit', 'POST', {
        start: startDate,
        end: endDate,
        group: groupBy,
      });
      if (res) setChartData(res as ChartPoint[]);
    } catch (e) {
      console.error(e);
      notify?.('Failed to load chart', 'error');
    } finally {
      setLoadingChart(false);
    }
  }, [endDate, groupBy, notify, startDate]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-slate-400 gap-2">
        <RefreshCw className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          Overview
        </h1>
        <button
          onClick={() => {
            void loadStats();
            void loadChart();
          }}
          className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase">Inventory Value</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            ${stats.inventoryValue.toLocaleString()}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Profit</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">
            +${stats.totalProfit.toLocaleString()}
          </h3>
        </div>

        <div className="bg-blue-50/50 p-6 rounded-2xl shadow-sm border border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-black text-blue-500 uppercase">Balance Due</p>
              <h3 className="text-2xl font-bold text-blue-700 mt-1">
                ${stats.totalBalanceDue.toLocaleString()}
              </h3>
            </div>
            <Wallet className="text-blue-300" size={20} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Items</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalItems}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Clients</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalClients}</h3>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[500px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} /> Profit Trend
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize ${
                    groupBy === g ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-600 outline-none w-24"
              />
              <span className="text-slate-300">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-600 outline-none w-24"
              />
            </div>

            {loadingChart && (
              <div className="text-xs text-slate-400 font-medium">Loading chart…</div>
            )}
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Net Profit"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
