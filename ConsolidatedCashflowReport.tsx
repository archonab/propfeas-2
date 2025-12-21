
import React, { useMemo } from 'react';
import { MonthlyFlow, CostCategory, FeasibilitySettings } from './types';

interface Props {
  cashflow: MonthlyFlow[];
  settings: FeasibilitySettings;
}

const formatAccounting = (val: number, isCurrency = true) => {
  if (val === 0) return <span className="text-slate-300">-</span>;
  
  const absVal = Math.abs(val);
  const str = absVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  const formatted = isCurrency ? `$${str}` : str;
  
  if (val < 0) {
    return <span className="text-red-600 font-medium">({formatted})</span>;
  }
  return <span className="text-slate-700 tabular-nums">{formatted}</span>;
};

export const ConsolidatedCashflowReport: React.FC<Props> = ({ cashflow, settings }) => {
  
  const data = useMemo(() => {
    // Logic for Quarterly grouping could go here if implemented, currently defaulting to monthly
    return cashflow;
  }, [cashflow]);

  const totals = useMemo(() => {
    const t = {
       grossRevenue: 0,
       sellingCosts: 0,
       netRevenue: 0,
       costs: {} as Record<CostCategory, number>,
       totalDevCosts: 0,
       operatingCashflow: 0,
       finance: 0,
       netProfit: 0,
       equityIn: 0,
       equityOut: 0
    };
    
    Object.values(CostCategory).forEach(c => t.costs[c] = 0);

    cashflow.forEach(f => {
       t.grossRevenue += f.grossRevenue;
       t.netRevenue += f.netRevenue;
       t.sellingCosts += (f.costBreakdown[CostCategory.SELLING] || 0);
       
       Object.values(CostCategory).forEach(c => {
           t.costs[c] += (f.costBreakdown[c] || 0);
       });
       
       // Finance total (Interest + Fees + Line Fees)
       // Note: Establishment fees were added to CostCategory.FINANCE in the engine
       const financePeriod = f.interestSenior + f.interestMezz + (f.costBreakdown[CostCategory.FINANCE] || 0);
       t.finance += financePeriod;

       t.equityIn += f.drawDownEquity;
       t.equityOut += f.repayEquity;
    });

    // Total Dev Costs (excluding Selling & Finance for the "Less Dev Costs" section)
    t.totalDevCosts = Object.entries(t.costs)
      .filter(([k]) => k !== CostCategory.SELLING && k !== CostCategory.FINANCE)
      .reduce((a, b) => a + b[1], 0);

    t.operatingCashflow = t.netRevenue - t.totalDevCosts;
    t.netProfit = t.operatingCashflow - t.finance; // Simplified Operating - Finance

    return t;
  }, [cashflow]);

  const downloadCSV = () => {
    const headers = ['Item', ...data.map(d => d.label), 'Total'];
    const rows: string[][] = [];

    const addRow = (label: string, getter: (d: MonthlyFlow) => number, total: number) => {
        rows.push([
            label, 
            ...data.map(d => getter(d).toFixed(2)), 
            total.toFixed(2)
        ]);
    };

    addRow('GROSS REALISATION', d => d.grossRevenue, totals.grossRevenue);
    addRow('Less Selling Costs', d => -(d.costBreakdown[CostCategory.SELLING] || 0), -totals.sellingCosts);
    addRow('NET REALISATION', d => d.netRevenue, totals.netRevenue); // Net revenue already accounts for selling costs/GST in engine? Actually engine does: net = gross - comm - gst.
    
    // We need to be careful with the engine logic vs this display logic.
    // Engine: netRevenue = Gross - Commission - GST.
    // Report: Gross -> Less Selling -> Net.
    // If we simply subtract selling from Gross in the report, we might miss GST. 
    // Ideally, for the report: Net Realisation = Gross - Selling - GST.
    // Let's rely on the engine's netRevenue for the 'Net' line, as it handles GST correctly.

    // Dev Costs
    [CostCategory.LAND, CostCategory.CONSTRUCTION, CostCategory.CONSULTANTS, CostCategory.STATUTORY, CostCategory.MISCELLANEOUS].forEach(cat => {
        addRow(cat, d => -(d.costBreakdown[cat] || 0), -totals.costs[cat]);
    });

    // Finance
    addRow('Finance Costs', d => -(d.interestSenior + d.interestMezz + (d.costBreakdown[CostCategory.FINANCE] || 0)), -totals.finance);
    
    // Equity
    addRow('Equity Injection', d => d.drawDownEquity, totals.equityIn);
    addRow('Equity Repayment', d => -d.repayEquity, -totals.equityOut);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cashflow_${settings.projectName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

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
      {data.map((d, i) => {
         let val = getter(d);
         if (negative) val = -val;
         return (
            <td key={i} className={`py-2 px-3 text-right text-xs whitespace-nowrap ${isBold ? 'font-bold' : ''}`}>
                {formatAccounting(val)}
            </td>
         );
      })}
      <td className={`py-2 px-3 text-right text-xs whitespace-nowrap font-bold bg-slate-50 border-l border-slate-200 ${isBold ? 'text-slate-900' : 'text-slate-700'}`}>
         {formatAccounting(negative ? -total : total)}
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[700px] animate-in fade-in duration-300 print:shadow-none print:border-none print:h-auto">
      
      {/* Controls Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 print:hidden">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600">
              <i className="fa-solid fa-table-cells"></i>
           </div>
           <div>
              <h3 className="text-sm font-bold text-slate-800">Consolidated Cashflow</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Landscape Report</p>
           </div>
        </div>
        
        <div className="flex space-x-2">
            <button 
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center shadow-sm"
            >
            <i className="fa-solid fa-print mr-2 text-slate-400"></i> Print / Save PDF
            </button>
            <button 
            onClick={downloadCSV}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center shadow-sm"
            >
            <i className="fa-solid fa-file-csv mr-2 text-emerald-500"></i> CSV
            </button>
        </div>
      </div>

      {/* Scrollable Table Area */}
      <div className="flex-1 overflow-auto relative print:overflow-visible">
        <table className="w-full text-left border-collapse min-w-max">
           <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm text-[10px] font-bold text-slate-500 uppercase tracking-wider print:static">
              <tr>
                 <th className="py-3 px-4 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-64 border-r border-slate-200">Item / Period</th>
                 {data.map((d, i) => (
                    <th key={i} className="py-3 px-3 text-right min-w-[100px]">{d.label}</th>
                 ))}
                 <th className="py-3 px-3 text-right bg-slate-200 text-slate-700 border-l border-slate-200 min-w-[120px]">Total</th>
              </tr>
           </thead>
           <tbody>
              
              {/* 1. GROSS REALISATION */}
              <Row label="Gross Realisation" getter={d => d.grossRevenue} total={totals.grossRevenue} isBold bgClass="bg-emerald-50/30" />
              
              <Row label="Other Income" getter={() => 0} total={0} isIndent />

              {/* 2. SELLING COSTS */}
              <Row label="Less: Selling Costs" getter={d => d.costBreakdown[CostCategory.SELLING] || 0} total={totals.sellingCosts} isIndent negative />
              
              {/* 3. NET REALISATION */}
              <Row label="NET REALISATION" getter={d => d.netRevenue} total={totals.netRevenue} isBold bgClass="bg-emerald-100/50" />

              {/* Spacer */}
              <tr className="h-4 bg-slate-50/50"><td className="sticky left-0 bg-slate-50/50 border-r border-slate-200"></td><td colSpan={data.length + 1}></td></tr>

              {/* 4. DEVELOPMENT COSTS */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Less Development Costs</td>
                  <td colSpan={data.length + 1}></td>
              </tr>

              <Row label="Land & Acquisition" getter={d => d.costBreakdown[CostCategory.LAND] || 0} total={totals.costs[CostCategory.LAND]} isIndent negative />
              <Row label="Construction" getter={d => d.costBreakdown[CostCategory.CONSTRUCTION] || 0} total={totals.costs[CostCategory.CONSTRUCTION]} isIndent negative />
              <Row label="Consultants" getter={d => d.costBreakdown[CostCategory.CONSULTANTS] || 0} total={totals.costs[CostCategory.CONSULTANTS]} isIndent negative />
              <Row label="Statutory / Council" getter={d => d.costBreakdown[CostCategory.STATUTORY] || 0} total={totals.costs[CostCategory.STATUTORY]} isIndent negative />
              <Row label="Contingency / Misc" getter={d => d.costBreakdown[CostCategory.MISCELLANEOUS] || 0} total={totals.costs[CostCategory.MISCELLANEOUS]} isIndent negative />

              {/* 5. OPERATING CASHFLOW */}
              <Row 
                label="OPERATING CASHFLOW" 
                getter={d => {
                    const devCosts = Object.entries(d.costBreakdown)
                        .filter(([k]) => k !== CostCategory.SELLING && k !== CostCategory.FINANCE)
                        .reduce((a, b) => a + b[1], 0);
                    return d.netRevenue - devCosts;
                }}
                total={totals.operatingCashflow}
                isBold
                bgClass="bg-blue-50/50 border-t-2 border-blue-100"
              />

              {/* 6. FINANCE */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Finance & Fees</td>
                  <td colSpan={data.length + 1}></td>
              </tr>
              
              <Row 
                label="Interest & Line Fees" 
                getter={d => d.interestSenior + d.interestMezz + (d.costBreakdown[CostCategory.FINANCE] || 0)} 
                total={totals.finance} 
                isIndent 
                negative 
              />

              {/* 7. NET PROFIT */}
              <Row 
                label="NET DEVELOPMENT PROFIT" 
                getter={d => d.netCashflow} 
                total={totals.netProfit} 
                isBold 
                bgClass="bg-indigo-50 border-y-2 border-indigo-100 text-indigo-900" 
              />

              {/* Spacer */}
              <tr className="h-6 bg-white"><td className="sticky left-0 bg-white border-r border-slate-200"></td><td colSpan={data.length + 1}></td></tr>

              {/* 8. EQUITY */}
              <tr className="bg-slate-100 border-y border-slate-200">
                  <td className="sticky left-0 bg-slate-100 z-10 py-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Equity Position</td>
                  <td colSpan={data.length + 1}></td>
              </tr>
              <Row label="Equity Contribution" getter={d => d.drawDownEquity} total={totals.equityIn} isIndent />
              <Row label="Equity Repayment" getter={d => d.repayEquity} total={totals.equityOut} isIndent negative />

              {/* 9. CUMULATIVE BALANCE */}
              <tr className="bg-slate-900 text-white border-t-4 border-double border-slate-600">
                  <td className="sticky left-0 bg-slate-900 z-10 py-3 px-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 shadow-[2px_0_10px_rgba(0,0,0,0.5)]">
                    Cumulative Cash Position
                  </td>
                  {data.map((d, i) => (
                     <td key={i} className="py-3 px-3 text-right text-xs font-mono font-bold whitespace-nowrap">
                        {d.cumulativeCashflow < 0 
                            ? <span className="text-red-400">({Math.abs(d.cumulativeCashflow).toLocaleString(undefined, {maximumFractionDigits: 0})})</span> 
                            : <span className="text-emerald-400">{d.cumulativeCashflow.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        }
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
