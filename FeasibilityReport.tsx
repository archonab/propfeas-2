
import React from 'react';
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
    npv: number;
    totalOut: number;
    totalIn: number;
    constructionTotal: number;
    interestTotal: number;
  };
}

const formatCurrency = (val: number) => {
  const isNeg = val < 0;
  const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return isNeg ? `($${absVal})` : `$${absVal}`;
};

export const FeasibilityReport: React.FC<Props> = ({ settings, costs, revenues, stats }) => {
  const equity = settings.equityContribution || (stats.totalOut * 0.25);
  const roe = equity !== 0 ? (stats.profit / equity) * 100 : 0;

  const getCategoryTotal = (cat: CostCategory) => {
    return costs
      .filter(c => c.category === cat)
      .reduce((acc, curr) => acc + FinanceEngine.calculateLineItemTotal(curr, settings, stats.constructionTotal, stats.totalIn), 0);
  };

  return (
    <div className="bg-white p-12 max-w-4xl mx-auto shadow-2xl print-container border border-slate-200">
      {/* Header */}
      <div className="border-b-4 border-blue-600 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{settings.projectName}</h1>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-xs mt-1">
            {settings.location} | Baseline Feasibility Scenario
          </p>
        </div>
        <div className="text-right">
          <p className="text-blue-600 font-black text-xl">FINANCIAL SUMMARY</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Revenue Section */}
      <section className="mb-10">
        <h2 className="bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 mb-4">
          I. Gross Realisation (Revenue)
        </h2>
        <div className="space-y-2">
          {revenues.map(rev => (
            <div key={rev.id} className="flex justify-between text-sm py-1 border-b border-slate-50">
              <span className="text-slate-600 font-medium">{rev.description} <span className="text-slate-400">({rev.units} Units)</span></span>
              <span className="mono font-semibold">{formatCurrency(rev.units * rev.pricePerUnit)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm py-3 border-t-2 border-slate-200 mt-2">
            <span className="font-bold text-slate-800">Total Gross Realisation (GSR)</span>
            <span className="mono font-bold text-slate-900">{formatCurrency(stats.totalIn)}</span>
          </div>
        </div>
      </section>

      {/* Costs Section */}
      <section className="mb-10">
        <h2 className="bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 mb-4">
          II. Development Outlays
        </h2>
        <div className="space-y-2">
          {[
            { label: 'Land Acquisition & Purchasing', cat: CostCategory.LAND },
            { label: 'Construction Works (Hard Costs)', cat: CostCategory.CONSTRUCTION },
            { label: 'Professional Consultants', cat: CostCategory.CONSULTANTS },
            { label: 'Statutory & Planning Fees', cat: CostCategory.STATUTORY },
            { label: 'Marketing & Agency Commissions', cat: CostCategory.SELLING },
            { label: 'Miscellaneous & Contingency', cat: CostCategory.MISCELLANEOUS },
          ].map(item => (
            <div key={item.label} className="flex justify-between text-sm py-1 border-b border-slate-50">
              <span className="text-slate-600 font-medium">{item.label}</span>
              <span className="mono font-semibold">{formatCurrency(getCategoryTotal(item.cat))}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm py-1 border-b border-slate-50">
            <span className="text-slate-600 font-medium">Financing Costs & Capitalised Interest</span>
            <span className="mono font-semibold">{formatCurrency(getCategoryTotal(CostCategory.FINANCE) + stats.interestTotal)}</span>
          </div>
          
          <div className="flex justify-between text-sm py-4 bg-slate-900 text-white px-4 rounded-lg mt-4">
            <span className="font-bold uppercase tracking-wider">Total Development Cost (TDC)</span>
            <span className="mono font-bold text-lg">{formatCurrency(stats.totalOut)}</span>
          </div>
        </div>
      </section>

      {/* Performance Summary */}
      <section className="mb-10">
        <h2 className="bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 mb-6">
          III. Project Performance Indicators
        </h2>
        
        <div className={`p-6 rounded-xl border-2 mb-8 flex justify-between items-center ${stats.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Net Development Profit</p>
            <p className={`text-4xl font-black ${stats.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(stats.profit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Project Status</p>
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${stats.profit >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
              {stats.profit >= 0 ? 'Viable' : 'Under Hurdle'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Development Margin</p>
            <p className="text-2xl font-bold text-blue-600 mono">{stats.margin.toFixed(2)}%</p>
            <p className="text-[9px] text-slate-500 mt-1 italic">Profit / Total Development Cost</p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Internal Rate of Return (IRR)</p>
            <p className="text-2xl font-bold text-blue-600 mono">{stats.irr.toFixed(2)}%</p>
            <p className="text-[9px] text-slate-500 mt-1 italic">Monthly DCF Basis</p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Return on Equity (ROE)</p>
            <p className="text-2xl font-bold text-blue-600 mono">{roe.toFixed(2)}%</p>
            <p className="text-[9px] text-slate-500 mt-1 italic">Profit / Equity Contribution</p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Net Present Value (NPV)</p>
            <p className="text-2xl font-bold text-blue-600 mono">{formatCurrency(stats.npv)}</p>
            <p className="text-[9px] text-slate-500 mt-1 italic">Discounted at {settings.discountRate}%</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-6 mt-12 text-center">
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          DevFeas Pro | Advanced Property Feasibility Suite | Strict Confidentiality
        </p>
        <p className="text-[7px] text-slate-300 italic">
          Disclaimer: This report is a financial model based on project assumptions. Final verification required before capital allocation.
        </p>
      </div>
    </div>
  );
};
