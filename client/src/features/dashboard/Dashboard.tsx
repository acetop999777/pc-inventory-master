import React, { useEffect, useState } from 'react';
import { DollarSign, Package, Wallet, TrendingUp } from 'lucide-react';
import { apiCallOrThrow } from '../../shared/api/http';
import { formatMoney } from '../../shared/lib/format';
import { FinancialCard, panelDashedXl } from '../../shared/ui';

export default function Dashboard() {
  type DashboardStats = {
    totalProfit: number;
    totalBalanceDue: number;
    inventoryValue: number;
    totalItems: number;
  };
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiCallOrThrow<DashboardStats>('/dashboard/stats')
      .then((data) => {
        if (!active) return;
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg =
          typeof err?.userMessage === 'string' && err.userMessage
            ? err.userMessage
            : 'Failed to load dashboard stats';
        setError(msg);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="p-10 text-rose-600 font-semibold">
        {error}
      </div>
    );
  }

  if (!stats) return <div className="p-10">Loading...</div>;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h2 className="text-2xl font-black text-slate-800 mb-8">Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <FinancialCard
          label="Total Profit"
          amount={formatMoney(stats.totalProfit)}
          icon={TrendingUp}
          variant="green"
        />
        <FinancialCard
          label="Balance Due"
          amount={formatMoney(stats.totalBalanceDue)}
          icon={Wallet}
          variant="blue"
        />
        <FinancialCard
          label="Inventory Value"
          amount={formatMoney(stats.inventoryValue)}
          icon={DollarSign}
        />
        <FinancialCard
          label="Total Items"
          amount={stats.totalItems}
          icon={Package}
          variant="slate"
        />
      </div>

      {/* 这里以后可以放图表 */}
      <div className={`bg-white border-slate-200 ${panelDashedXl} p-10 text-center text-slate-300 font-bold h-96 flex items-center justify-center uppercase tracking-widest`}>
        Analytics Chart Module (Coming Soon)
      </div>
    </div>
  );
}
