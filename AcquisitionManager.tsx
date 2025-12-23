
import React, { useMemo, useState, useEffect } from 'react';
import { FeasibilitySettings, AcquisitionSettings, LineItem, RevenueItem, SiteDNA, TaxConfiguration } from './types';
import { FinanceEngine } from './services/financeEngine';
import { SolverService } from './services/solverService';
import { DEFAULT_TAX_SCALES } from './constants';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (settings: FeasibilitySettings) => void;
  // New props required for Solver
  costs?: LineItem[];
  revenues?: RevenueItem[];
  siteDNA?: SiteDNA;
  taxScales?: TaxConfiguration;
}

export const AcquisitionManager: React.FC<Props> = ({ settings, onUpdate, costs = [], revenues = [], siteDNA, taxScales = DEFAULT_TAX_SCALES }) => {
  const { acquisition } = settings;
  
  // Solver State
  const [solveMode, setSolveMode] = useState(false);
  const [solverTarget, setSolverTarget] = useState(20); // Default 20%
  const [solverMetric, setSolverMetric] = useState<'margin' | 'irr'>('margin');
  const [isSolving, setIsSolving] = useState(false);

  const updateField = (field: keyof AcquisitionSettings, value: any) => {
    onUpdate({
      ...settings,
      acquisition: {
        ...acquisition,
        [field]: value
      }
    });
  };

  // Derived Calculations for Preview
  const metrics = useMemo(() => {
    const depositAmount = acquisition.purchasePrice * (acquisition.depositPercent / 100);
    const loanBalance = acquisition.purchasePrice - depositAmount;
    
    // Use Global Tax Scales for calculation (passing override if present)
    const duty = FinanceEngine.calculateStampDuty(
        acquisition.purchasePrice, 
        acquisition.stampDutyState, 
        acquisition.isForeignBuyer,
        taxScales,
        acquisition.stampDutyOverride
    );
    
    const agentFee = acquisition.purchasePrice * (acquisition.buyersAgentFee / 100);
    const totalAcqCosts = acquisition.purchasePrice + duty + agentFee + acquisition.legalFeeEstimate;
    
    // Calculate the "Standard" duty without override for comparison
    const standardDuty = FinanceEngine.calculateStampDuty(
        acquisition.purchasePrice, 
        acquisition.stampDutyState, 
        acquisition.isForeignBuyer,
        taxScales,
        undefined
    );

    return { depositAmount, loanBalance, duty, agentFee, totalAcqCosts, standardDuty };
  }, [acquisition, taxScales]);

  // Solver Effect
  useEffect(() => {
      if (solveMode && siteDNA) {
          setIsSolving(true);
          const timer = setTimeout(() => {
              try {
                  const result = SolverService.solveForResidualLandValue(
                      solverTarget,
                      solverMetric,
                      settings,
                      costs,
                      revenues,
                      siteDNA
                  );
                  
                  if (result.success && result.landValue !== acquisition.purchasePrice) {
                      updateField('purchasePrice', result.landValue);
                  }
              } catch (e) {
                  console.error("Solver error", e);
              } finally {
                  setIsSolving(false);
              }
          }, 300); // Debounce
          return () => clearTimeout(timer);
      }
  }, [solveMode, solverTarget, solverMetric, costs, revenues]); // Note: excluding settings to avoid loop, we assume user changes target or costs to trigger

  const isManualDuty = acquisition.stampDutyOverride !== undefined && acquisition.stampDutyOverride !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300 relative">
      
      {/* Left: Deal Inputs */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           
           {/* Header - Reddish Tint for Cost/Outflow context */}
           <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-orange-950">Deal Terms</h3>
                <p className="text-xs text-orange-700/70">Purchase price and settlement timeline</p>
              </div>
              
              {/* Solver Toggle */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                  <button 
                    onClick={() => setSolveMode(false)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!solveMode ? 'bg-slate-100 text-slate-700 shadow-sm' : 'text-slate-400'}`}
                  >
                    Fixed Price
                  </button>
                  <button 
                    onClick={() => setSolveMode(true)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all flex items-center ${solveMode ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 hover:bg-indigo-50'}`}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Solve
                  </button>
              </div>
           </div>
           
           <div className="p-6 space-y-5 relative">
              {/* Solver Overlay / Context */}
              {solveMode && (
                  <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-bold text-indigo-500 uppercase">Target Metric</label>
                          {isSolving && <span className="text-[9px] font-bold text-indigo-400 animate-pulse">Calculating Max Price...</span>}
                      </div>
                      <div className="flex space-x-4">
                          <div className="flex bg-white rounded p-1 border border-indigo-100">
                              <button 
                                onClick={() => setSolverMetric('margin')} 
                                className={`px-3 py-1 rounded text-[10px] font-bold ${solverMetric === 'margin' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}
                              >Margin %</button>
                              <button 
                                onClick={() => setSolverMetric('irr')} 
                                className={`px-3 py-1 rounded text-[10px] font-bold ${solverMetric === 'irr' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}
                              >IRR %</button>
                          </div>
                          <div className="relative flex-1">
                              <input 
                                type="number" 
                                value={solverTarget}
                                onChange={(e) => setSolverTarget(parseFloat(e.target.value))}
                                className="w-full border-indigo-200 rounded px-2 py-1.5 font-bold text-indigo-900 text-sm focus:ring-indigo-500"
                              />
                              <span className="absolute right-2 top-1.5 text-xs font-bold text-indigo-300">%</span>
                          </div>
                      </div>
                  </div>
              )}

              <div>
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {solveMode ? 'Residual Land Value (Calculated)' : 'Purchase Price'}
                 </label>
                 <div className="relative">
                    <span className={`absolute left-3 top-2.5 font-bold text-lg ${solveMode ? 'text-indigo-400' : 'text-slate-400'}`}>$</span>
                    <input 
                      type="number" 
                      value={Math.round(acquisition.purchasePrice)} // Round for cleaner display in solve mode
                      readOnly={solveMode}
                      onChange={(e) => !solveMode && updateField('purchasePrice', parseFloat(e.target.value))}
                      className={`w-full pl-8 pr-4 py-2 border rounded-lg font-mono text-lg font-bold focus:ring-2 transition-colors ${
                          solveMode 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 focus:ring-indigo-500 cursor-not-allowed' 
                          : 'bg-white border-slate-200 text-slate-900 focus:ring-blue-500'
                      }`}
                    />
                    {solveMode && (
                        <div className="absolute right-3 top-3 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                            RLV
                        </div>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deposit %</label>
                    <div className="relative">
                        <input 
                          type="number" 
                          value={acquisition.depositPercent}
                          onChange={(e) => updateField('depositPercent', parseFloat(e.target.value))}
                          className="w-full pr-8 py-2 border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Settlement Period</label>
                    <div className="relative">
                        <input 
                          type="number" 
                          value={acquisition.settlementPeriod}
                          onChange={(e) => updateField('settlementPeriod', parseFloat(e.target.value))}
                          className="w-full pr-16 py-2 border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">Months</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-100">
              <h3 className="font-bold text-orange-950">Buyer Profile & Fees</h3>
              <p className="text-xs text-orange-700/70">Stamp duty and acquisition costs</p>
           </div>
           
           <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State (Duty)</label>
                    <select 
                      value={acquisition.stampDutyState}
                      onChange={(e) => updateField('stampDutyState', e.target.value)}
                      className="w-full border-slate-200 rounded-lg font-bold text-slate-700"
                    >
                       <option value="VIC">Victoria</option>
                       <option value="NSW">New South Wales</option>
                       <option value="QLD">Queensland</option>
                    </select>
                 </div>
                 <div className="flex items-end pb-2">
                    <label className="flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={acquisition.isForeignBuyer}
                         onChange={(e) => updateField('isForeignBuyer', e.target.checked)}
                         className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                       />
                       <span className="ml-2 text-xs font-bold text-slate-700">Foreign Buyer</span>
                    </label>
                 </div>
              </div>

              {/* Stamp Duty Display / Override */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Stamp Duty Calculation</label>
                      <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Manual Override</span>
                          <div 
                            onClick={() => updateField('stampDutyOverride', isManualDuty ? undefined : metrics.standardDuty)}
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${isManualDuty ? 'bg-blue-500' : 'bg-slate-300'}`}
                          >
                             <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${isManualDuty ? 'translate-x-4' : ''}`}></div>
                          </div>
                      </div>
                  </div>
                  
                  {isManualDuty ? (
                      <div className="relative">
                          <input 
                             type="number" 
                             value={acquisition.stampDutyOverride} 
                             onChange={(e) => updateField('stampDutyOverride', parseFloat(e.target.value))}
                             className="w-full border-blue-200 rounded font-bold text-slate-800 bg-white"
                          />
                          <p className="text-[9px] text-blue-600 mt-1 italic">
                              Overriding standard calculated duty of ${(metrics.standardDuty).toLocaleString()}
                          </p>
                      </div>
                  ) : (
                      <div className="flex items-baseline space-x-2">
                          <span className="text-lg font-bold font-mono text-slate-800">${Math.round(metrics.duty).toLocaleString()}</span>
                          <span className="text-xs text-slate-400">Auto-Calculated ({acquisition.stampDutyState})</span>
                      </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duty Payment</label>
                    <select 
                      value={acquisition.stampDutyTiming || 'SETTLEMENT'}
                      onChange={(e) => updateField('stampDutyTiming', e.target.value)}
                      className="w-full border-slate-200 rounded-lg font-bold text-slate-700 text-sm"
                    >
                       <option value="EXCHANGE">At Exchange (Day 1)</option>
                       <option value="SETTLEMENT">At Settlement</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Legal Fees ($)</label>
                    <input 
                      type="number" 
                      value={acquisition.legalFeeEstimate}
                      onChange={(e) => updateField('legalFeeEstimate', parseFloat(e.target.value))}
                      className="w-full border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Right: Cashflow Visualizer */}
      <div className="space-y-6">
         <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
               <i className="fa-solid fa-money-bill-transfer text-9xl"></i>
            </div>
            
            <h3 className="text-lg font-bold mb-6 relative z-10">Cashflow Impact</h3>
            
            <div className="space-y-8 relative z-10">
               {/* Month 0 */}
               <div className="relative pl-8 border-l-2 border-slate-700 pb-8">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-slate-900"></div>
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest block mb-1">Month 0 (Exchange)</span>
                        <div className="text-2xl font-bold mb-1">${(metrics.depositAmount/1000).toLocaleString()}k</div>
                        <p className="text-xs text-slate-400">Equity Injection (Deposit)</p>
                     </div>
                     <div className="text-right">
                        {acquisition.stampDutyTiming === 'EXCHANGE' && (
                            <div className="mb-2">
                                <div className="text-sm font-bold text-amber-400 mb-0.5">+ ${(metrics.duty/1000).toFixed(0)}k</div>
                                <p className="text-[10px] text-slate-500 uppercase">Stamp Duty (Early)</p>
                            </div>
                        )}
                        <div className="text-sm font-bold text-slate-300 mb-1">+ ${(acquisition.legalFeeEstimate/1000).toFixed(1)}k</div>
                        <p className="text-[10px] text-slate-500 uppercase">Legal Fees</p>
                     </div>
                  </div>
               </div>

               {/* Month X */}
               <div className="relative pl-8 border-l-2 border-slate-700">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-blue-400 font-bold text-xs uppercase tracking-widest block mb-1">Month {acquisition.settlementPeriod} (Settlement)</span>
                        <div className="text-2xl font-bold mb-1">${(metrics.loanBalance/1000000).toFixed(2)}m</div>
                        <p className="text-xs text-slate-400">Funded by Senior Debt</p>
                     </div>
                     <div className="text-right space-y-3">
                        {acquisition.stampDutyTiming !== 'EXCHANGE' && (
                            <div>
                                <div className="text-sm font-bold text-slate-300 mb-0.5">+ ${(metrics.duty/1000).toFixed(0)}k</div>
                                <p className="text-[10px] text-slate-500 uppercase">Stamp Duty</p>
                            </div>
                        )}
                        {metrics.agentFee > 0 && (
                           <div>
                              <div className="text-sm font-bold text-slate-300 mb-0.5">+ ${(metrics.agentFee/1000).toFixed(1)}k</div>
                              <p className="text-[10px] text-slate-500 uppercase">Buyer's Agent</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Total Acquisition Costs</h4>
            <div className="flex items-baseline space-x-2">
               <span className="text-3xl font-black text-slate-800">${(metrics.totalAcqCosts/1000000).toFixed(3)}m</span>
               <span className="text-sm font-bold text-slate-500">inc. Duty & Fees</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden flex">
               <div className="bg-slate-800 h-full" style={{ width: `${(acquisition.purchasePrice / metrics.totalAcqCosts) * 100}%` }}></div>
               <div className="bg-blue-500 h-full" style={{ width: `${(metrics.duty / metrics.totalAcqCosts) * 100}%` }}></div>
               <div className="bg-emerald-500 h-full flex-1"></div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase">
               <div className="flex items-center"><div className="w-2 h-2 bg-slate-800 rounded mr-1"></div>Price</div>
               <div className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded mr-1"></div>Duty</div>
               <div className="flex items-center"><div className="w-2 h-2 bg-emerald-500 rounded mr-1"></div>Fees</div>
            </div>
         </div>
      </div>

    </div>
  );
};
