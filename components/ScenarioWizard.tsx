
import React, { useState } from 'react';
import { FeasibilityScenario, ScenarioStatus } from '../types';
import { BASE_SELL_TEMPLATE, BASE_HOLD_TEMPLATE } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (scenario: FeasibilityScenario) => void;
  projectName: string;
}

export const ScenarioWizard: React.FC<Props> = ({ isOpen, onClose, onCreate, projectName }) => {
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<'SELL' | 'HOLD'>('SELL');

  if (!isOpen) return null;

  const handleCreate = () => {
    // 1. Select Template based on Strategy
    const template = strategy === 'SELL' ? BASE_SELL_TEMPLATE : BASE_HOLD_TEMPLATE;
    
    // 2. Deep Copy & Override Metadata
    const newScenario: FeasibilityScenario = {
      ...JSON.parse(JSON.stringify(template)),
      id: `scen-${Date.now()}`,
      name: name || (strategy === 'SELL' ? 'New Trading Scenario' : 'New Hold Scenario'),
      lastModified: new Date().toISOString(),
      isBaseline: false, // New scenarios are never baseline by default
      status: ScenarioStatus.DRAFT,
      strategy: strategy
    };

    // 3. Ensure Project Name consistency
    newScenario.settings.projectName = projectName;

    onCreate(newScenario);
    onClose();
    // Reset state for next time
    setName('');
    setStrategy('SELL');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-white">
           <h2 className="text-xl font-black text-slate-800 tracking-tight">Create Feasibility Scenario</h2>
           <p className="text-sm text-slate-500 mt-1">Select a financial model template to begin analysis.</p>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto">
           
           {/* Name Input */}
           <div className="mb-8">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Scenario Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. Option B - ${strategy === 'SELL' ? 'Townhouses' : 'Build to Rent'}`}
                className="w-full text-lg font-bold border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                autoFocus
              />
           </div>

           {/* Strategy Cards */}
           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select Strategy</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 
                 {/* SELL CARD */}
                 <div 
                   onClick={() => setStrategy('SELL')}
                   className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col group ${
                     strategy === 'SELL' 
                     ? 'border-blue-500 bg-blue-50/50 shadow-md scale-[1.02]' 
                     : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                   }`}
                 >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                        strategy === 'SELL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-blue-500'
                    }`}>
                        <i className="fa-solid fa-money-bill-transfer text-xl"></i>
                    </div>
                    <div className="flex justify-between items-start">
                        <h3 className={`font-bold text-lg mb-1 ${strategy === 'SELL' ? 'text-blue-700' : 'text-slate-700'}`}>Develop & Sell</h3>
                        {strategy === 'SELL' && <i className="fa-solid fa-circle-check text-blue-600 text-xl"></i>}
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Traditional trading model. Revenue driven by gross realisation from unit sales.
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">Margin on Cost</span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">Sales Comm.</span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">GST</span>
                    </div>
                 </div>

                 {/* HOLD CARD */}
                 <div 
                   onClick={() => setStrategy('HOLD')}
                   className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col group ${
                     strategy === 'HOLD' 
                     ? 'border-indigo-500 bg-indigo-50/50 shadow-md scale-[1.02]' 
                     : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                   }`}
                 >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                        strategy === 'HOLD' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-500'
                    }`}>
                        <i className="fa-solid fa-building-user text-xl"></i>
                    </div>
                    <div className="flex justify-between items-start">
                        <h3 className={`font-bold text-lg mb-1 ${strategy === 'HOLD' ? 'text-indigo-700' : 'text-slate-700'}`}>Develop & Hold</h3>
                        {strategy === 'HOLD' && <i className="fa-solid fa-circle-check text-indigo-600 text-xl"></i>}
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Investment model (BTR). Revenue driven by recurring rental yield and capital growth.
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">10-Yr IRR</span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">Refinance</span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-slate-200 text-slate-600">Depreciation</span>
                    </div>
                 </div>

              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
           <button 
             onClick={onClose}
             className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={handleCreate}
             className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-95 flex items-center ${
                strategy === 'SELL' 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
             }`}
           >
             <i className="fa-solid fa-plus mr-2"></i> Create Model
           </button>
        </div>

      </div>
    </div>
  );
};
