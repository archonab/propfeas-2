
import React, { useMemo, useState } from 'react';
import { FeasibilityScenario, CostCategory, SiteDNA, LineItem, GstTreatment, Site, ProjectMetrics } from './types';
import { FinanceEngine } from './services/financeEngine';
import { SensitivityService } from './services/sensitivityService';
import { HelpTooltip } from './components/HelpTooltip';

interface Props {
  scenario: FeasibilityScenario;
  siteDNA: SiteDNA;
  site?: Site; 
  stats: ProjectMetrics; // Now strictly typed to ProjectMetrics
  onNavigate?: (tab: string, section?: string) => void;
}

type ViewMode = 'categorised' | 'itemised' | 'valuer' | 'gst';

const formatCurrency = (val: number) => {
  const isNeg = val < 0;
  const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return isNeg ? `(${absVal})` : `${absVal}`;
};

// --- HELPER: Detailed Cost Mapper ---
const useDetailedCosts = (scenario: FeasibilityScenario, siteDNA: SiteDNA) => {
  return useMemo(() => {
    // Construction Sum for % calculations
    const constructionSum = scenario.costs
      .filter(c => c.category === CostCategory.CONSTRUCTION)
      .reduce((acc, c) => acc + c.amount, 0);

    // Revenue for % calculations
    const totalRevenue = scenario.revenues.reduce((acc, r) => acc + (r.units * r.pricePerUnit), 0);

    return scenario.costs.map(item => {
      const netAmount = FinanceEngine.calculateLineItemTotal(item, scenario.settings, siteDNA, constructionSum, totalRevenue);
      
      // Calculate GST
      let gstAmount = 0;
      if (item.gstTreatment === GstTreatment.TAXABLE) {
        gstAmount = netAmount * (scenario.settings.gstRate / 100);
      }
      
      return {
        ...item,
        netAmount,
        gstAmount,
        grossAmount: netAmount + gstAmount
      };
    });
  }, [scenario, siteDNA]);
};

