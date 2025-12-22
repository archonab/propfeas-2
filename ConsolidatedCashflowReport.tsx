
import React, { useMemo } from 'react';
import { MonthlyFlow, CostCategory, FeasibilitySettings } from './types';

interface Props {
  cashflow: MonthlyFlow[];
  settings: FeasibilitySettings;
}

const formatAccounting = (val: number, isCurrency = true) => {
  if (Math.abs(val) < 1) return <span className="text-slate-300">-</span>;
  
  const absVal = Math.abs(val);
  const str = absVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  const formatted = isCurrency ? `$${str}` : str;
  
  if (val < 0) {
    return <span className="text-red-600 font-medium font-mono">({formatted})</span>;
  }
  return <span className="text-slate-700 tabular-nums font-mono">{formatted}</span>;
};

export const ConsolidatedCashflowReport: React.FC<Props> = ({ cashflow, settings }) => {
  
  // Calculate Header Data Rows (Inflation & Valuation)
  const headerData = useMemo(() => {
    return cashflow.map((flow) => {
        return { 
            factor: flow.inflationFactor, 
            assetVal: flow.assetValue 
        };
    });
  }, [cashflow]);

  const totals = useMemo(() => {
    const t = {
       grossRevenue: 0,
       otherIncome: 0,
       sellingCosts: 0,
       netRevenue: 0,
       costs: {} as Record<CostCategory, number>,
       finance: 0,
       lineFees: 0,
       netProfit: 0,
       equityIn: 0,
       equityOut: 0
    };
    
    Object.values(CostCategory).forEach(c => t.costs[c] = 0);

    cashflow.forEach(f => {
       t.grossRevenue += f.grossRevenue;
       t.otherIncome += f.lendingInterestIncome;
       t.netRevenue += (f.grossRevenue + f.lendingInterestIncome); // Gross Inflow
       t.sellingCosts += (f.costBreakdown[CostCategory.SELLING] || 0);
       
       Object.values(CostCategory).forEach(c => {
           t.costs[c] += (f.costBreakdown[c] || 0);
       });
       
       const financePeriod = f.interestSenior + f.interestMezz + (f.costBreakdown[CostCategory.FINANCE] || 0) + f.lineFeeSenior;
       t.finance += financePeriod;
       t.lineFees += f.lineFeeSenior;

       t.equityIn += f.drawDownEquity;
       t.equityOut += f.repayEquity;
    });

    // Calc Net Profit
    // Net Revenue (Gross - Selling - GST) - Dev Costs - Finance
    // Note: Net Revenue in flow object already deducts selling costs.
    // Total Profit = Total Inflow - Total Outflow
    // Outflow includes: Dev Costs + Finance + Selling Costs
    
    // Sum of net flows
    const sumNetFlows = cashflow.reduce((acc, c) => acc + c.netCashflow, 0);
    // Adjust for financing cashflows (draws/repayments are not profit)
    // Profit = Net Revenue - Costs
    
    const totalCosts = Object.values(t.costs).reduce((a,b) => a+b, 0) + t.finance;
    t.netProfit = (t.grossRevenue + t.otherIncome) - totalCosts;

    return t;
  }, [cashflow]);

  // Row Component
  const Row = ({ 
    label, 
    getter, 
    total, 
    isBold = false, 
    isIndent = false, 
    bgClass = '',
    negative = false
  }: { 
    label: string, 
    getter: (d: MonthlyFlow) => number, 
    total: number, 
    isBold?: boolean, 
    isIndent?: boolean, 
    bgClass?: string,
    negative?: boolean
  }) => (
    <tr className={`border-b border-slate-100 ${bgClass} hover:bg-blue-50/10 transition-colors`}>
      <td className={`sticky left-0 z-10 py-2 px-4 text-xs whitespace-nowrap bg-white border-r border-slate-200 ${bgClass} ${isBold ? 'font-bold text-slate-900' : 'text-slate-600'} ${isIndent ? 'pl-8' : ''}`}>
        {label}
      </td>
      {cashflow.map((d, i) => {
         let val = getter(d);
         if (negative) val = -val;
         return (
            <td key={i} className={`py-2 px-3 text-right text-xs whitespace-nowrap ${isBold ? 'font-bold' : ''}`}>
                {formatAccounting(val)}
            </td>
         );
      })}
      <td className={`py-2 px-3 text-right text-xs whitespace-nowrap font-bold font-mono bg-slate-50 border-l border-slate-200 ${isBold ? 'text-slate-900' : 'text-slate-700'}`}>
         {formatAccounting(negative ? -total : total)}
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[700px] animate-in fade-in duration-300 print:shadow-none print:border-none print:h-auto">
      
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 print:hidden">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-white">
              <i className="fa-solid fa-table-list"></i>
           </div>
           <div>
              <h3 className="text-sm font-bold text-slate-800">Consolidated Cashflow</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Feastudy Format</p>
           </div>
        </div>
        <button onClick={() => window.print()} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50">
            <i className="fa-solid fa-print mr-2"></i> Print
        </button>
      </div>

      <div className="flex-1 overflow-auto relative print:overflow-visible">
        <table className="w-full text-left border-collapse min-w-max">
           <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm text-[10px] font-black text-slate-900 uppercase tracking-wider print:static">
              <tr>
                 <th className="py-3 px-4 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-64 border-r border-slate-200">Period</th>
                 {cashflow.map((d, i) => (
                    <th key={i} className="py-3 px-3 text-right min-w-[100px]">{d.label}</th>
                 ))}
                 <th className="py-3 px-3 text-right bg-slate-100 border-l border-slate-200 min-w-[120px]">Total</th>
              </tr>
           </thead>
           <tbody>
              
              {/* --- HEADER DATA ROWS (Feastudy Style) --- */}
              <tr className="bg-slate-50/50 border-b border-slate-200">
                  <td className="sticky left-0 bg-slate-50 z-10 py-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Inflation Factor</td>
                  {headerData.map((d, i) => <td key={i} className="py-2 px-3 text-right text-xs text-slate-400 font-mono">{d.factor.toFixed(4)}</td>)}
                  <td className="bg-slate-100"></td>
              </tr>
              <tr className="bg-slate-50/50 border-b-2 border-slate-300">
                  <td className="sticky left-0 bg-slate-50 z-10 py-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Market Valuation (AUV)</td>
                  {headerData.map((d, i) => <td key={i} className="py-2 px-3 text-right text-xs text-blue-600 font-mono font-bold">{formatAccounting(d.assetVal)}</td>)}
                  <td className="bg-slate-100"></td>
              </tr>

              {/* Spacer */}
              <tr className="h-4 bg-white"><td className="sticky left-0 bg-white border-r border-slate-200"></td><td colSpan={cashflow.length + 1}></td></tr>

              {/* INCOME */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-900 uppercase tracking-widest border-r border-slate-200">Income</td>
                  <td colSpan={cashflow.length + 1}></td>
              </tr>
              <Row label="Gross Sales Revenue" getter={d => d.grossRevenue} total={totals.grossRevenue} />
              <Row label="Surplus Interest" getter={d => d.lendingInterestIncome} total={totals.otherIncome} />
              <Row label="Less Selling Costs" getter={d => d.costBreakdown[CostCategory.SELLING] || 0} total={totals.sellingCosts} negative />
              <Row label="NET REALISATION" getter={d => (d.grossRevenue + d.lendingInterestIncome) - (d.costBreakdown[CostCategory.SELLING]||0)} total={totals.grossRevenue + totals.otherIncome - totals.sellingCosts} isBold bgClass="bg-emerald-50/50" />

              {/* DEVELOPMENT COSTS */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-900 uppercase tracking-widest border-r border-slate-200">Development Costs</td>
                  <td colSpan={cashflow.length + 1}></td>
              </tr>
              <Row label="Land Purchase" getter={d => d.costBreakdown[CostCategory.LAND] || 0} total={totals.costs[CostCategory.LAND]} negative />
              <Row label="Construction" getter={d => d.costBreakdown[CostCategory.CONSTRUCTION] || 0} total={totals.costs[CostCategory.CONSTRUCTION]} negative />
              <Row label="Consultants" getter={d => d.costBreakdown[CostCategory.CONSULTANTS] || 0} total={totals.costs[CostCategory.CONSULTANTS]} negative />
              <Row label="Statutory Fees" getter={d => d.costBreakdown[CostCategory.STATUTORY] || 0} total={totals.costs[CostCategory.STATUTORY]} negative />
              <Row label="Miscellaneous" getter={d => d.costBreakdown[CostCategory.MISCELLANEOUS] || 0} total={totals.costs[CostCategory.MISCELLANEOUS]} negative />

              {/* CASHFLOW BOTTOM LINE */}
              <Row 
                label="NET FLOW (Pre-Finance)" 
                getter={d => d.netCashflow + d.interestSenior + d.interestMezz + d.lineFeeSenior} 
                total={totals.netProfit + totals.finance} 
                isBold 
                bgClass="bg-indigo-50 border-t-2 border-indigo-200 text-indigo-900" 
              />

              <tr className="h-6 bg-white"><td className="sticky left-0 bg-white border-r border-slate-200"></td><td colSpan={cashflow.length + 1}></td></tr>

              {/* FINANCE & DEBT TRACKING */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-900 uppercase tracking-widest border-r border-slate-200">Debt & Equity Analysis</td>
                  <td colSpan={cashflow.length + 1}></td>
              </tr>
              
              <Row label="Net Outlay (Net Flow)" getter={d => d.netCashflow} total={totals.netProfit} isBold />
              <Row label="Equity Input" getter={d => d.drawDownEquity} total={totals.equityIn} negative />
              
              <tr className="border-b border-slate-100 hover:bg-blue-50/10 transition-colors">
                  <td className="sticky left-0 z-10 py-2 px-4 text-xs whitespace-nowrap bg-white border-r border-slate-200 text-slate-600 pl-8">
                    Cum. Debt B4 Int.
                  </td>
                  {cashflow.map((d, i) => {
                     const prevBalance = i > 0 ? (cashflow[i-1].balanceSenior + cashflow[i-1].balanceMezz) : 0;
                     // Add current drawdowns to get the balance on which interest is charged
                     const currentDraw = d.drawDownSenior + d.drawDownMezz;
                     // We approximate the balance interest is charged on as Average or Opening. 
                     // For this report line item, we just show Opening + Draw
                     return (
                        <td key={i} className="py-2 px-3 text-right text-xs whitespace-nowrap">
                            {formatAccounting(prevBalance + currentDraw)}
                        </td>
                     );
                  })}
                  <td className="bg-slate-50 border-l border-slate-200"></td>
              </tr>

              <Row label="Line Fees" getter={d => d.lineFeeSenior} total={totals.lineFees} />
              <Row label="Interest Charged" getter={d => d.interestSenior + d.interestMezz} total={totals.finance - totals.lineFees} />
              
              <tr className="bg-slate-900 text-white border-t-4 border-double border-slate-600">
                  <td className="sticky left-0 bg-slate-900 z-10 py-3 px-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 shadow-[2px_0_10px_rgba(0,0,0,0.5)]">
                    Closing Debt Balance
                  </td>
                  {cashflow.map((d, i) => (
                     <td key={i} className="py-3 px-3 text-right text-xs font-mono font-bold whitespace-nowrap text-red-400">
                        {formatAccounting(d.balanceSenior + d.balanceMezz)}
                     </td>
                  ))}
                  <td className="bg-slate-800"></td>
              </tr>

           </tbody>
        </table>
      </div>
    </div>
  );
};
