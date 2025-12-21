
import React, { useState } from 'react';
import { 
  FeasibilitySettings, DebtLimitMethod, InterestRateMode, FeeBase, EquityMode, 
  CapitalTier, DatedRate, DatedAmount
} from './types';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (newSettings: FeasibilitySettings) => void;
  peakEquityRequired?: number;
}

// --- Extracted Components ---

const VariableRateTable = ({ rates, onChange }: { rates: DatedRate[], onChange: (r: DatedRate[]) => void }) => {
  const addRate = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const lastMonth = rates.length > 0 ? rates[rates.length-1].month : 0;
    onChange([...rates, { id: newId, month: lastMonth + 1, rate: 0 }]);
  };

  const updateRow = (id: string, field: 'month' | 'rate', val: number) => {
    onChange(rates.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const removeRow = (id: string) => {
    onChange(rates.filter(r => r.id !== id));
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
      <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Rate Schedule</span>
        <button onClick={addRate} className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 flex items-center">
          <i className="fa-solid fa-plus mr-1"></i> Add Change
        </button>
      </div>
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Month Index</th>
            <th className="px-3 py-2 font-medium">Interest Rate %</th>
            <th className="px-1 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rates.length === 0 && (
             <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No variable rates. Base rate applies.</td></tr>
          )}
          {rates.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-1">
                <div className="flex items-center">
                  <i className="fa-solid fa-calendar text-slate-400 mr-2 text-xs"></i>
                  <input type="number" min="0" value={r.month} onChange={e => updateRow(r.id, 'month', parseInt(e.target.value))} className="w-16 border-slate-200 rounded text-xs font-mono"/>
                </div>
              </td>
              <td className="px-3 py-1">
                <input type="number" step="0.1" value={r.rate} onChange={e => updateRow(r.id, 'rate', parseFloat(e.target.value))} className="w-16 border-slate-200 rounded text-xs font-bold text-slate-700"/>
              </td>
              <td className="px-1 py-1 text-right">
                 <button onClick={() => removeRow(r.id)} className="text-slate-300 hover:text-red-500 p-1"><i className="fa-solid fa-trash text-xs"></i></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InstalmentsTable = ({ instalments, onChange }: { instalments: DatedAmount[], onChange: (i: DatedAmount[]) => void }) => {
  const addRow = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    onChange([...instalments, { id: newId, month: 0, amount: 0 }]);
  };
  const updateRow = (id: string, field: 'month' | 'amount', val: number) => {
    onChange(instalments.map(i => i.id === id ? { ...i, [field]: val } : i));
  };
  const removeRow = (id: string) => {
    onChange(instalments.filter(i => i.id !== id));
  };

  return (
     <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
       <div className="bg-emerald-50/50 px-3 py-2 flex justify-between items-center border-b border-emerald-100">
         <span className="text-[10px] font-bold text-emerald-600 uppercase">Injection Schedule</span>
         <button onClick={addRow} className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 flex items-center">
           <i className="fa-solid fa-plus mr-1"></i> Add Instalment
         </button>
       </div>
       <table className="w-full text-xs text-left">
         <thead className="bg-white text-slate-400">
           <tr>
             <th className="px-3 py-2 font-medium">Month Index</th>
             <th className="px-3 py-2 font-medium">Amount ($)</th>
             <th className="px-1 py-2"></th>
           </tr>
         </thead>
         <tbody className="divide-y divide-slate-100 bg-white">
           {instalments.map(item => (
             <tr key={item.id}>
               <td className="px-3 py-1">
                 <input type="number" min="0" value={item.month} onChange={e => updateRow(item.id, 'month', parseInt(e.target.value))} className="w-16 border-slate-200 rounded text-xs"/>
               </td>
               <td className="px-3 py-1">
                 <input type="number" value={item.amount} onChange={e => updateRow(item.id, 'amount', parseFloat(e.target.value))} className="w-28 border-slate-200 rounded text-xs font-mono"/>
               </td>
               <td className="px-1 py-1 text-right">
                 <button onClick={() => removeRow(item.id)} className="text-slate-300 hover:text-red-500 p-1"><i className="fa-solid fa-trash text-xs"></i></button>
               </td>
             </tr>
           ))}
         </tbody>
       </table>
     </div>
  );
};

const DebtTab = ({ 
  tier, 
  type, 
  onUpdate 
}: { 
  tier: CapitalTier, 
  type: 'senior' | 'mezzanine', 
  onUpdate: (field: keyof CapitalTier, value: any) => void 
}) => {
   const color = type === 'senior' ? 'blue' : 'indigo';
   const label = type === 'senior' ? 'Senior Debt' : 'Mezzanine Debt';
   const iconClass = type === 'senior' ? 'fa-building-columns' : 'fa-layer-group';
   
   return (
     <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <div className={`p-4 rounded-lg bg-${color}-50 border border-${color}-100 mb-6 flex items-center justify-between`}>
           <div className="flex items-center space-x-3 text-slate-700">
              <div className={`w-8 h-8 rounded bg-white flex items-center justify-center text-${color}-600 shadow-sm`}>
                 <i className={`fa-solid ${iconClass} text-lg`}></i>
              </div>
              <div>
                 <h3 className="font-bold text-sm">{label}</h3>
                 <p className="text-[10px] opacity-70 uppercase tracking-wider">{type === 'senior' ? '1st Mortgage' : 'Subordinated'}</p>
              </div>
           </div>
           
           <div className="flex items-center bg-white px-3 py-1.5 rounded-md shadow-sm border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">Capitalise Interest</span>
              <div 
                 onClick={() => onUpdate('isInterestCapitalised', !(tier.isInterestCapitalised !== false))}
                 className={`w-8 h-4 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${tier.isInterestCapitalised !== false ? `bg-${color}-500` : 'bg-slate-300'}`}
              >
                 <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${tier.isInterestCapitalised !== false ? 'translate-x-4' : ''}`}></div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
           {/* Left Column: Interest */}
           <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 pb-1 border-b border-slate-200">Interest Configuration</h4>
              
              <div className="mb-4">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate Mode</label>
                 <select 
                    value={tier.rateMode}
                    onChange={e => onUpdate('rateMode', e.target.value)}
                    className="w-full text-xs border-slate-200 rounded-md focus:ring-blue-500"
                 >
                    {Object.values(InterestRateMode).map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
              </div>

              {tier.rateMode === InterestRateMode.SINGLE ? (
                 <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Annual Interest Rate</label>
                    <div className="relative">
                       <input 
                          type="number" step="0.01" 
                          value={tier.interestRate}
                          onChange={e => onUpdate('interestRate', parseFloat(e.target.value))}
                          className="w-full border-slate-200 rounded-md py-1.5 px-3 text-sm font-bold"
                       />
                       <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                 </div>
              ) : (
                 <VariableRateTable 
                    rates={tier.variableRates || []} 
                    onChange={r => onUpdate('variableRates', r)} 
                 />
              )}
              
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Line Fee (On Limit)</label>
                  <div className="relative">
                      <input 
                        type="number" step="0.01" 
                        value={tier.lineFee || 0}
                        onChange={e => onUpdate('lineFee', parseFloat(e.target.value))}
                        className="w-full border-slate-200 rounded-md py-1.5 px-3 text-sm font-bold"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                  </div>
              </div>
           </div>

           {/* Right Column: Fees & Limits */}
           <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 pb-1 border-b border-slate-200">Facility Settings</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Limit Calculation</label>
                    <select 
                       value={tier.limitMethod || DebtLimitMethod.FIXED}
                       onChange={e => onUpdate('limitMethod', e.target.value)}
                       className="w-full text-xs border-slate-200 rounded-md"
                    >
                       {Object.values(DebtLimitMethod).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{tier.limitMethod === DebtLimitMethod.FIXED ? 'Amount' : 'Cap %'}</label>
                    <input 
                       type="number" 
                       value={tier.limit || ''}
                       placeholder={tier.limitMethod === DebtLimitMethod.FIXED ? 'Unlimited' : '0.00'}
                       onChange={e => onUpdate('limit', parseFloat(e.target.value))}
                       className="w-full border-slate-200 rounded-md py-1.5 px-2 text-sm font-bold"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Activation Month</label>
                    <input 
                       type="number" 
                       value={tier.activationMonth || 0}
                       onChange={e => onUpdate('activationMonth', parseFloat(e.target.value))}
                       className="w-full border-slate-200 rounded-md py-1.5 px-2 text-sm font-bold"
                    />
                 </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Establishment Fee</label>
                  <div className="flex space-x-2 mb-2">
                     <button 
                       onClick={() => onUpdate('establishmentFeeBase', FeeBase.PERCENT)}
                       className={`flex-1 py-1 text-[10px] font-bold rounded ${tier.establishmentFeeBase === FeeBase.PERCENT ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                     >% of Limit</button>
                     <button 
                       onClick={() => onUpdate('establishmentFeeBase', FeeBase.FIXED)}
                       className={`flex-1 py-1 text-[10px] font-bold rounded ${tier.establishmentFeeBase === FeeBase.FIXED ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                     >Fixed $</button>
                  </div>
                  <input 
                     type="number" 
                     value={tier.establishmentFee} 
                     onChange={e => onUpdate('establishmentFee', parseFloat(e.target.value))}
                     className="w-full border-slate-200 rounded-md py-1.5 px-2 text-sm font-bold bg-white"
                  />
              </div>
           </div>
        </div>
     </div>
   );
};

// --- Main Component ---

export const FinanceSettings: React.FC<Props> = ({ settings, onUpdate, peakEquityRequired = 0 }) => {
  const [activeTab, setActiveTab] = useState<'senior' | 'mezz' | 'equity'>('senior');
  const { capitalStack } = settings;

  const updateTier = (tier: 'senior' | 'mezzanine', field: keyof CapitalTier, value: any) => {
    onUpdate({
      ...settings,
      capitalStack: {
        ...capitalStack,
        [tier]: { ...capitalStack[tier], [field]: value }
      }
    });
  };

  const updateEquity = (field: string, value: any) => {
    onUpdate({
      ...settings,
      capitalStack: {
        ...capitalStack,
        equity: { ...capitalStack.equity, [field]: value }
      }
    });
  };

  const updateSurplusRate = (rate: number) => {
    onUpdate({
      ...settings,
      capitalStack: { ...capitalStack, surplusInterestRate: rate }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Global Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
         <div>
            <h3 className="font-bold text-slate-800">Finance & Capital Stack</h3>
            <p className="text-xs text-slate-500">Configure debt facilities, interest rates and equity injection.</p>
         </div>
         <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Surplus Funds Rate</span>
            <input 
               type="number" 
               value={capitalStack.surplusInterestRate} 
               onChange={e => updateSurplusRate(parseFloat(e.target.value))}
               className="w-16 border-none bg-slate-50 rounded text-xs font-bold text-right p-0 focus:ring-0" 
            />
            <span className="text-xs font-bold text-slate-400">%</span>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
         <button 
           onClick={() => setActiveTab('senior')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'senior' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
           Senior Debt
         </button>
         <button 
           onClick={() => setActiveTab('mezz')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'mezz' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
           Mezzanine Debt
         </button>
         <button 
           onClick={() => setActiveTab('equity')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'equity' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
           Equity & Injection
         </button>
      </div>

      <div className="p-6 min-h-[400px]">
         {activeTab === 'senior' && (
           <DebtTab 
             tier={capitalStack.senior} 
             type="senior" 
             onUpdate={(f, v) => updateTier('senior', f, v)} 
           />
         )}
         {activeTab === 'mezz' && (
           <DebtTab 
             tier={capitalStack.mezzanine} 
             type="mezzanine" 
             onUpdate={(f, v) => updateTier('mezzanine', f, v)} 
           />
         )}
         
         {activeTab === 'equity' && (
           <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 mb-6 flex items-start justify-between">
                 <div className="flex items-center space-x-3 text-slate-700">
                    <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                       <i className="fa-solid fa-coins text-lg"></i>
                    </div>
                    <div>
                       <h3 className="font-bold text-sm">Developer Equity</h3>
                       <p className="text-[10px] opacity-70 uppercase tracking-wider">First Loss Capital</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Requirement</p>
                    <p className={`text-sm font-black font-mono ${peakEquityRequired > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                      ${(peakEquityRequired / 1000000).toFixed(2)}m
                    </p>
                 </div>
              </div>

              <div className="max-w-2xl">
                 <div className="mb-6">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Injection Method</label>
                    <select 
                      value={capitalStack.equity.mode} 
                      onChange={e => updateEquity('mode', e.target.value)}
                      className="w-full text-sm font-semibold border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5"
                    >
                       {Object.values(EquityMode).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                 </div>

                 {/* Dynamic Content based on Equity Mode */}
                 <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm">
                    
                    {capitalStack.equity.mode === EquityMode.SUM_OF_MONEY && (
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fixed Upfront Contribution</label>
                          <div className="relative">
                             <div className="absolute left-3 top-2 text-slate-400 font-bold">$</div>
                             <input 
                               type="number" 
                               value={capitalStack.equity.initialContribution} 
                               onChange={e => updateEquity('initialContribution', parseFloat(e.target.value))}
                               className="w-full border-slate-200 rounded-lg py-2 pl-6 text-lg font-bold text-emerald-700"
                             />
                          </div>
                          <p className="text-xs text-slate-400 mt-2">
                             This amount is available to draw from Month 0. Any unused equity remains in the pool.
                          </p>
                       </div>
                    )}

                    {capitalStack.equity.mode === EquityMode.INSTALMENTS && (
                       <div>
                          <p className="text-xs text-slate-500 mb-2">Define specific equity injections by month. Amounts are added to the equity pool.</p>
                          <InstalmentsTable 
                             instalments={capitalStack.equity.instalments || []} 
                             onChange={i => updateEquity('instalments', i)} 
                          />
                       </div>
                    )}

                    {(capitalStack.equity.mode === EquityMode.PCT_LAND || capitalStack.equity.mode === EquityMode.PCT_TOTAL_COST) && (
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Percentage Input</label>
                          <div className="relative">
                             <input 
                               type="number" 
                               value={capitalStack.equity.percentageInput} 
                               onChange={e => updateEquity('percentageInput', parseFloat(e.target.value))}
                               className="w-full border-slate-200 rounded-lg py-2 px-3 text-lg font-bold text-emerald-700"
                             />
                             <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">%</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">
                             Equity is calculated as {capitalStack.equity.percentageInput}% of {capitalStack.equity.mode === EquityMode.PCT_LAND ? 'Land Purchase Price' : 'Total Development Costs (excl. Finance)'}.
                          </p>
                       </div>
                    )}

                    {capitalStack.equity.mode === EquityMode.PCT_MONTHLY && (
                       <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pari Passu Percentage</label>
                           <div className="relative">
                             <input 
                               type="number" 
                               value={capitalStack.equity.percentageInput} 
                               onChange={e => updateEquity('percentageInput', parseFloat(e.target.value))}
                               className="w-full border-slate-200 rounded-lg py-2 px-3 text-lg font-bold text-emerald-700"
                             />
                             <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">%</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">
                             Developer funds <strong>{capitalStack.equity.percentageInput}%</strong> of every monthly invoice. Debt funds the remaining <strong>{100 - capitalStack.equity.percentageInput}%</strong>.
                          </p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};