// --- SUB-COMPONENT: VALUER STYLE REPORT ---
const ValuerReport = ({ scenario, stats, detailedCosts, onNavigate }: { scenario: FeasibilityScenario, stats: ProjectMetrics, detailedCosts: any[], onNavigate?: (t: string, s?: string) => void }) => {
  const { settings } = scenario;
  
  // -- COST AGGREGATION LOGIC --
  const purchasePrice = settings.acquisition.purchasePrice;
  const stampDuty = FinanceEngine.calculateStampDuty(purchasePrice, settings.acquisition.stampDutyState, settings.acquisition.isForeignBuyer);
  const agentFeeNet = purchasePrice * (settings.acquisition.buyersAgentFee / 100); 
  const legalFeeNet = settings.acquisition.legalFeeEstimate; 
  
  const costsByCategory = detailedCosts.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = 0;
    acc[item.category] += item.netAmount; // Summing Net Amounts
    return acc;
  }, {} as Record<CostCategory, number>);

  const constructionCost = costsByCategory[CostCategory.CONSTRUCTION] || 0;
  const consultantsCost = costsByCategory[CostCategory.CONSULTANTS] || 0;
  const statutoryCost = costsByCategory[CostCategory.STATUTORY] || 0;
  const sellingCost = costsByCategory[CostCategory.SELLING] || 0;
  const miscCost = costsByCategory[CostCategory.MISCELLANEOUS] || 0;

  // Acquisition Total (Net)
  const acquisitionTotal = purchasePrice + stampDuty + agentFeeNet + legalFeeNet;

  // Total Development Cost (Net) excluding Interest
  const totalDevCostNet = acquisitionTotal + constructionCost + consultantsCost + statutoryCost + sellingCost + miscCost;
  
  // Sensitivity Analysis
  const sensitivity = useMemo(() => {
      const costPlus5 = (stats.totalDevelopmentCost * 1.05);
      const profitCostPlus5 = stats.netRevenue - costPlus5;
      const marginCostPlus5 = (profitCostPlus5 / costPlus5) * 100;

      const revMinus5 = (stats.netRevenue * 0.95);
      const profitRevMinus5 = revMinus5 - stats.totalDevelopmentCost;
      const marginRevMinus5 = (profitRevMinus5 / stats.totalDevelopmentCost) * 100;

      return { marginCostPlus5, marginRevMinus5 };
  }, [stats]);

  const Row = ({ label, value, bold = false, indent = false, negative = false, onClick, highlight = false }: any) => (
    <div 
        onClick={onClick}
        className={`flex justify-between items-center py-1.5 border-b border-slate-50 hover:bg-blue-50 transition-colors ${onClick ? 'cursor-pointer group' : ''} ${highlight ? 'bg-blue-50/50' : ''}`}
    >
        <div className={`flex items-center ${indent ? 'pl-6' : 'pl-0'}`}>
            <span className={`text-xs ${bold ? 'font-bold text-slate-900' : 'text-slate-600'} ${onClick ? 'group-hover:text-blue-700' : ''}`}>
                {label}
            </span>
            {onClick && <i className="fa-solid fa-chevron-right text-[9px] text-blue-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"></i>}
        </div>
        <div className={`font-mono text-xs ${bold ? 'font-bold text-slate-900' : 'text-slate-700'} ${negative ? 'text-red-600' : ''}`}>
            {formatCurrency(negative ? -value : value)}
        </div>
    </div>
  );

  return (
    <div className="font-sans text-slate-900 max-w-4xl mx-auto">
        
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Executive Feasibility Summary</h1>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Project: {scenario.settings.projectName || "Untitled Project"}</p>
                <div className="mt-4 text-xs text-slate-400 space-y-1">
                    <p><span className="font-bold">Scenario:</span> {scenario.name}</p>
                    <p><span className="font-bold">Date:</span> {new Date().toLocaleDateString()}</p>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest mb-2 inline-block">
                    Development (Sell)
                </div>
                <div className="text-3xl font-black text-emerald-600 tracking-tighter">
                    {stats.devMarginPct.toFixed(2)}%
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Return on Cost (MDC)</p>
            </div>
        </div>

        {/* --- SECTION 1: REVENUE --- */}
        <div className="mb-8">
            <h3 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-200 pb-1 mb-2">1. Gross Realisation</h3>
            <Row label="Gross Sales Revenue (Inc. GST)" value={stats.grossRealisation} onClick={() => onNavigate?.('sales')} highlight />
            <Row label="Less: GST Liability (1/11th)" value={stats.gstOnSales} negative indent />
            <div className="flex justify-between items-center py-2 mt-1 border-t-2 border-slate-800 bg-slate-50/50">
                <span className="font-black text-sm uppercase pl-2">Net Realisation (Ex GST)</span>
                <span className="font-black text-sm font-mono pr-0">{formatCurrency(stats.netRealisation)}</span>
            </div>
        </div>

        {/* --- SECTION 2: COSTS --- */}
        <div className="mb-8">
            <h3 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-200 pb-1 mb-2">2. Development Costs</h3>
            
            {/* Acquisition */}
            <div className="mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1 pl-2">Acquisition</div>
                <Row label="Land Purchase Price" value={purchasePrice} onClick={() => onNavigate?.('deal')} />
                <Row label="Stamp Duty & Transfer" value={stampDuty} indent />
                <Row label="Legal & Agent Fees" value={agentFeeNet + legalFeeNet} indent />
                <div className="border-t border-dashed border-slate-200 mt-1"></div>
                <Row label="Total Acquisition Costs" value={acquisitionTotal} bold />
            </div>

            {/* Delivery */}
            <div className="mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1 pl-2">Delivery</div>
                <Row label="Construction Costs" value={constructionCost} onClick={() => onNavigate?.('inputs')} />
                <Row label="Professional Fees" value={consultantsCost} onClick={() => onNavigate?.('inputs')} />
                <Row label="Statutory Contributions" value={statutoryCost} onClick={() => onNavigate?.('inputs')} />
                <Row label="Project Contingency (Misc)" value={miscCost} onClick={() => onNavigate?.('inputs')} />
                <div className="border-t border-dashed border-slate-200 mt-1"></div>
                <Row label="Total Delivery Costs" value={constructionCost + consultantsCost + statutoryCost + miscCost} bold />
            </div>

            {/* Selling */}
            <div className="mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1 pl-2">Disposal</div>
                <Row label="Marketing & Commissions" value={sellingCost} onClick={() => onNavigate?.('inputs')} />
            </div>

            <div className="flex justify-between items-center py-2 mt-2 border-t border-slate-300">
                <span className="font-bold text-sm text-slate-700 pl-2">Total Development Cost (Pre-Finance)</span>
                <span className="font-bold text-sm font-mono">{formatCurrency(totalDevCostNet)}</span>
            </div>
        </div>

        {/* --- SECTION 3: FINANCE & PROFIT --- */}
        <div className="mb-12">
            <h3 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-200 pb-1 mb-2">3. Finance & Performance</h3>
            <Row label="Interest Expense (Net)" value={stats.totalFinanceCost} onClick={() => onNavigate?.('inputs')} />
            
            <div className="flex justify-between items-center py-3 mt-4 border-t-4 border-double border-slate-900 bg-emerald-50 px-2 rounded-sm">
                <span className="font-black text-base uppercase text-emerald-900">Net Development Profit</span>
                <span className="font-black text-xl font-mono text-emerald-700">{formatCurrency(stats.netProfit)}</span>
            </div>
        </div>

        {/* --- SECTION 4: SENSITIVITY --- */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 print:break-inside-avoid">
            <div className="flex items-center space-x-2 mb-4 border-b border-slate-200 pb-2">
                <i className="fa-solid fa-umbrella text-slate-400"></i>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Sensitivity</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-600 font-bold">Construction Cost (+5%)</span>
                        <span className={`text-xs font-black font-mono ${sensitivity.marginCostPlus5 < 15 ? 'text-amber-600' : 'text-slate-800'}`}>
                            {sensitivity.marginCostPlus5.toFixed(2)}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-slate-400 h-full" style={{ width: `${Math.max(0, sensitivity.marginCostPlus5)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Impact of cost blowout on Margin.</p>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-600 font-bold">Sales Revenue (-5%)</span>
                        <span className={`text-xs font-black font-mono ${sensitivity.marginRevMinus5 < 10 ? 'text-red-600' : 'text-slate-800'}`}>
                            {sensitivity.marginRevMinus5.toFixed(2)}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-slate-400 h-full" style={{ width: `${Math.max(0, sensitivity.marginRevMinus5)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Impact of market downturn on Margin.</p>
                </div>
            </div>
        </div>

    </div>
  );
};

