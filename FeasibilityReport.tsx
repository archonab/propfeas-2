
import React, { useMemo, useState } from 'react';
import { FeasibilityScenario, CostCategory, SiteDNA, LineItem, GstTreatment } from './types';
import { FinanceEngine } from './services/financeEngine';

interface Props {
  scenario: FeasibilityScenario;
  siteDNA: SiteDNA; 
  stats: {
    profit: number;
    margin: number;
    irr: number;
    interestTotal: number;
    totalOut: number;
    totalIn: number;
  };
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
      
      // Special handling for Land acquisition costs if they aren't in the costs array but in settings
      // (The AcquisitionManager adds them to settings, but FinanceEngine usually aggregates them. 
      //  Here we stick to the costs array for itemised, but we'll manually inject specific acquisition settings costs below)

      return {
        ...item,
        netAmount,
        gstAmount,
        grossAmount: netAmount + gstAmount
      };
    });
  }, [scenario, siteDNA]);
};

// --- SUB-COMPONENT: GST SUMMARY REPORT ---
const GstSummaryReport = ({ scenario, detailedCosts, reportStats }: { scenario: FeasibilityScenario, detailedCosts: any[], reportStats: any }) => {
  const incomeGross = reportStats.totalRevenueGross;
  const incomeGst = reportStats.gstCollected;
  const incomeNet = reportStats.netRealisation;

  // Add specific acquisition costs from settings that aren't in the costs array
  const acq = scenario.settings.acquisition;
  const acqItems = [
    { name: 'Land Purchase Price', net: acq.purchasePrice, gst: 0, gross: acq.purchasePrice },
    { name: 'Stamp Duty', net: FinanceEngine.calculateStampDuty(acq.purchasePrice, acq.stampDutyState, acq.isForeignBuyer), gst: 0, gross: FinanceEngine.calculateStampDuty(acq.purchasePrice, acq.stampDutyState, acq.isForeignBuyer) },
    { name: 'Legal Fees (Acq)', net: acq.legalFeeEstimate, gst: acq.legalFeeEstimate * 0.1, gross: acq.legalFeeEstimate * 1.1 },
    { name: 'Buyer\'s Agent', net: acq.purchasePrice * (acq.buyersAgentFee/100), gst: (acq.purchasePrice * (acq.buyersAgentFee/100)) * 0.1, gross: (acq.purchasePrice * (acq.buyersAgentFee/100)) * 1.1 }
  ];

  const totalCostGross = detailedCosts.reduce((acc: number, c: any) => acc + c.grossAmount, 0) + acqItems.reduce((acc, c) => acc + c.gross, 0);
  const totalCostGst = detailedCosts.reduce((acc: number, c: any) => acc + c.gstAmount, 0) + acqItems.reduce((acc, c) => acc + c.gst, 0);
  const totalCostNet = detailedCosts.reduce((acc: number, c: any) => acc + c.netAmount, 0) + acqItems.reduce((acc, c) => acc + c.net, 0);

  const Row = ({ label, gross, gst, net, bold = false }: any) => (
    <div className={`grid grid-cols-[2fr_1fr_1fr_1fr] py-2 border-b border-slate-100 ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
        <div className="pl-4">{label}</div>
        <div className="text-right font-mono">{formatCurrency(gross)}</div>
        <div className="text-right font-mono text-slate-500">{formatCurrency(gst)}</div>
        <div className="text-right font-mono">{formatCurrency(net)}</div>
    </div>
  );

  return (
    <div className="text-sm font-sans text-slate-800">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] pb-2 border-b-2 border-slate-900 mb-4 font-bold text-slate-900 uppercase text-xs">
            <div className="pl-4">Item</div>
            <div className="text-right">With GST</div>
            <div className="text-right">GST</div>
            <div className="text-right">Pre-GST</div>
        </div>

        <div className="font-bold text-slate-900 mb-2 px-4 uppercase text-xs tracking-wider bg-slate-50 py-1">Income</div>
        <Row label="Development Sales" gross={incomeGross} gst={incomeGst} net={incomeNet} />
        <Row label="Total Income" gross={incomeGross} gst={incomeGst} net={incomeNet} bold />

        <div className="font-bold text-slate-900 mt-6 mb-2 px-4 uppercase text-xs tracking-wider bg-slate-50 py-1">Development Costs</div>
        {acqItems.map((item, i) => (
             <Row key={`acq-${i}`} label={item.name} gross={item.gross} gst={item.gst} net={item.net} />
        ))}
        {detailedCosts.map((item: any) => (
            <Row key={item.id} label={item.description} gross={item.grossAmount} gst={item.gstAmount} net={item.netAmount} />
        ))}
        
        <div className="mt-4 border-t-2 border-slate-900">
            <Row label="Total Development Cost" gross={totalCostGross} gst={totalCostGst} net={totalCostNet} bold />
        </div>
    </div>
  );
};

// --- SUB-COMPONENT: CATEGORISED & ITEMISED SELL REPORTS ---
const SellReport = ({ scenario, reportStats, stats, viewMode, detailedCosts }: { scenario: FeasibilityScenario, reportStats: any, stats: any, viewMode: ViewMode, detailedCosts: any[] }) => {
  const { settings } = scenario;
  
  // -- COST AGGREGATION LOGIC --
  // We use Gross costs for the list, then subtract ITC at the bottom.
  const purchasePrice = settings.acquisition.purchasePrice;
  const stampDuty = FinanceEngine.calculateStampDuty(purchasePrice, settings.acquisition.stampDutyState, settings.acquisition.isForeignBuyer);
  const agentFee = purchasePrice * (settings.acquisition.buyersAgentFee / 100); // Net
  const legalFee = settings.acquisition.legalFeeEstimate; // Net
  
  // Gross up the acquisition fees for display (assuming 10% GST)
  const agentFeeGross = agentFee * 1.1;
  const legalFeeGross = legalFee * 1.1;
  const totalAcqCostsGross = stampDuty + agentFeeGross + legalFeeGross;

  // Group detailed costs by category
  const costsByCategory = detailedCosts.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<CostCategory, any[]>);

  const getCategoryTotalGross = (cat: CostCategory) => {
      const items = costsByCategory[cat] || [];
      return items.reduce((sum: number, i: any) => sum + i.grossAmount, 0);
  };

  // Values for display
  const constructionCostGross = getCategoryTotalGross(CostCategory.CONSTRUCTION);
  const consultantsGross = getCategoryTotalGross(CostCategory.CONSULTANTS); // Note: Engine usually doesn't include acq fees here in raw list
  const statutoryGross = getCategoryTotalGross(CostCategory.STATUTORY);
  const sellingGross = getCategoryTotalGross(CostCategory.SELLING);
  const miscGross = getCategoryTotalGross(CostCategory.MISCELLANEOUS);

  const totalDevCostGross = purchasePrice + totalAcqCostsGross + constructionCostGross + consultantsGross + statutoryGross + sellingGross + miscGross;
  const totalDevCostNet = totalDevCostGross - reportStats.totalItc; // Net Cost
  const devMargin = reportStats.netRealisation - totalDevCostNet;
  const netProfit = devMargin - stats.interestTotal;

  // --- VALUER STYLE PREP ---
  // Gross Profit = Net Sales - Selling Costs
  const sellingCostsNet = sellingGross - (sellingGross / 11); // Approx back to net for Valuer style usually
  const grossProfitValuer = reportStats.netRealisation - sellingCostsNet;

  const renderCategorisedRows = () => (
    <>
        <div className="pl-4 font-medium text-slate-700">Land Purchase Price</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(purchasePrice)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Acquisition Costs (Duty & Legal)</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(totalAcqCostsGross)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Construction & Siteworks</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(constructionCostGross)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Professional Fees</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(consultantsGross)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Statutory Charges</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(statutoryGross)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Selling & Marketing</div>
        <div className="text-right font-mono text-slate-700">{formatCurrency(sellingGross)}</div>
        <div></div>

        <div className="pl-4 text-slate-600">Contingency & Misc</div>
        <div className="text-right font-mono text-slate-700 border-b border-slate-300 pb-1">{formatCurrency(miscGross)}</div>
        <div className="text-right font-mono font-bold text-slate-400 pt-1 italic text-xs">{formatCurrency(totalDevCostGross)} (Gross)</div>
    </>
  );

  const renderItemisedRows = () => (
    <>
       <div className="pl-4 font-bold text-slate-800 text-xs uppercase mt-2 mb-1">Acquisition</div>
       <div className="pl-8 text-slate-600 text-xs flex justify-between pr-4"><span>Land Purchase</span> <span className="font-mono">{formatCurrency(purchasePrice)}</span></div>
       <div className="pl-8 text-slate-600 text-xs flex justify-between pr-4"><span>Stamp Duty</span> <span className="font-mono">{formatCurrency(stampDuty)}</span></div>
       <div className="pl-8 text-slate-600 text-xs flex justify-between pr-4"><span>Legal Fees</span> <span className="font-mono">{formatCurrency(legalFeeGross)}</span></div>
       <div className="pl-8 text-slate-600 text-xs flex justify-between pr-4"><span>Buyer's Agent</span> <span className="font-mono">{formatCurrency(agentFeeGross)}</span></div>

       {Object.values(CostCategory).map(cat => {
           const items = costsByCategory[cat] || [];
           if (items.length === 0) return null;
           return (
               <React.Fragment key={cat}>
                   <div className="pl-4 font-bold text-slate-800 text-xs uppercase mt-3 mb-1">{cat}</div>
                   {items.map((item: any) => (
                       <div key={item.id} className="pl-8 text-slate-600 text-xs flex justify-between pr-4 group hover:bg-slate-50">
                           <span>{item.description}</span>
                           <span className="font-mono group-hover:text-black">{formatCurrency(item.grossAmount)}</span>
                       </div>
                   ))}
               </React.Fragment>
           );
       })}
       <div className="text-right font-mono font-bold text-slate-400 pt-2 italic text-xs border-t border-slate-200 mt-2">{formatCurrency(totalDevCostGross)} (Gross)</div>
    </>
  );

  return (
    <div className="text-sm font-sans text-slate-900 leading-relaxed">
      
      {/* HEADER */}
      <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Development Profit & Loss</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
                {viewMode === 'itemised' ? 'Itemised' : viewMode === 'valuer' ? 'Valuer\'s Style' : 'Categorised'} Statement (Inclusive of GST)
            </p>
        </div>
        <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Strategy</div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-bold text-xs inline-block mt-1 border border-blue-200">
                TRADING (SELL)
            </div>
        </div>
      </div>

      {viewMode === 'valuer' ? (
          // --- VALUER STYLE LAYOUT ---
          <div className="grid grid-cols-[1fr_150px_150px] gap-y-2">
             <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 col-span-3 text-base mt-2">GROSS PROFIT</div>
             <div className="pl-4 font-medium text-slate-700">Net Realisation (Ex GST)</div>
             <div className="text-right font-mono font-medium text-slate-700">{formatCurrency(reportStats.netRealisation)}</div>
             <div></div>
             <div className="pl-4 text-slate-600">Less: Selling Costs (Net)</div>
             <div className="text-right font-mono text-red-600 border-b border-slate-300">{formatCurrency(-sellingCostsNet)}</div>
             <div></div>
             <div className="pl-4 font-bold text-slate-900">Gross Profit</div>
             <div className="text-right font-mono font-bold text-slate-900">{formatCurrency(grossProfitValuer)}</div>
             <div></div>

             <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 col-span-3 text-base mt-6">DEVELOPMENT COSTS</div>
             {/* Note: Valuer style often lists costs net or gross depending on firm. We'll stick to Gross - ITC format for consistency with the prompt's main request for "GST Shield" */}
             {renderCategorisedRows()}

             <div className="pl-4 text-emerald-700 font-bold flex justify-between pr-4 items-center bg-emerald-50/50 py-1 -mx-4 px-8 mt-2 rounded border border-emerald-100/50 print:bg-transparent print:border-none print:px-0 print:mx-0">
                <span>Less: Input Tax Credits (GST Shield)</span>
             </div>
             <div className="text-right font-mono text-emerald-600 font-bold border-b border-emerald-200 py-1 bg-emerald-50/50 print:bg-transparent print:border-slate-300">{formatCurrency(-reportStats.totalItc)}</div>
             <div></div>

             <div className="pl-4 font-bold text-slate-900 mt-2">Total Construction & Statutory Costs</div>
             <div></div>
             <div className="text-right font-mono font-bold text-slate-900 border-t-2 border-slate-800 pt-1 mt-2">{formatCurrency(totalDevCostNet)}</div>

             <div className="pl-4 text-slate-600 mt-4">Less: Interest Expense</div>
             <div className="text-right font-mono text-red-600 border-b border-slate-300 mt-4">{formatCurrency(-stats.interestTotal)}</div>
             <div></div>

             <div className="pl-4 font-black text-xl text-slate-900 mt-4 uppercase">Net Development Profit</div>
             <div className="col-span-2 text-right font-mono font-black text-xl text-slate-900 mt-4 border-b-4 border-double border-slate-900 pb-1">
                {formatCurrency(netProfit)}
             </div>
          </div>
      ) : (
          // --- CATEGORISED & ITEMISED STANDARD LAYOUT ---
          <div className="grid grid-cols-[1fr_150px_150px] gap-y-2">
            
            {/* --- REVENUE SECTION --- */}
            <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 col-span-3 text-base mt-2">GROSS REALISATION</div>
            
            <div className="pl-4 font-medium text-slate-700">Development Sales Revenue</div>
            <div className="text-right font-mono font-medium text-slate-700">{formatCurrency(reportStats.totalRevenueGross)}</div>
            <div></div>

            <div className="pl-4 text-slate-500 flex justify-between pr-8">
                <span>Less: GST Collected</span>
                <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-400">1/11th Margin</span>
            </div>
            <div className="text-right font-mono text-red-600 border-b border-slate-300">{formatCurrency(-reportStats.gstCollected)}</div>
            <div className="text-right font-mono font-bold text-lg text-slate-900 pt-1">{formatCurrency(reportStats.netRealisation)}</div>

            {/* --- COSTS SECTION --- */}
            <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 mt-8 col-span-3 text-base">DEVELOPMENT COSTS</div>

            {viewMode === 'itemised' ? renderItemisedRows() : renderCategorisedRows()}

            {/* GST SHIELD */}
            <div className="pl-4 text-emerald-700 font-bold flex justify-between pr-4 items-center bg-emerald-50/50 py-1 -mx-4 px-8 mt-2 rounded border border-emerald-100/50 print:bg-transparent print:border-none print:px-0 print:mx-0">
                <span>Less: Input Tax Credits (GST Shield)</span>
                <i className="fa-solid fa-shield-halved opacity-20 print:hidden"></i>
            </div>
            <div className="text-right font-mono text-emerald-600 font-bold border-b border-emerald-200 py-1 bg-emerald-50/50 print:bg-transparent print:border-slate-300">{formatCurrency(-reportStats.totalItc)}</div>
            <div></div>

            <div className="pl-4 font-bold text-slate-900 mt-2">Total Development Cost (Excl. Finance)</div>
            <div></div>
            <div className="text-right font-mono font-bold text-slate-900 border-t-2 border-slate-800 pt-1 mt-2">{formatCurrency(totalDevCostNet)}</div>

            {/* --- PROFIT SECTION --- */}
            <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 mt-8 col-span-3 text-base">PERFORMANCE SUMMARY</div>

            <div className="pl-4 font-medium text-slate-700">Development Margin (EBIT)</div>
            <div></div>
            <div className="text-right font-mono font-bold text-slate-800">{formatCurrency(devMargin)}</div>

            <div className="pl-4 text-slate-600">Less: Net Finance Costs</div>
            <div className="text-right font-mono text-red-600 border-b border-slate-300">{formatCurrency(-stats.interestTotal)}</div>
            <div></div>

            <div className="pl-4 font-black text-xl text-slate-900 mt-4 uppercase">Net Development Profit</div>
            <div className="col-span-2 text-right font-mono font-black text-xl text-slate-900 mt-4 border-b-4 border-double border-slate-900 pb-1">
                {formatCurrency(netProfit)}
            </div>

            {/* --- METRICS FOOTER --- */}
            <div className="col-span-3 grid grid-cols-3 gap-6 mt-12 pt-6 border-t border-slate-200">
                <div className="bg-slate-50 p-4 rounded text-center border border-slate-200 print:bg-transparent">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Margin on Cost (MDC)</div>
                    <div className="text-2xl font-black text-slate-800 font-mono mt-1">
                        {((netProfit / (totalDevCostNet + stats.interestTotal)) * 100).toFixed(2)}%
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded text-center border border-slate-200 print:bg-transparent">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Equity IRR</div>
                    <div className="text-2xl font-black text-blue-600 font-mono mt-1">
                        {stats.irr.toFixed(2)}%
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded text-center border border-slate-200 print:bg-transparent">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Peak Equity Exposure</div>
                    <div className="text-2xl font-black text-slate-800 font-mono mt-1">
                        {formatCurrency(settings.capitalStack.equity.initialContribution)}
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENT: HOLD STRATEGY (INVESTMENT STATEMENT) ---
const HoldReport = ({ scenario, stats }: { scenario: FeasibilityScenario, stats: any }) => {
  const { settings, revenues } = scenario;
  
  // Hold Specifics
  const holdYears = settings.holdStrategy?.holdPeriodYears || 10;
  
  // 1. Annual Net Rent (Stabilised)
  const annualNetRent = revenues.filter(r => r.strategy === 'Hold').reduce((acc, r) => {
      const gross = (r.weeklyRent || 0) * 52 * r.units;
      return acc + (gross * (1 - (r.opexRate || 0)/100));
  }, 0);

  // 2. Terminal Value
  const terminalCap = (settings.holdStrategy?.terminalCapRate || 5) / 100;
  const terminalValue = terminalCap > 0 ? annualNetRent / terminalCap : 0;
  
  // 3. Depreciation Estimates (Div 40 & 43)
  const constructionCost = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a, b) => a + b.amount, 0);
  const div43Rate = 0.025; // 2.5% Flat
  const div40Rate = 0.10; // 10% Diminishing Value approx
  
  const capWorksBase = constructionCost * ((settings.holdStrategy?.depreciationSplit?.capitalWorksPct || 85) / 100);
  const plantBase = constructionCost * ((settings.holdStrategy?.depreciationSplit?.plantPct || 15) / 100);
  
  const annualDepreciation = (capWorksBase * div43Rate) + (plantBase * div40Rate);

  return (
    <div className="text-sm font-sans text-slate-900 leading-relaxed">
      <div className="border-b-4 border-indigo-900 pb-4 mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Property Investment Statement</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">10-Year Forecast & Taxation Summary</p>
        </div>
        <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Strategy</div>
            <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded font-bold text-xs inline-block mt-1 border border-indigo-200">
                HOLD (BTR)
            </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_150px_150px] gap-y-3">
         
         {/* CAPITALISATION */}
         <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 col-span-3 text-base">CAPITALISATION</div>
         <div className="pl-4 font-medium text-slate-700">Total Development Cost (TDC)</div>
         <div></div>
         <div className="text-right font-mono font-bold text-slate-900">{formatCurrency(stats.totalOut)}</div>

         {/* OPERATING INCOME */}
         <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 mt-8 col-span-3 text-base">OPERATING INCOME (STABILISED)</div>
         <div className="pl-4 font-medium text-slate-700">Gross Rental Income (Year 1)</div>
         <div className="text-right font-mono text-slate-700">{formatCurrency(annualNetRent / (1 - 0.25))}</div> 
         <div></div>
         <div className="pl-4 text-slate-600">Less: Property Outgoings & Management</div>
         <div className="text-right font-mono text-red-600 border-b border-slate-300">{formatCurrency(-(annualNetRent / (1 - 0.25) * 0.25))}</div> 
         <div></div>
         <div className="pl-4 font-bold text-slate-900 mt-1">Net Operating Income (NOI)</div>
         <div className="text-right font-mono font-bold text-slate-900 pt-1">{formatCurrency(annualNetRent)}</div>
         <div></div>

         {/* EXIT STRATEGY */}
         <div className="font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-2 mt-8 col-span-3 text-base">EXIT STRATEGY (YEAR {holdYears})</div>
         <div className="pl-4 font-medium text-slate-700">Terminal Capitalisation Rate</div>
         <div className="text-right font-mono font-bold text-slate-700">{settings.holdStrategy?.terminalCapRate}%</div>
         <div></div>
         <div className="pl-4 font-bold text-emerald-700 mt-2">Terminal Investment Sale Price</div>
         <div></div>
         <div className="text-right font-mono font-black text-emerald-700 text-lg border-b-4 border-double border-emerald-200 pb-1 mt-2">{formatCurrency(terminalValue)}</div>

         {/* TAXATION SECTION */}
         <div className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg p-6 mt-8 print:bg-white print:border-slate-300">
            <h4 className="font-bold text-slate-900 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2 flex justify-between">
                <span>Taxation & Non-Cash Deductions (Year 1 Est)</span>
                <i className="fa-solid fa-file-invoice-dollar text-slate-300"></i>
            </h4>
            <div className="grid grid-cols-3 gap-8">
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Division 43 (Building)</div>
                    <div className="text-lg font-mono font-bold text-slate-800">{formatCurrency(capWorksBase * div43Rate)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">2.5% on Const. Cost</div>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Division 40 (Plant)</div>
                    <div className="text-lg font-mono font-bold text-slate-800">{formatCurrency(plantBase * div40Rate)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Diminishing Value</div>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Total Tax Shield</div>
                    <div className="text-lg font-mono font-black text-indigo-600">{formatCurrency(annualDepreciation)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Annual Deduction</div>
                </div>
            </div>
         </div>

         {/* METRICS */}
         <div className="col-span-3 grid grid-cols-3 gap-6 mt-8">
            <div className="border-t-4 border-indigo-600 pt-4">
                <div className="text-xs font-bold text-slate-500 uppercase">10-Year IRR</div>
                <div className="text-3xl font-black text-slate-900 font-mono mt-1">{stats.irr.toFixed(2)}%</div>
            </div>
            <div className="border-t-4 border-slate-300 pt-4">
                <div className="text-xs font-bold text-slate-500 uppercase">Yield on Cost</div>
                <div className="text-3xl font-black text-slate-900 font-mono mt-1">{((annualNetRent / stats.totalOut) * 100).toFixed(2)}%</div>
            </div>
            <div className="border-t-4 border-slate-300 pt-4">
                <div className="text-xs font-bold text-slate-500 uppercase">Equity Multiple</div>
                <div className="text-3xl font-black text-slate-900 font-mono mt-1">
                    {(stats.totalIn / stats.totalOut).toFixed(2)}x
                </div>
            </div>
         </div>

      </div>
    </div>
  );
};

export const FeasibilityReport: React.FC<Props> = ({ scenario, siteDNA, stats }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('categorised');

  const reportStats = useMemo(() => 
    FinanceEngine.calculateReportStats(scenario, siteDNA), 
    [scenario, siteDNA]
  );

  const detailedCosts = useDetailedCosts(scenario, siteDNA);

  const NavButton = ({ id, label }: { id: ViewMode, label: string }) => (
    <button
      onClick={() => setViewMode(id)}
      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-t-lg border-t border-x border-slate-200 transition-colors ${viewMode === id ? 'bg-white text-blue-600 border-b-white translate-y-[1px]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col">
       {/* REPORT TYPE SELECTOR (Hidden on Print) */}
       {scenario.strategy === 'SELL' && (
           <div className="flex pl-8 space-x-1 print:hidden border-b border-slate-200">
              <NavButton id="categorised" label="Categorised P&L" />
              <NavButton id="itemised" label="Itemised P&L" />
              <NavButton id="valuer" label="Valuer's Style" />
              <NavButton id="gst" label="GST Summary" />
           </div>
       )}

       <div className="bg-white p-12 max-w-5xl mx-auto shadow-xl print-container border border-slate-200 print:border-none">
          {scenario.strategy === 'HOLD' 
            ? <HoldReport scenario={scenario} stats={stats} />
            : viewMode === 'gst' 
                ? <GstSummaryReport scenario={scenario} detailedCosts={detailedCosts} reportStats={reportStats} />
                : <SellReport scenario={scenario} reportStats={reportStats} stats={stats} viewMode={viewMode} detailedCosts={detailedCosts} />
          }
          <div className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-4 flex justify-between">
            <p>Generated by DevFeas Pro</p>
            <p>{new Date().toLocaleDateString()}</p>
            <p>Confidential</p>
          </div>
       </div>
    </div>
  );
};
