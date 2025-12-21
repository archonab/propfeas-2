
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { LineItem, FeasibilitySettings, CostCategory } from './types';
import { distributeValue, getMonthLabel } from './services/financeEngine';
import Decimal from 'decimal.js';

interface Props {
  item: LineItem;
  settings: FeasibilitySettings;
  constructionTotal: number;
  totalRevenue: number;
}

export const PhasingChart: React.FC<Props> = ({ item, settings, constructionTotal, totalRevenue }) => {
  
  const data = useMemo(() => {
    const chartData = [];
    // Calculate approximate nominal value for the chart Y-axis scale
    let baseTotal = item.amount;
    if (item.inputType.includes('Revenue')) baseTotal = (item.amount/100) * totalRevenue;
    if (item.inputType.includes('Construction')) baseTotal = (item.amount/100) * constructionTotal;

    // Determine the effective start date based on category
    let effectiveStart = item.startDate;
    if (item.category === CostCategory.CONSTRUCTION) {
       const settlement = settings.acquisition.settlementPeriod || 0;
       const delay = settings.constructionDelay || 0;
       effectiveStart += (settlement + delay);
    }

    for (let m = 0; m <= settings.durationMonths; m++) {
      let baseVal = 0;
      let escalatedVal = 0;

      if (m >= effectiveStart && m < effectiveStart + item.span) {
        // Calculate Base
        // Note: distributeValue expects relative month index (0 to span)
        const monthlyBase = distributeValue(baseTotal, m - effectiveStart, item);
        baseVal = monthlyBase.toNumber();

        // Calculate Escalated
        const annualRate = (item.escalationRate || 0) / 100;
        let compoundingFactor = 1;
        if (annualRate > 0) {
           const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
           compoundingFactor = Math.pow(1 + monthlyRate, m);
        }
        escalatedVal = baseVal * compoundingFactor;
      }

      chartData.push({
        month: m,
        label: getMonthLabel(settings.startDate, m),
        Base: baseVal,
        Escalated: escalatedVal
      });
    }
    return chartData;
  }, [item, settings.durationMonths, settings.startDate, settings.acquisition.settlementPeriod, settings.constructionDelay, constructionTotal, totalRevenue]);

  if (item.span <= 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400">Invalid Duration</div>;

  return (
    <div className="w-full h-40 bg-white border border-slate-100 rounded-lg p-2">
      <div className="flex justify-between items-center mb-2 px-2">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phasing Preview</span>
         <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
               <div className="w-2 h-2 bg-blue-100 border border-blue-500 rounded-sm"></div>
               <span className="text-[9px] font-bold text-slate-500">Base Cost</span>
            </div>
            {item.escalationRate > 0 && (
              <div className="flex items-center space-x-1">
                 <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                 <span className="text-[9px] font-bold text-slate-500">Escalated (+{item.escalationRate}%)</span>
              </div>
            )}
         </div>
      </div>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" hide />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
            formatter={(val: number) => [`$${val.toLocaleString(undefined, {maximumFractionDigits: 0})}`, '']}
            labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
          />
          <Area 
            type="monotone" 
            dataKey="Base" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorBase)" 
            isAnimationActive={false}
          />
          {item.escalationRate > 0 && (
             <Line 
               type="monotone" 
               dataKey="Escalated" 
               stroke="#f59e0b" 
               strokeWidth={2} 
               strokeDasharray="3 3"
               dot={false}
               isAnimationActive={false}
             />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
