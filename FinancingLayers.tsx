import React from 'react';
import { FeasibilitySettings, DebtLimitMethod } from './types';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (newSettings: FeasibilitySettings) => void;
  peakEquityRequired?: number; // Passed from parent stats
}

// Extracted to prevent re-creation on render (fixes focus loss) and typing issues
const InputGroup = ({ label, children, tooltip }: { label: string, children?: React.ReactNode, tooltip?: string }) => (
  <div className="mb-3 group relative">
    <div className="flex items-center mb-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</label>
      {tooltip && (
        <div className="ml-1 cursor-help relative group/tip">
          <i className="fa-solid fa-circle-info text-slate-400 text-[10px]"></i>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
          </div>
        </div>
      )}
    </div>
    {children}
  </div>
);

export const FinancingLayers: React.FC<Props> = ({ settings, onUpdate, peakEquityRequired = 0 }) => {
  const { capitalStack } = settings;

  const updateTier = (tier: 'senior' | 'mezzanine', field: string, value: any) => {
    const newStack = {
      ...capitalStack,
      [tier]: {
        ...capitalStack[tier],
        [field]: value
      }
    };
    onUpdate({ ...settings, capitalStack: newStack });
  };

  const updateEquity = (value: number) => {
    onUpdate({
      ...settings,
      capitalStack: {
        ...capitalStack,
        equity: {
            ...capitalStack.equity,
            initialContribution: value
        }
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      
      {/* 1. Senior Debt Facility */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-blue-400">
               <i className="fa-solid fa-landmark text-lg"></i>
            </div>
            <div>
               <h3 className="font-bold text-sm leading-tight">Senior Debt</h3>
               <p className="text-[10px] text-slate-400 font-medium">1st Mortgage Facility</p>
            </div>
          </div>
          <span className="text-[9px] bg-blue-600 px-2 py-0.5 rounded text-white font-bold uppercase tracking-wider">Priority 1</span>
        </div>
        
        <div className="p-5 flex-1 flex flex-col">
           <div className="grid grid-cols-2 gap-4 mb-2">
              <InputGroup label="Interest Rate" tooltip="Annual Interest Rate (Nominal)">
                 <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.senior.interestRate}
                     onChange={(e) => updateTier('senior', 'interestRate', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                   />
                   <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                 </div>
              </InputGroup>
              <InputGroup label="Line Fee" tooltip="Annual fee charged on the Facility Limit">
                 <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.senior.lineFeePct || 0}
                     onChange={(e) => updateTier('senior', 'lineFeePct', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                   />
                   <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                 </div>
              </InputGroup>
           </div>

           <div className="mb-4 pt-4 border-t border-dashed border-slate-200">
              <InputGroup label="Limit Method" tooltip="Define how the max loan amount is constrained">
                 <select
                   value={capitalStack.senior.limitMethod || DebtLimitMethod.FIXED}
                   onChange={(e) => updateTier('senior', 'limitMethod', e.target.value)}
                   className="w-full border border-slate-200 bg-slate-50 rounded-md py-1.5 px-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                 >
                    {Object.values(DebtLimitMethod).map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
              </InputGroup>

              <div className="grid grid-cols-2 gap-4">
                 <InputGroup label={capitalStack.senior.limitMethod === DebtLimitMethod.FIXED ? "Amount ($)" : "Cap (%)"}>
                    <input 
                       type="number" 
                       value={capitalStack.senior.limit || ''}
                       placeholder={capitalStack.senior.limitMethod === DebtLimitMethod.FIXED ? "Unlimited" : "0.00"}
                       onChange={(e) => updateTier('senior', 'limit', parseFloat(e.target.value))}
                       className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                 </InputGroup>
                 <InputGroup label="Active Month" tooltip="Month when Line Fees begin">
                    <input 
                       type="number" 
                       value={capitalStack.senior.activationMonth || 0}
                       onChange={(e) => updateTier('senior', 'activationMonth', parseFloat(e.target.value))}
                       className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                 </InputGroup>
              </div>
           </div>

           <div className="mt-auto bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Capitalise Interest</span>
              <div 
                onClick={() => updateTier('senior', 'isInterestCapitalised', !(capitalStack.senior.isInterestCapitalised !== false))}
                className={`w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${capitalStack.senior.isInterestCapitalised !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${capitalStack.senior.isInterestCapitalised !== false ? 'translate-x-4' : ''}`}></div>
              </div>
           </div>
        </div>
      </div>

      {/* 2. Mezzanine Debt */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        <div className="bg-white p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
               <i className="fa-solid fa-layer-group text-lg"></i>
            </div>
            <div>
               <h3 className="font-bold text-sm text-slate-800 leading-tight">Mezzanine Debt</h3>
               <p className="text-[10px] text-indigo-600 font-medium flex items-center">
                  <i className="fa-solid fa-shield-halved mr-1"></i> Subordinated
               </p>
            </div>
          </div>
          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Priority 2</span>
        </div>
        
        <div className="p-5 flex-1 flex flex-col">
           <div className="grid grid-cols-2 gap-4 mb-2">
              <InputGroup label="Interest Rate">
                 <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.mezzanine.interestRate}
                     onChange={(e) => updateTier('mezzanine', 'interestRate', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                   />
                   <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                 </div>
              </InputGroup>
              <InputGroup label="Estab. Fee" tooltip="% of Facility Limit">
                 <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.mezzanine.establishmentFee}
                     onChange={(e) => updateTier('mezzanine', 'establishmentFee', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 px-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                   />
                   <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">%</span>
                 </div>
              </InputGroup>
           </div>

           <div className="mb-4 pt-4 border-t border-dashed border-slate-200">
               <InputGroup label="Facility Limit (Fixed $)" tooltip="Hard limit for Mezzanine Funding">
                   <div className="relative">
                      <span className="absolute left-2 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input 
                         type="number" 
                         value={capitalStack.mezzanine.limit || ''}
                         placeholder="0"
                         onChange={(e) => updateTier('mezzanine', 'limit', parseFloat(e.target.value))}
                         className="w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-md py-1.5 pl-5 pr-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 placeholder:text-slate-300"
                      />
                   </div>
               </InputGroup>
           </div>

           <div className="mt-auto bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Capitalise Interest</span>
              <div 
                onClick={() => updateTier('mezzanine', 'isInterestCapitalised', !(capitalStack.mezzanine.isInterestCapitalised !== false))}
                className={`w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${capitalStack.mezzanine.isInterestCapitalised !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${capitalStack.mezzanine.isInterestCapitalised !== false ? 'translate-x-4' : ''}`}></div>
              </div>
           </div>
        </div>
      </div>

      {/* 3. Equity (First Loss) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
        <div className="bg-white p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
               <i className="fa-solid fa-coins text-lg"></i>
            </div>
            <div>
               <h3 className="font-bold text-sm text-slate-800 leading-tight">Developer Equity</h3>
               <p className="text-[10px] text-emerald-600 font-medium">First Loss Capital</p>
            </div>
          </div>
          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Priority 3</span>
        </div>

        <div className="p-5 flex-1 flex flex-col">
           <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100 mb-6">
              <InputGroup label="Initial Contribution">
                 <div className="relative">
                     <span className="absolute left-3 top-2 text-emerald-600 font-bold">$</span>
                     <input 
                       type="number" 
                       value={capitalStack.equity.initialContribution}
                       onChange={(e) => updateEquity(parseFloat(e.target.value))}
                       className="w-full border-2 border-emerald-100 rounded-lg py-2 pl-7 pr-3 text-lg font-black text-emerald-900 focus:outline-none focus:border-emerald-400 bg-white"
                     />
                 </div>
              </InputGroup>
              
              <div className="flex justify-between items-center mt-2 px-1">
                 <span className="text-[10px] font-bold uppercase text-slate-400">Peak Requirement</span>
                 <span className={`text-xs font-bold font-mono ${peakEquityRequired > capitalStack.equity.initialContribution ? 'text-red-500' : 'text-slate-600'}`}>
                    ${(peakEquityRequired / 1000000).toFixed(2)}m
                 </span>
              </div>
           </div>

           <div className="mt-auto space-y-3">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 font-medium">Hurdle Rate (IRR)</span>
                 <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-700">{settings.discountRate}%</span>
                    <i className="fa-solid fa-circle-check text-emerald-500"></i>
                 </div>
              </div>
              <p className="text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-3">
                Equity funds all initial costs until debt activation. Repaid last from Net Proceeds.
              </p>
           </div>
        </div>
      </div>

    </div>
  );
};