// --- HOLD REPORT ---
const HoldReport = ({ scenario, siteDNA, stats }: { scenario: FeasibilityScenario, siteDNA: SiteDNA, stats: ProjectMetrics }) => {
    
    // Generate an Annual Summary for the Hold Period
    const annualData = useMemo(() => {
        const cashflow = FinanceEngine.calculateMonthlyCashflow(scenario, siteDNA);
        const refiMonth = scenario.settings.holdStrategy?.refinanceMonth || 0;
        const opFlows = cashflow.slice(refiMonth); // Start from operating phase
        
        const years: any[] = [];
        let yearIndex = 1;
        
        // Chunk into 12-month blocks
        for (let i = 0; i < opFlows.length; i += 12) {
            const chunk = opFlows.slice(i, i + 12);
            if (chunk.length === 0) break;

            const yearGross = chunk.reduce((acc, c) => acc + c.grossRevenue, 0);
            const yearOpex = chunk.reduce((acc, c) => acc + (c.costBreakdown[CostCategory.MISCELLANEOUS] || 0), 0);
            // Sum explicit Land Tax if tracked, otherwise 0
            const yearLandTax = chunk.reduce((acc, c) => acc + (c.landTaxLiability || 0), 0);
            const yearDepreciation = chunk.reduce((acc, c) => acc + (c.depreciation || 0), 0);
            
            const yearNet = yearGross - yearOpex - yearLandTax;
            const taxableIncome = yearNet - yearDepreciation - chunk.reduce((acc, c) => acc + c.investmentInterest, 0);
            
            // Get closing statutory value for the year
            const closingStatValue = chunk[chunk.length-1].statutoryValue;

            years.push({
                year: yearIndex++,
                statValue: closingStatValue,
                grossRent: yearGross,
                opex: yearOpex,
                landTax: yearLandTax,
                depreciation: yearDepreciation,
                netIncome: yearNet,
                taxableIncome
            });
        }
        return years.slice(0, 10); // Show max 10 years
    }, [scenario, siteDNA]);

    // Calculate Exit Metrics
    const exitValuation = annualData.length > 0 ? (annualData[annualData.length - 1].netIncome / ((scenario.settings.holdStrategy?.terminalCapRate || 5) / 100)) : 0;

    return (
        <div className="font-sans text-slate-900 max-w-5xl mx-auto">
            <div className="border-b-4 border-indigo-900 pb-6 mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-indigo-900">Investment Analysis Report</h1>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Project: {scenario.settings.projectName}</p>
                </div>
                <div className="text-right">
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest mb-2 inline-block">
                        Build to Rent
                    </div>
                    <div className="text-3xl font-black text-indigo-600 tracking-tighter">
                        {stats.equityIRR !== null ? stats.equityIRR.toFixed(2) + '%' : 'N/A'}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equity IRR (10 Yr)</p>
                </div>
            </div>

            {/* Hold Metrics */}
            <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Initial Yield</p>
                    <p className="text-xl font-bold text-slate-800">
                        {annualData.length > 0 ? ((annualData[0].netIncome / stats.totalDevelopmentCost) * 100).toFixed(2) : 0}%
                    </p>
                </div>
                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">10 Yr Cash Multiple</p>
                    <p className="text-xl font-bold text-slate-800">
                        {(stats.netRevenue / stats.totalDevelopmentCost).toFixed(2)}x
                    </p>
                </div>
                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Terminal Value (ISP)</p>
                    <p className="text-xl font-bold text-emerald-600">
                        {formatCurrency(exitValuation)}
                    </p>
                </div>
                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Avg. Land Tax (p.a)</p>
                    <p className="text-xl font-bold text-slate-800">
                        {formatCurrency(annualData.reduce((a,b) => a+b.landTax,0) / annualData.length || 0)}
                    </p>
                </div>
            </div>

            <h3 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-200 pb-1 mb-4">Operating Cashflow Forecast</h3>
            
            <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b-2 border-slate-200 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                            <th className="px-4 py-3 text-left">Period</th>
                            <th className="px-4 py-3">Statutory Value (AUV)</th>
                            <th className="px-4 py-3 bg-emerald-50 text-emerald-800">Gross Rental Income</th>
                            <th className="px-4 py-3">Operating Exp.</th>
                            <th className="px-4 py-3 bg-red-50 text-red-700 border-x border-red-100">Land Tax</th>
                            <th className="px-4 py-3 font-bold border-l border-slate-200">Net Operating Income</th>
                            <th className="px-4 py-3 text-slate-400 border-l border-slate-200">Depreciation (Non-Cash)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {annualData.map((row) => (
                            <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-left font-bold text-slate-700">Year {row.year}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{formatCurrency(row.statValue)}</td>
                                <td className="px-4 py-3 font-mono text-emerald-700 font-bold bg-emerald-50/30">{formatCurrency(row.grossRent)}</td>
                                <td className="px-4 py-3 font-mono text-slate-600">({formatCurrency(row.opex)})</td>
                                <td className="px-4 py-3 font-mono font-bold text-red-600 bg-red-50/30 border-x border-red-50">
                                    ({formatCurrency(row.landTax)})
                                </td>
                                <td className="px-4 py-3 font-mono font-black text-slate-800 border-l border-slate-200">
                                    {formatCurrency(row.netIncome)}
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-400 italic border-l border-slate-200">
                                    ({formatCurrency(row.depreciation)})
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-6 p-4 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-500 space-y-2">
                <p><span className="font-bold uppercase">Dynamic Statutory Logic:</span> Land Tax is recalculated annually based on the projected Statutory Land Value (AUV) appreciating at {scenario.settings.growth?.landAppreciation || 3}% p.a. Brackets adjust dynamically based on 2024/25 {scenario.settings.acquisition.stampDutyState} progressive tax scales.</p>
                <p><span className="font-bold uppercase">Terminal Value:</span> Calculated as Net Operating Income in Year 10 divided by the Terminal Capitalisation Rate of {scenario.settings.holdStrategy?.terminalCapRate}%.</p>
            </div>
        </div>
    );
};

export const FeasibilityReport: React.FC<Props> = ({ scenario, siteDNA, stats, onNavigate, site }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('valuer');

  const detailedCosts = useDetailedCosts(scenario, siteDNA);

  return (
    <div className="flex flex-col relative">
       <div className="bg-white p-12 max-w-5xl mx-auto shadow-xl print-container border border-slate-200 print:border-none w-full">
          {scenario.strategy === 'HOLD' 
            ? <HoldReport scenario={scenario} siteDNA={siteDNA} stats={stats} />
            : <ValuerReport scenario={scenario} stats={stats} detailedCosts={detailedCosts} onNavigate={onNavigate} />
          }
          <div className="mt-12 text-center text-[10px] text-slate-300 border-t border-slate-100 pt-4 flex justify-between uppercase tracking-widest font-bold">
            <p>DevFeas Pro System</p>
            <p>Commercial in Confidence</p>
          </div>
       </div>
    </div>
  );
};
