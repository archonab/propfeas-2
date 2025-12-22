
import React, { useMemo, useState } from 'react';
import { Site, FeasibilityScenario, ScenarioStatus } from '../types';
import { FinanceEngine } from '../services/financeEngine';
import { ScenarioComparison } from '../ScenarioComparison';
import { ScenarioWizard } from './ScenarioWizard';

interface Props {
  site: Site;
  onUpdateSite: (updatedSite: Site) => void;
  onSelectScenario: (scenarioId: string) => void;
  onBack: () => void;
}

interface ScenarioCardProps {
  scenario: FeasibilityScenario;
  site: Site;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// --- Sub-Component: Scenario Card ---
const ScenarioCard: React.FC<ScenarioCardProps> = ({ 
  scenario, 
  site, 
  isSelected, 
  onToggleSelect, 
  onOpen, 
  onDuplicate, 
  onDelete 
}) => {
  
  // Calculate "Quick Look" Metrics on the fly
  const metrics = useMemo(() => {
    const cashflow = FinanceEngine.calculateMonthlyCashflow(scenario, site.dna);
    
    const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
    const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue, 0);
    const profit = totalIn - totalOut;
    const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
    
    const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
    const irr = FinanceEngine.calculateIRR(equityFlows);

    // Determine Strategy Label
    const strategyLabel = scenario.strategy === 'HOLD' ? 'Hold' : 'Sell';
    let strategyColor = 'bg-blue-100 text-blue-700';
    
    if (scenario.strategy === 'HOLD') {
        strategyColor = 'bg-indigo-100 text-indigo-700';
    }

    return { profit, margin, irr, strategyLabel, strategyColor };
  }, [scenario, site.dna]);

