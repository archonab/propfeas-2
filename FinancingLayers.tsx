
import React from 'react';
import { FeasibilitySettings, CapitalStack } from './types';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (newSettings: FeasibilitySettings) => void;
}

export const FinancingLayers: React.FC<Props> = ({ settings, onUpdate }) => {
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
        equityContribution: value
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* 1. Senior Debt Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center text-white">
          <div className="flex items-center space-x-2">
             <i className="fa-solid fa-building-columns opacity-70"></i>
             <h3 className="font-bold text-sm uppercase tracking-wide">Senior Debt</h3>
          </div>
          <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-bold">Priority 1</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase">Capitalise Interest</label>
            <div 
              onClick={() => updateTier('senior', 'isInterestCapitalised', !(capitalStack.senior.isInterestCapitalised !== false))}
              className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${capitalStack.senior.isInterestCapitalised !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${capitalStack.senior.isInterestCapitalised !== false ? 'translate-x-5' : ''}`}></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Interest Rate</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.senior.interestRate}
                     onChange={(e) => updateTier('senior', 'interestRate', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Line Fee</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.senior.lineFee || 0}
                     onChange={(e) => updateTier('senior', 'lineFee', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Establishment</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.senior.establishmentFee}
                     onChange={(e) => updateTier('senior', 'establishmentFee', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Limit (Optional)</label>
                <input 
                   type="number" 
                   value={capitalStack.senior.limit || ''}
                   placeholder="Unlimited"
                   onChange={(e) => updateTier('senior', 'limit', parseFloat(e.target.value))}
                   className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 placeholder:text-slate-300"
                />
             </div>
          </div>
          
          <div className="pt-2">
             <p className="text-[10px] text-slate-400 italic">
               Funds remaining costs after Equity and Mezzanine are exhausted.
             </p>
          </div>
        </div>
      </div>

      {/* 2. Mezzanine Debt Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-indigo-600 p-4 border-b border-indigo-500 flex justify-between items-center text-white">
          <div className="flex items-center space-x-2">
             <i className="fa-solid fa-layer-group opacity-70"></i>
             <h3 className="font-bold text-sm uppercase tracking-wide">Mezzanine</h3>
          </div>
          <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded text-indigo-100 font-bold">Priority 2</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase">Capitalise Interest</label>
            <div 
              onClick={() => updateTier('mezzanine', 'isInterestCapitalised', !(capitalStack.mezzanine.isInterestCapitalised !== false))}
              className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${capitalStack.mezzanine.isInterestCapitalised !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${capitalStack.mezzanine.isInterestCapitalised !== false ? 'translate-x-5' : ''}`}></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Interest Rate</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.mezzanine.interestRate}
                     onChange={(e) => updateTier('mezzanine', 'interestRate', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Line Fee</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.mezzanine.lineFee || 0}
                     onChange={(e) => updateTier('mezzanine', 'lineFee', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Establishment</label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={capitalStack.mezzanine.establishmentFee}
                     onChange={(e) => updateTier('mezzanine', 'establishmentFee', parseFloat(e.target.value))}
                     className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                   />
                   <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fund Limit</label>
                <input 
                   type="number" 
                   value={capitalStack.mezzanine.limit || ''}
                   placeholder="0"
                   onChange={(e) => updateTier('mezzanine', 'limit', parseFloat(e.target.value))}
                   className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 placeholder:text-slate-300"
                />
             </div>
          </div>
        </div>
      </div>

      {/* 3. Equity Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-emerald-600 p-4 border-b border-emerald-500 flex justify-between items-center text-white">
          <div className="flex items-center space-x-2">
             <i className="fa-solid fa-coins opacity-70"></i>
             <h3 className="font-bold text-sm uppercase tracking-wide">Developer Equity</h3>
          </div>
          <span className="text-[10px] bg-emerald-500 px-2 py-0.5 rounded text-emerald-100 font-bold">Priority 3</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
             <p className="text-xs text-emerald-800 font-medium mb-1">First Loss Capital</p>
             <p className="text-[10px] text-emerald-600">
                Equity is drawn first to fund initial costs. It is repaid last (residual profit).
             </p>
          </div>

          <div>
             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Contribution</label>
             <div className="relative">
                 <div className="absolute left-3 top-2 text-slate-400 font-bold">$</div>
                 <input 
                   type="number" 
                   value={capitalStack.equityContribution}
                   onChange={(e) => updateEquity(parseFloat(e.target.value))}
                   className="w-full border border-slate-200 rounded-lg py-2 pl-6 pr-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                 />
             </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-end mt-4">
             <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
               <span className="text-slate-500 font-medium">Hurdle Rate (IRR)</span>
               <span className="font-bold text-emerald-600">{settings.discountRate}%</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
