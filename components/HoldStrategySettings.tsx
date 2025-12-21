
import React from 'react';
import { FeasibilitySettings, RevenueItem, MonthlyFlow } from '../types';

interface Props {
  settings: FeasibilitySettings;
  revenues: RevenueItem[];
  cashflow: MonthlyFlow[];
  onUpdate: (settings: FeasibilitySettings) => void;
}

export const HoldStrategySettings: React.FC<Props> = ({ settings, revenues, cashflow, onUpdate }) => {
  // Filter for Hold items
  const holdItems = revenues.filter(r => r.strategy === 'Hold');
  if (holdItems.length === 0) return null;

  const { holdStrategy } = settings;
  // Guard against undefined strategy if user switches
  if (!holdStrategy) return null;

  // Calculate Deemed Value
  const totalDeemedValue = holdItems.reduce((acc, item) => {
    const grossAnnual = (item.weeklyRent || 0) * 52 * item.units;
    const netAnnual = grossAnnual * (1 - (item.opexRate || 0) / 100);
    const capRate = (item.capRate || 5) / 100;
    const val = capRate > 0 ? netAnnual / capRate : 0;
    return acc + val;
  }, 0);

  const refiAmount = totalDeemedValue * (holdStrategy.refinanceLvr / 100);

  // Estimate Debt to Clear at Refinance Month
  // We look at the closing balance of the previous month to approximate the opening debt for the refi month
  const refiMonthIndex = Math.min(holdStrategy.refinanceMonth, cashflow.length - 1);
  let currentDebt = 0;
  if (refiMonthIndex > 0) {
      const prevFlow = cashflow[refiMonthIndex - 1];
      if (prevFlow) {
          currentDebt = prevFlow.balanceSenior + prevFlow.balanceMezz;
      }
  } else if (cashflow.length > 0) {
      // Month 0 refi (unlikely but possible)
      currentDebt = 0; 
  }

  const netCash = refiAmount - currentDebt;

  const handleUpdate = (field: string, val: number) => {
      onUpdate({
          ...settings,
          holdStrategy: {
              ...settings.holdStrategy!,
              [field]: val
          }
      });
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Inputs */}
            <div className="flex-1 w-full">
                <div className="flex items-center mb-3">
                    <div className="w-8 h-8 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3 shadow-sm border border-indigo-200">
                        <i className="fa-solid fa-hand-holding-dollar"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-indigo-900">Build-to-Rent Refinance Strategy</h3>
                        <p className="text-[10px] text-indigo-600 font-medium">Configure takeout finance parameters</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase">Refinance Month</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={holdStrategy.refinanceMonth}
                                onChange={(e) => handleUpdate('refinanceMonth', parseFloat(e.target.value))}
                                className="w-full mt-1 border-indigo-200 rounded text-sm font-bold text-indigo-900 focus:ring-indigo-500 py-1.5"
                            />
                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-indigo-300">Mo</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase">Target LVR (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={holdStrategy.refinanceLvr}
                                onChange={(e) => handleUpdate('refinanceLvr', parseFloat(e.target.value))}
                                className="w-full mt-1 border-indigo-200 rounded text-sm font-bold text-indigo-900 focus:ring-indigo-500 py-1.5"
                            />
                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-indigo-300">%</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase">Inv. Rate (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.1"
                                value={holdStrategy.investmentRate || 0}
                                onChange={(e) => handleUpdate('investmentRate', parseFloat(e.target.value))}
                                className="w-full mt-1 border-indigo-200 rounded text-sm font-bold text-indigo-900 focus:ring-indigo-500 py-1.5"
                            />
                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-indigo-300">%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Box */}
            <div className="w-full md:w-auto bg-white rounded-lg border border-indigo-100 p-4 shadow-sm min-w-[280px]">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Deemed Value</span>
                    <span className="text-xs font-bold text-slate-800">${(totalDeemedValue/1000000).toFixed(2)}m</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">New Inv. Loan</span>
                    <span className="text-xs font-bold text-indigo-600">${(refiAmount/1000000).toFixed(2)}m</span>
                </div>
                <div className="w-full h-px bg-slate-100 my-2"></div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Net Cash Release</span>
                    <span className={`text-sm font-black ${netCash >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {netCash >= 0 ? '+' : ''}${(netCash/1000000).toFixed(2)}m
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};
