import React, { useMemo } from 'react';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory } from './types';
import { FinanceEngine } from './services/financeEngine';

interface Props {
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
  stats: {
    profit: number;
    margin: number;
    irr: number;
    interestTotal: number;
  };
}

const formatCurrency = (val: number) => {
  const isNeg = val < 0;
  const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return isNeg ? `-${absVal}` : `${absVal}`;
};

export const FeasibilityReport: React.FC<Props> = ({ settings, costs, revenues, stats }) => {
  // Use the engine helper to get specific GST and Gross stats for the report view
  const reportStats = useMemo(() => 
    FinanceEngine.calculateReportStats(settings, costs, revenues), 
    [settings, costs, revenues]
  );

  const totalGrossCosts = (Object.values(reportStats.grossCostsByCategory) as number[]).reduce((a, b) => a + b, 0);
  const netCostsAfterItc = totalGrossCosts - reportStats.totalItc;
  const marginBeforeInterest = reportStats.netRealisation - netCostsAfterItc;
  const profitMargin = marginBeforeInterest - stats.interestTotal;

  // Equity Stats
  const equityRequired = settings.capitalStack.equityContribution; // or derived from cashflow peak
  const marginOnEquity = equityRequired > 0 ? (profitMargin / equityRequired) * 100 : 0;

  // Order of Categories to match standard accounting view
  const costCategories = [
    CostCategory.LAND,
    CostCategory.STATUTORY,
    CostCategory.CONSULTANTS, // Often Conveyancing is grouped here or separate
    CostCategory.CONSTRUCTION,
    CostCategory.MISCELLANEOUS, // Rates & Taxes usually here
    CostCategory.SELLING,
    // Note: Finance is handled separately below the line usually, or included. 
    // The screenshot shows "Less Borrowing Interest" at bottom. 
    // We exclude Finance Category from the "Less Costs" block to avoid double counting if using stats.interestTotal
  ];

  return (
    <div className="bg-white p-12 max-w-5xl mx-auto shadow-xl print-container border border-slate-200 text-sm font-sans">
      
      {/* Header */}
      <div className="border-b-2 border-slate-800 pb-2 mb-8 flex justify-between items-end">
        <h1 className="text-xl font-bold text-slate-900">
          Categorised Profit & Loss (Inclusive of GST) - {settings.useMarginScheme ? 'Margin Scheme' : 'Standard'}
        </h1>
        <span className="text-sm font-bold text-slate-500">Amounts are in $'s</span>
      </div>

      <div className="grid grid-cols-[1fr_180px_180px] gap-4 leading-relaxed">
        
        {/* Income Section */}
        <div className="font-bold text-slate-800 text-base">Income:</div>
        <div></div>
        <div></div>

        <div className="pl-8 text-slate-700">Development Sales</div>
        <div className="text-right font-medium text-slate-900">{formatCurrency(reportStats.totalRevenueGross)}</div>
        <div></div>

        <div className="pl-8 text-slate-700">Less: GST Collected in Income</div>
        <div className="text-right font-medium text-slate-900 border-b border-slate-800 pb-1">{formatCurrency(-reportStats.gstCollected)}</div>
        <div className="text-right font-bold text-slate-900 text-base pt-1">{formatCurrency(reportStats.netRealisation)}</div>

        {/* Spacer */}
        <div className="h-4 col-span-3"></div>

        {/* Costs Section */}
        <div className="font-bold text-slate-800 text-base">Less Costs:</div>
        <div></div>
        <div></div>

        {costCategories.map(cat => {
          const val = reportStats.grossCostsByCategory[cat];
          if (val === 0) return null;
          return (
            <React.Fragment key={cat}>
              <div className="pl-8 text-slate-700">{cat}</div>
              <div className="text-right font-medium text-slate-900">{formatCurrency(val)}</div>
              <div></div>
            </React.Fragment>
          );
        })}

        <div className="pl-8 text-slate-700">Contingency Amount</div>
        <div className="text-right font-medium text-slate-900">
           {formatCurrency(reportStats.grossCostsByCategory[CostCategory.MISCELLANEOUS] || 0)} 
           {/* (Assuming logic put contingency in misc or we map strictly) */}
        </div>
        <div></div>

        <div className="pl-8 text-slate-700 font-medium">Less: GST Input Tax Credits</div>
        <div className="text-right font-medium text-slate-900 border-b border-slate-800 pb-1">{formatCurrency(-reportStats.totalItc)}</div>
        <div className="text-right font-bold text-slate-900 text-base pt-1">{formatCurrency(netCostsAfterItc)}</div>

        {/* Spacer */}
        <div className="h-6 col-span-3"></div>

        {/* Margin Before Interest */}
        <div className="font-bold text-slate-800 text-base">Margin Before Interest</div>
        <div></div>
        <div className="text-right font-bold text-slate-900 text-base border-t border-slate-300 pt-1">{formatCurrency(marginBeforeInterest)}</div>

        {/* Interest */}
        <div className="pl-8 text-slate-700 mt-2">Less Borrowing Interest</div>
        <div className="text-right font-medium text-slate-900 mt-2 border-b border-slate-800 pb-1">{formatCurrency(stats.interestTotal)}</div>
        <div></div>

        {/* Profit Margin */}
        <div className="font-bold text-slate-800 text-lg mt-2 underline decoration-2 underline-offset-4">Profit Margin</div>
        <div className="col-span-1 mt-2 pl-4 text-sm font-bold text-slate-500 flex items-center">
            (IRR : {stats.irr.toFixed(2)}% &nbsp;&nbsp;&nbsp; MDC : {((profitMargin / netCostsAfterItc)*100).toFixed(2)}%)
        </div>
        <div className="text-right font-bold text-slate-900 text-lg mt-2 border-b-4 border-double border-slate-800 pb-1">{formatCurrency(profitMargin)}</div>

        {/* Equity Section */}
        <div className="h-4 col-span-3 border-b border-slate-200 mb-4"></div>

        <div className="pl-8 font-bold text-slate-800">Equity Amount :</div>
        <div className="text-right font-bold text-slate-900">{formatCurrency(equityRequired)}</div>
        <div className="pl-4 font-bold text-slate-600">({stats.irr.toFixed(2)}% IRR on Equity)</div>

        <div className="pl-8 font-bold text-slate-800">Margin on Equity :</div>
        <div className="text-right font-bold text-slate-900">{formatCurrency(profitMargin)}</div>
        <div className="pl-4 font-bold text-slate-600">({marginOnEquity.toFixed(2)}% MoE)</div>

      </div>

      <div className="mt-12 text-center text-xs text-slate-400">
        <p>Generated by DevFeas Pro | {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};