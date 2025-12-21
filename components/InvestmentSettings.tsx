
import React, { useMemo } from 'react';
import { FeasibilitySettings, RevenueItem } from '../types';

interface Props {
  settings: FeasibilitySettings;
  revenues: RevenueItem[];
  constructionTotal: number;
  onUpdate: (settings: FeasibilitySettings) => void;
}

export const InvestmentSettings: React.FC<Props> = ({ settings, revenues, constructionTotal, onUpdate }) => {
  const { holdStrategy } = settings;
  if (!holdStrategy) return null;

  // Handlers
  const updateStrategy = (field: string, value: any) => {
    onUpdate({
      ...settings,
      holdStrategy: {
        ...holdStrategy,
        [field]: value
      }
    });
  };

  const updateDepreciation = (field: 'capitalWorksPct' | 'plantPct', value: number) => {
    // Clamp between 0 and 100
    const clamped = Math.min(100, Math.max(0, value));
    const otherField = field === 'capitalWorksPct' ? 'plantPct' : 'capitalWorksPct';
    const otherValue = 100 - clamped;

    onUpdate({
      ...settings,
      holdStrategy: {
        ...holdStrategy,
        depreciationSplit: {
          ...holdStrategy.depreciationSplit,
          [field]: clamped,
          [otherField]: otherValue
        }
      }
    });
  };

  // Calculations for Summary
  const summary = useMemo(() => {
    const holdYears = holdStrategy.holdPeriodYears || 10;
    
    // 1. Calculate Current Net Rent (Annual)
    const currentNetRent = revenues
      .filter(r => r.strategy === 'Hold')
      .reduce((acc, r) => {
        const gross = (r.weeklyRent || 0) * 52 * r.units;
        const net = gross * (1 - (r.opexRate || 0) / 100);
        return acc + net;
      }, 0);

    // 2. Estimate Future Terminal Value (Exit Price)
    // Logic: Net Rent / Terminal Cap Rate
    const terminalCap = (holdStrategy.terminalCapRate || 5) / 100;
    const terminalValue = terminalCap > 0 ? currentNetRent / terminalCap : 0;

    return {
      terminalValue,
      holdYears,
      currentNetRent
    };
  }, [revenues, holdStrategy]);

  const { capitalWorksPct, plantPct } = holdStrategy.depreciationSplit || { capitalWorksPct: 85, plantPct: 15 };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 animate-in fade-in slide-in-from-top-4">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                    <i className="fa-solid fa-chart-line"></i>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Long-Term Investment Assumptions</h3>
                    <p className="text-[10px] text-slate-500 font-medium">10-Year DCF & Tax Depreciation Settings</p>
                </div>
            </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* 1. Horizon & Growth */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Horizon & Valuation</h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hold Period</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={holdStrategy.holdPeriodYears}
                                onChange={(e) => updateStrategy('holdPeriodYears', parseFloat(e.target.value))}
                                className="w-full border-slate-200 rounded-md py-1.5 px-3 text-sm font-bold text-slate-700 focus:ring-emerald-500"
                            />
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">Yrs</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cap Growth</label>
                        <div className="relative">
                            <input 
                                type="number" step="0.1"
                                value={holdStrategy.annualCapitalGrowth}
                                onChange={(e) => updateStrategy('annualCapitalGrowth', parseFloat(e.target.value))}
                                className="w-full border-slate-200 rounded-md py-1.5 px-3 text-sm font-bold text-slate-700 focus:ring-emerald-500"
                            />
                            <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">% pa</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Terminal Cap Rate</label>
                    <div className="relative">
                        <input 
                            type="number" step="0.1"
                            value={holdStrategy.terminalCapRate}
                            onChange={(e) => updateStrategy('terminalCapRate', parseFloat(e.target.value))}
                            className="w-full border-slate-200 rounded-md py-1.5 px-3 text-sm font-bold text-emerald-700 focus:ring-emerald-500"
                        />
                        <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 italic">Used to calculate Exit Value in Year {holdStrategy.holdPeriodYears}</p>
                </div>
            </div>

            {/* 2. Depreciation Split */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Tax Depreciation (Cost Split)</h4>
                
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Building (Div 43)</label>
                        <span className="text-xs font-bold text-slate-700">{capitalWorksPct.toFixed(0)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" 
                        value={capitalWorksPct}
                        onChange={(e) => updateDepreciation('capitalWorksPct', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                        Est. Base: ${((constructionTotal * capitalWorksPct)/100 / 1000000).toFixed(2)}m (2.5% p.a.)
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Plant & Equip (Div 40)</label>
                        <span className="text-xs font-bold text-slate-700">{plantPct.toFixed(0)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" 
                        value={plantPct}
                        onChange={(e) => updateDepreciation('plantPct', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                        Est. Base: ${((constructionTotal * plantPct)/100 / 1000000).toFixed(2)}m (Diminishing Value)
                    </div>
                </div>
            </div>

            {/* 3. Future Value Summary */}
            <div className="bg-slate-50 rounded-lg border border-slate-100 p-4 flex flex-col justify-center space-y-4">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Forecast Exit Year</p>
                    <p className="text-sm font-bold text-slate-700">Year {summary.holdYears}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Stabilised Net Income</p>
                    <p className="text-lg font-mono font-bold text-slate-700">
                        ${(summary.currentNetRent / 1000).toLocaleString(undefined, {maximumFractionDigits: 0})}k <span className="text-xs text-slate-400 font-sans">p.a.</span>
                    </p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Est. Terminal Sale Price</p>
                    <p className="text-2xl font-black text-emerald-600 tracking-tight">
                        ${(summary.terminalValue / 1000000).toFixed(2)}m
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">Based on {holdStrategy.terminalCapRate}% Cap Rate</p>
                </div>
            </div>

        </div>
    </div>
  );
};
