
import React, { useMemo } from 'react';
import { FeasibilityScenario, CostCategory, SiteDNA } from './types';
import { FinanceEngine } from './services/financeEngine';

interface Props {
  scenarios: FeasibilityScenario[];
  siteDNA: SiteDNA;
}

interface ScenarioMetrics {
  landValue: number;
  developmentCost: number; // TDC
  netProfit: number;
  margin: number;
  irr: number;
  equityMultiple: number;
}

export const ScenarioComparison: React.FC<Props> = ({ scenarios, siteDNA }) => {
  
  // Calculate metrics for all scenarios
  const results = useMemo(() => {
    return scenarios.map(scenario => {
      // 1. Run Engine
      const cashflow = FinanceEngine.calculateMonthlyCashflow(scenario, siteDNA);
      
      // 2. Extract Key Aggregates
      const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
      const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue, 0);
      const profit = totalIn - totalOut;
      const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
      
      // 3. Land Value (Input)
      const landValue = scenario.costs
        .filter(c => c.category === CostCategory.LAND)
        .reduce((acc, c) => acc + c.amount, 0);

      // 4. IRR & Equity Multiple
      const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
      const irr = FinanceEngine.calculateIRR(equityFlows);
      
      const totalEquityIn = cashflow.reduce((acc, c) => acc + c.drawDownEquity, 0);
      const totalEquityOut = cashflow.reduce((acc, c) => acc + c.repayEquity, 0);
      const equityMultiple = totalEquityIn > 0 ? totalEquityOut / totalEquityIn : 0;

      return {
        id: scenario.id,
        metrics: {
          landValue,
          developmentCost: totalOut,
          netProfit: profit,
          margin,
          irr,
          equityMultiple
        }
      };
    });
  }, [scenarios, siteDNA]);

  const baselineResult = results.find(r => scenarios.find(s => s.id === r.id)?.isBaseline) || results[0];

  const formatCurrency = (val: number) => 
    `$${(val / 1000000).toFixed(2)}M`;
  
  const formatPct = (val: number) => 
    `${val.toFixed(2)}%`;

  const renderVariance = (val: number, baselineVal: number, type: 'currency' | 'pct', inverse = false) => {
    if (val === baselineVal) return <span className="text-slate-300">-</span>;
    
    const diff = val - baselineVal;
    const isPositiveGood = !inverse; // For costs, positive diff is bad (red)
    const isGood = isPositiveGood ? diff > 0 : diff < 0;
    
    const color = isGood ? 'text-emerald-600' : 'text-red-600';
    const icon = diff > 0 ? 'fa-caret-up' : 'fa-caret-down';
    
    const formattedDiff = type === 'currency' 
      ? `$${(Math.abs(diff) / 1000000).toFixed(2)}m` 
      : `${Math.abs(diff).toFixed(2)}%`;

    return (
      <div className={`text-[10px] font-bold ${color} flex items-center justify-end space-x-1`}>
        <span>{formattedDiff}</span>
        <i className={`fa-solid ${icon}`}></i>
      </div>
    );
  };

  const rows: { label: string; key: keyof ScenarioMetrics; type: 'currency' | 'pct'; inverse?: boolean }[] = [
    { label: 'Land Price / RLV', key: 'landValue', type: 'currency', inverse: true },
    { label: 'Total Dev. Cost (TDC)', key: 'developmentCost', type: 'currency', inverse: true },
    { label: 'Net Profit', key: 'netProfit', type: 'currency' },
    { label: 'Development Margin', key: 'margin', type: 'pct' },
    { label: 'Equity IRR', key: 'irr', type: 'pct' },
    { label: 'Equity Multiple', key: 'equityMultiple', type: 'pct' } // formatting as decimal actually
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Scenario Comparison</h1>
          <p className="text-sm text-slate-500">Analyze variance between the Baseline and proposed options.</p>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/4">Metric</th>
              {scenarios.map(s => (
                <th key={s.id} className="px-6 py-4">
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-bold ${s.isBaseline ? 'text-slate-800' : 'text-blue-700'}`}>
                      {s.name}
                    </span>
                    {s.isBaseline && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase mt-1">Baseline</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-left font-semibold text-slate-700">{row.label}</td>
                {results.map(res => {
                  const isBaseline = res.id === baselineResult.id;
                  const val = res.metrics[row.key];
                  
                  let displayVal = '';
                  if (row.key === 'equityMultiple') displayVal = `${val.toFixed(2)}x`;
                  else displayVal = row.type === 'currency' ? formatCurrency(val) : formatPct(val);

                  return (
                    <td key={res.id} className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isBaseline ? 'text-slate-900' : 'text-slate-700'}`}>
                          {displayVal}
                        </span>
                        {!isBaseline && renderVariance(val, baselineResult.metrics[row.key], row.type, row.inverse)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Visual Bar Chart for Profit Comparison */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50">
           <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">Net Profit Comparison</h4>
           <div className="flex items-end justify-center space-x-12 h-32">
              {results.map(res => {
                 const maxProfit = Math.max(...results.map(r => r.metrics.netProfit));
                 const heightPct = (res.metrics.netProfit / maxProfit) * 100;
                 const isBaseline = res.id === baselineResult.id;
                 
                 return (
                    <div key={res.id} className="flex flex-col items-center group w-24">
                       <span className="text-xs font-bold text-slate-700 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         ${(res.metrics.netProfit/1e6).toFixed(1)}m
                       </span>
                       <div 
                         className={`w-full rounded-t-lg transition-all duration-500 ${isBaseline ? 'bg-slate-300' : 'bg-blue-500 shadow-lg shadow-blue-500/20'}`} 
                         style={{ height: `${heightPct}%` }}
                       ></div>
                       <span className="text-[10px] font-bold text-slate-500 uppercase mt-3 text-center leading-tight">
                         {scenarios.find(s => s.id === res.id)?.name}
                       </span>
                    </div>
                 );
              })}
           </div>
        </div>
      </div>
    </div>
  );
};
