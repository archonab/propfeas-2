
import React, { useState } from 'react';
import { FeasibilityScenario, ScenarioStatus } from '../types';
import { BASE_SELL_TEMPLATE, BASE_HOLD_TEMPLATE } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (scenario: FeasibilityScenario) => void;
  projectName: string;
  existingScenarios: FeasibilityScenario[];
}

export const ScenarioWizard: React.FC<Props> = ({ isOpen, onClose, onCreate, projectName, existingScenarios }) => {
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<'SELL' | 'HOLD'>('SELL');
  const [linkedScenarioId, setLinkedScenarioId] = useState<string>('');

  const sellScenarios = existingScenarios.filter(s => s.strategy === 'SELL');

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
      isBaseline: false, 
      status: ScenarioStatus.DRAFT,
      strategy: strategy
    };

    // 3. Link if Hold
    if (strategy === 'HOLD' && linkedScenarioId) {
        newScenario.linkedSellScenarioId = linkedScenarioId;
        // Also copy the projectName to keep it clean
        const linked = sellScenarios.find(s => s.id === linkedScenarioId);
        if (linked) {
            newScenario.settings.projectName = linked.settings.projectName;
        }
    } else {
        newScenario.settings.projectName = projectName;
    }

    onCreate(newScenario);
    onClose();
    // Reset state
    setName('');
    setStrategy('SELL');
    setLinkedScenarioId('');
  };

  const canCreate = strategy === 'SELL' || (strategy === 'HOLD' && linkedScenarioId !== '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="px-8 py-6 border-b border-slate-100 bg-white">
           <h2 className="text-xl font-black text-slate-800 tracking-tight">Create Feasibility Scenario</h2>
           <p className="text-sm text-slate-500 mt-1">Select a financial model template to begin analysis.</p>
        </div>

        <div className="p-8 overflow-y-auto">
           
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
                        Investment model (BTR). Inherits development costs from a SELL scenario.
                    </p>
                 </div>

              </div>
           </div>

           {/* Linked Scenario Selector for HOLD */}
           {strategy === 'HOLD' && (
               <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2">
                   <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Development Basis (Required)</label>
                   {sellScenarios.length > 0 ? (
                       <select 
                         value={linkedScenarioId} 
                         onChange={(e) => setLinkedScenarioId(e.target.value)}
                         className="w-full border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-indigo-50/30"
                       >
                           <option value="">-- Select Development Scenario --</option>
                           {sellScenarios.map(s => (
                               <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                           ))}
                       </select>
                   ) : (
                       <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-center">
                           <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                           No "Develop to Sell" scenarios available. You must create a development model first.
                       </div>
                   )}
                   <p className="text-xs text-slate-400 mt-2 ml-1">
                       The Hold model will dynamically link to the selected development model's acquisition and construction costs.
                   </p>
               </div>
           )}
        </div>

        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
           <button 
             onClick={onClose}
             className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={handleCreate}
             disabled={!canCreate}
             className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-95 flex items-center ${
                !canCreate 
                ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                : strategy === 'SELL' 
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