  return (
    <div 
      onClick={onOpen}
      className={`group relative bg-white rounded-xl border transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col overflow-hidden ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200 hover:border-blue-300'}`}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
         <div>
            <div className="flex items-center space-x-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${metrics.strategyColor}`}>
                    {metrics.strategyLabel}
                </span>
                {scenario.isBaseline && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Baseline
                    </span>
                )}
            </div>
            <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{scenario.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Updated {new Date(scenario.lastModified).toLocaleDateString()}</p>
         </div>
         
         <div onClick={(e) => e.stopPropagation()}>
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
         </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
         <div className="p-4 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Profit</p>
            <p className="text-sm font-black text-slate-800 mt-1">${(metrics.profit/1000000).toFixed(1)}m</p>
         </div>
         <div className="p-4 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Margin</p>
            <p className={`text-sm font-black mt-1 ${metrics.margin < 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                {metrics.margin.toFixed(1)}%
            </p>
         </div>
         <div className="p-4 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase">IRR</p>
            <p className="text-sm font-black text-indigo-600 mt-1">{metrics.irr.toFixed(1)}%</p>
         </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
         <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center">
            Open Model <i className="fa-solid fa-arrow-right ml-2"></i>
         </span>
         <div className="flex space-x-2">
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-colors shadow-sm" 
                title="Duplicate"
            >
                <i className="fa-solid fa-copy"></i>
            </button>
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-colors shadow-sm" 
                title="Delete"
            >
                <i className="fa-solid fa-trash"></i>
            </button>
         </div>
      </div>
    </div>
  );
};

// --- Main Manager Component ---

export const ScenarioManager: React.FC<Props> = ({ site, onUpdateSite, onSelectScenario, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isComparing, setIsComparing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // --- Handlers ---

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleCreateClick = () => {
    setIsWizardOpen(true);
  };

  const handleWizardCreate = (newScenario: FeasibilityScenario) => {
    onUpdateSite({
        ...site,
        scenarios: [...site.scenarios, newScenario]
    });
  };

  const handleDuplicate = (scenario: FeasibilityScenario) => {
    const newScenario: FeasibilityScenario = {
        ...JSON.parse(JSON.stringify(scenario)), // Deep copy
        id: `scen-${Date.now()}`,
        name: `${scenario.name} (Copy)`,
        lastModified: new Date().toISOString(),
        isBaseline: false
    };
    onUpdateSite({
        ...site,
        scenarios: [...site.scenarios, newScenario]
    });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const newScenarios = site.scenarios.filter(s => s.id !== deleteId);
    onUpdateSite({
        ...site,
        scenarios: newScenarios
    });
    // Remove from selection if deleted
    if (selectedIds.has(deleteId)) {
        const newSet = new Set(selectedIds);
        newSet.delete(deleteId);
        setSelectedIds(newSet);
    }
    setDeleteId(null);
  };

  // Comparison Data
  const scenariosToCompare = site.scenarios
    .filter(s => selectedIds.has(s.id));

  // --- View: Comparison Mode ---
  if (isComparing) {
      return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 animate-in slide-in-from-right-4 duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <button 
                        onClick={() => setIsComparing(false)}
                        className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest"
                    >
                        <i className="fa-solid fa-chevron-left mr-2"></i> Back to Manager
                    </button>
                    <h2 className="text-xl font-black text-slate-800">Scenario Comparison</h2>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <ScenarioComparison scenarios={scenariosToCompare} siteDNA={site.dna} />
                </div>
            </div>
        </div>
      );
  }

  // --- View: Grid Mode ---
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 animate-in fade-in duration-300 relative">
      
      <ScenarioWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        onCreate={handleWizardCreate}
        projectName={site.name}
        existingScenarios={site.scenarios}
      />

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 animate-in zoom-in-95">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4 mx-auto">
                    <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Delete Scenario?</h3>
                <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                    Are you sure you want to permanently delete this feasibility scenario?<br/><strong className="text-slate-700">This action cannot be undone.</strong>
                </p>
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setDeleteId(null)}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors text-xs uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-xs uppercase tracking-wider shadow-md"
                    >
                        Delete Forever
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 1. Site DNA Header (Permanent) */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 shadow-sm z-10">
         <div>
            <div className="flex items-center space-x-2 mb-1">
                <button onClick={onBack} className="text-slate-400 hover:text-blue-600 transition-colors mr-2">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${site.status === 'Acquired' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {site.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 border-l border-slate-200">
                    {site.code}
                </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight">{site.name}</h1>
            <div className="flex items-center text-xs text-slate-500 mt-1 space-x-4">
                <span className="flex items-center"><i className="fa-solid fa-location-dot mr-1.5 opacity-70"></i> {site.dna.address}</span>
                <span className="flex items-center"><i className="fa-solid fa-ruler-combined mr-1.5 opacity-70"></i> {site.dna.landArea.toLocaleString()} sqm</span>
                <span className="flex items-center"><i className="fa-solid fa-building mr-1.5 opacity-70"></i> {site.dna.zoning}</span>
            </div>
         </div>

         <div className="flex space-x-3 w-full md:w-auto">
            <button 
                onClick={() => setIsComparing(true)}
                disabled={selectedIds.size < 2}
                className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-all ${
                    selectedIds.size >= 2 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
            >
                <i className="fa-solid fa-scale-balanced mr-2"></i> Compare ({selectedIds.size})
            </button>
            <button 
                onClick={handleCreateClick}
                className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center transition-all"
            >
                <i className="fa-solid fa-plus mr-2"></i> New Scenario
            </button>
         </div>
      </div>

      {/* 2. Scrollable Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-7xl mx-auto">
            
            {site.scenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-4">
                        <i className="fa-solid fa-calculator text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">No Financial Models Yet</h3>
                    <p className="text-slate-500 text-sm mb-6">Create a scenario to start analyzing feasibility.</p>
                    <button onClick={handleCreateClick} className="text-blue-600 font-bold text-sm hover:underline">
                        Create First Scenario
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Available Options</h3>
                        <span className="text-xs font-medium text-slate-400">Select checkboxes to compare</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {site.scenarios.map(scen => (
                            <ScenarioCard 
                                key={scen.id}
                                scenario={scen}
                                site={site}
                                isSelected={selectedIds.has(scen.id)}
                                onToggleSelect={() => handleToggleSelect(scen.id)}
                                onOpen={() => onSelectScenario(scen.id)}
                                onDuplicate={() => handleDuplicate(scen)}
                                onDelete={() => handleDeleteClick(scen.id)}
                            />
                        ))}
                        
                        {/* "Add New" Ghost Card */}
                        <button 
                            onClick={handleCreateClick}
                            className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-blue-400 hover:bg-blue-50/50 transition-all min-h-[280px]"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors mb-3">
                                <i className="fa-solid fa-plus text-lg"></i>
                            </div>
                            <span className="text-sm font-bold text-slate-500 group-hover:text-blue-600">Add Strategy</span>
                        </button>
                    </div>
                </>
            )}
         </div>
      </div>
    </div>
  );
};
