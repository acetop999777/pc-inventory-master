import React from 'react';
import { Package, CreditCard, TrendingUp } from 'lucide-react';
import { Card } from '../components/Shared';
import { formatMoney } from '../utils';
import { AppData } from '../types';

interface Props {
    data: AppData;
}

export default function Dashboard({ data }: Props) {
  const stockVal = data.inv.reduce((a, b) => a + (b.cost * b.quantity), 0);
  const revenue = data.clients.reduce((a, b) => a + (b.totalPrice || 0), 0);
  const profit = data.clients.reduce((a, b) => a + (b.profit || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
       <header>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Command Center</h1>
           <p className="text-sm font-medium text-slate-400">Inventory & Order Management System</p>
       </header>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card label="Total Inventory Asset" val={formatMoney(stockVal)} color="text-blue-600" bg="bg-blue-50" icon={Package}/>
          <Card label="Total Revenue" val={formatMoney(revenue)} color="text-slate-700" bg="bg-slate-50" icon={CreditCard}/>
          <Card label="Net Profit" val={formatMoney(profit)} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp}/>
       </div>
    </div>
  );
}