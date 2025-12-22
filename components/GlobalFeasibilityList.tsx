
import React, { useMemo, useState } from 'react';
import { useProject } from '../contexts/SiteContext';
import { FeasibilityScenario, Site, ScenarioStatus, LeadStatus } from '../types';
import { FinanceEngine } from '../services/financeEngine';
import { ScenarioComparison } from '../ScenarioComparison';
import { ScenarioWizard } from './ScenarioWizard';

interface EnrichedScenario {
  uniqueKey: string; // combination of siteId + scenarioId
  siteId: string;
  siteName: string;
  siteStatus: LeadStatus;
  siteState: string;
  scenario: FeasibilityScenario;
  metrics: {
    profit: number;
    margin: number;
    irr: number;
    totalCost: number;
  };
}

export const GlobalFeasibilityList: React.FC = () => {
  const { sites, selectSite, selectScenario, addScenario } = useProject();
  
  // --- View State ---
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isComparing, setIsComparing] = useState(false);

  // --- Filter State ---
  const [filterSiteId, setFilterSiteId] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<'ALL' | 'SELL' | 'HOLD'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [minIrr, setMinIrr] = useState<number>(0);

  // --- Creation State ---
  const [isSiteSelectorOpen, setIsSiteSelectorOpen] = useState(false);
  const [targetSiteId, setTargetSiteId] = useState<string>('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // --- 1. Data Processing (Memoized for Performance) ---
  const allScenarios = useMemo<EnrichedScenario[]>(() => {
    const list: EnrichedScenario[] = [];
    
    sites.forEach(site => {
      site.scenarios.forEach(scen => {
        // Calculate Light Metrics on the fly for the table
        const cashflow = FinanceEngine.calculateMonthlyCashflow(scen, site.dna);
        const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
        const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue, 0);
        const profit = totalIn - totalOut;
        const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
        const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
        const irr = FinanceEngine.calculateIRR(equityFlows);

        list.push({
          uniqueKey: `${site.id}::${scen.id}`,
          siteId: site.id,
          siteName: site.name,
          siteStatus: site.status,
          siteState: site.dna.state,
          scenario: scen,
          metrics: { profit, margin, irr, totalCost: totalOut }
        });
      });
    });

    return list.sort((a, b) => new Date(b.scenario.lastModified).getTime() - new Date(a.scenario.lastModified).getTime());
  }, [sites]);

  // --- 2. Filtering ---
  const filteredList = useMemo(() => {
    return allScenarios.filter(item => {
      if (filterSiteId !== 'ALL' && item.siteId !== filterSiteId) return false;
      if (filterStrategy !== 'ALL' && item.scenario.strategy !== filterStrategy) return false;
      if (filterStatus !== 'ALL') {
          // Map simplified status filter
          if (filterStatus === 'BASELINE' && !item.scenario.isBaseline) return false;
          if (filterStatus === 'DRAFT' && item.scenario.status !== ScenarioStatus.DRAFT) return false;
      }
      if (item.metrics.irr < minIrr) return false;
      return true;
    });
  }, [allScenarios, filterSiteId, filterStrategy, filterStatus, minIrr]);

  // --- Handlers ---
  const handleRowClick = (siteId: string, scenarioId: string) => {
    selectSite(siteId);
    selectScenario(scenarioId);
  };

  const toggleSelection = (uniqueKey: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(uniqueKey)) newSet.delete(uniqueKey);
    else {
        if (newSet.size >= 4) {
            alert("Maximum 4 scenarios can be compared at once.");
            return;
        }
        newSet.add(uniqueKey);
    }
    setSelectedIds(newSet);
  };

  const handleCompare = () => {
      setIsComparing(true);
  };

  // Creation Handlers
  const handleCreateStart = () => {
      setTargetSiteId('');
      setIsSiteSelectorOpen(true);
  };

  const handleTargetSiteSelect = (siteId: string) => {
      setTargetSiteId(siteId);
      setIsSiteSelectorOpen(false);
      setIsWizardOpen(true);
  };

  const handleWizardCreate = (newScenario: FeasibilityScenario) => {
      if (targetSiteId) {
          addScenario(targetSiteId, newScenario);
          // Optional: Navigate to it immediately?
          selectSite(targetSiteId);
          selectScenario(newScenario.id);
      }
  };

  const targetSite = sites.find(s => s.id === targetSiteId);

  // --- Render Helpers ---
  const StatusBadge = ({ status, isBaseline }: { status: string, isBaseline: boolean }) => {
      if (isBaseline) return <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">Baseline</span>;
      return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">{status}</span>;
  };

  const StrategyBadge = ({ strategy }: { strategy: 'SELL' | 'HOLD' }) => (
      <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border w-fit ${strategy === 'SELL' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
          <i className={`fa-solid ${strategy === 'SELL' ? 'fa-tags' : 'fa-building-user'} text-[9px]`}></i>
          <span className="text-[9px] font-black uppercase tracking-wider">{strategy}</span>
      </div>
  );

  // --- Sub-View: Comparison Overlay ---
  if (isComparing) {
      // Reconstruct the data needed for ScenarioComparison
      const selectedItems = allScenarios.filter(s => selectedIds.has(s.uniqueKey));
      
      const referenceSiteId = selectedItems[0]?.siteId;
      const isMixedSites = selectedItems.some(s => s.siteId !== referenceSiteId);
      const referenceSite = sites.find(s => s.id === referenceSiteId);

      return (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 animate-in slide-in-from-bottom-4">
              <div className="max-w-7xl mx-auto">
                  <div className="mb-6 flex items-center justify-between">
                      <button onClick={() => setIsComparing(false)} className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest">
                          <i className="fa-solid fa-chevron-left mr-2"></i> Back to Feasibilities
                      </button>
                      <h2 className="text-xl font-black text-slate-800">Portfolio Comparison</h2>
                  </div>
                  
                  {isMixedSites && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center text-amber-800 text-sm">
                          <i className="fa-solid fa-triangle-exclamation mr-3 text-lg"></i>
                          <div>
                              <strong>Multi-Site Comparison Detected:</strong> You are comparing scenarios across different physical assets. 
                              Land costs and statutory rates may vary significantly.
                          </div>
                      </div>
                  )}

                  {referenceSite && (
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                          <ScenarioComparison 
                            scenarios={selectedItems.map(i => i.scenario)} 
                            siteDNA={referenceSite.dna} // Using ref site DNA for standard calcs
                          />
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- Main View ---
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      
      {/* 1. WIZARD & MODALS */}
      {isSiteSelectorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Select Target Project</h3>
                      <button onClick={() => setIsSiteSelectorOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <i className="fa-solid fa-xmark"></i>
                      </button>
                  </div>
                  <div className="p-2 max-h-[60vh] overflow-y-auto">
                      {sites.map(site => (
                          <button 
                            key={site.id} 
                            onClick={() => handleTargetSiteSelect(site.id)}
                            className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg flex items-center space-x-3 transition-colors group border border-transparent hover:border-indigo-100"
                          >
                              <img src={site.thumbnail} className="w-10 h-10 rounded object-cover border border-slate-200" alt=""/>
                              <div>
                                  <div className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">{site.name}</div>
                                  <div className="text-xs text-slate-500">{site.dna.address}</div>
                              </div>
                              <i className="fa-solid fa-chevron-right ml-auto text-slate-300 group-hover:text-indigo-400"></i>
                          </button>
                      ))}
                      {sites.length === 0 && (
                          <div className="p-6 text-center text-slate-500 italic text-sm">
                              No active projects found. Create a site in the Pipeline first.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <ScenarioWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        onCreate={handleWizardCreate}
        projectName={targetSite?.name || 'Unknown Project'}
        existingScenarios={targetSite?.scenarios || []}
      />

      {/* 2. COMMAND CENTER RIBBON */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 md:px-8 shadow-sm shrink-0 z-20">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
             <div>
                 <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center">
                    <i className="fa-solid fa-layer-group text-indigo-600 mr-3"></i>
                    Feasibility Portfolio
                 </h1>
                 <p className="text-xs text-slate-500 font-medium mt-1">
                    Aggregate view of {allScenarios.length} models across {sites.length} sites.
                 </p>
             </div>
             
             {/* Actions */}
             <div className="flex items-center space-x-3">
                 <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                     <button 
                        onClick={() => setViewMode('flat')}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center ${viewMode === 'flat' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        <i className="fa-solid fa-list mr-2"></i> Flat
                     </button>
                     <button 
                        onClick={() => setViewMode('grouped')}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center ${viewMode === 'grouped' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        <i className="fa-solid fa-folder-tree mr-2"></i> By Site
                     </button>
                 </div>
                 
                 <button 
                    onClick={handleCreateStart}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide shadow-md flex items-center transition-colors"
                 >
                    <i className="fa-solid fa-plus mr-2"></i> New Feasibility
                 </button>
             </div>
         </div>

         {/* Filters */}
         <div className="flex flex-wrap gap-4 items-end">
             
             {/* Site Filter */}
             <div className="w-full md:w-48">
                 <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Property</label>
                 <select 
                    value={filterSiteId} 
                    onChange={(e) => setFilterSiteId(e.target.value)}
                    className="w-full text-xs font-bold border-slate-200 rounded-lg focus:ring-indigo-500"
                 >
                     <option value="ALL">All Properties</option>
                     {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
             </div>

             {/* Strategy Filter */}
             <div className="w-full md:w-32">
                 <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Strategy</label>
                 <select 
                    value={filterStrategy} 
                    onChange={(e) => setFilterStrategy(e.target.value as any)}
                    className="w-full text-xs font-bold border-slate-200 rounded-lg focus:ring-indigo-500"
                 >
                     <option value="ALL">All Types</option>
                     <option value="SELL">Develop to Sell</option>
                     <option value="HOLD">Build to Rent</option>
                 </select>
             </div>

             {/* Status Filter */}
             <div className="w-full md:w-32">
                 <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                 <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs font-bold border-slate-200 rounded-lg focus:ring-indigo-500"
                 >
                     <option value="ALL">Any Status</option>
                     <option value="BASELINE">Baseline Only</option>
                     <option value="DRAFT">Drafts</option>
                 </select>
             </div>

             {/* IRR Threshold */}
             <div className="w-full md:w-40">
                 <div className="flex justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Min IRR %</label>
                    <span className="text-[10px] font-bold text-indigo-600">{minIrr}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="30" step="1" 
                    value={minIrr}
                    onChange={(e) => setMinIrr(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                 />
             </div>

         </div>
      </div>

      {/* 3. DATA GRID */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
         <div className="max-w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                  <tr>
                     <th className="p-4 w-10 text-center">
                        <input type="checkbox" disabled className="rounded border-slate-300" />
                     </th>
                     <th className="p-4">Scenario Name</th>
                     {viewMode === 'flat' && <th className="p-4">Property</th>}
                     <th className="p-4">Strategy</th>
                     <th className="p-4 text-right">Profit (Net)</th>
                     <th className="p-4 text-right">Margin</th>
                     <th className="p-4 text-right">IRR</th>
                     <th className="p-4 text-right">Total Cost</th>
                     <th className="p-4 w-24">Last Mod</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                  {viewMode === 'flat' ? (
                      // FLAT VIEW
                      filteredList.map(item => (
                          <Row 
                            key={item.uniqueKey} 
                            item={item} 
                            isSelected={selectedIds.has(item.uniqueKey)} 
                            onToggle={() => toggleSelection(item.uniqueKey)}
                            onClick={() => handleRowClick(item.siteId, item.scenario.id)}
                            showSite={true}
                          />
                      ))
                  ) : (
                      // GROUPED VIEW
                      sites.map(site => {
                          const siteItems = filteredList.filter(i => i.siteId === site.id);
                          if (siteItems.length === 0) return null;
                          return (
                              <React.Fragment key={site.id}>
                                  <tr className="bg-slate-50/50 border-y border-slate-200">
                                      <td colSpan={8} className="px-4 py-2">
                                          <div className="flex items-center space-x-2">
                                              <img src={site.thumbnail} className="w-6 h-6 rounded object-cover border border-slate-200" alt=""/>
                                              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">{site.name}</span>
                                              <span className="text-[10px] text-slate-400">({siteItems.length} models)</span>
                                          </div>
                                      </td>
                                  </tr>
                                  {siteItems.map(item => (
                                      <Row 
                                        key={item.uniqueKey} 
                                        item={item} 
                                        isSelected={selectedIds.has(item.uniqueKey)} 
                                        onToggle={() => toggleSelection(item.uniqueKey)}
                                        onClick={() => handleRowClick(item.siteId, item.scenario.id)}
                                        showSite={false}
                                      />
                                  ))}
                              </React.Fragment>
                          );
                      })
                  )}
                  {filteredList.length === 0 && (
                      <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                              No scenarios found matching your filters.
                          </td>
                      </tr>
                  )}
               </tbody>
            </table>

         </div>
      </div>

      {/* 4. COMPARISON FLOAT BAR */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center space-x-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
              <span className="text-xs font-bold">
                  {selectedIds.size} scenario{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="h-4 w-px bg-slate-700"></div>
              <button 
                onClick={handleCompare}
                className="text-xs font-bold text-indigo-400 hover:text-white transition-colors uppercase tracking-wider flex items-center"
              >
                  <i className="fa-solid fa-scale-balanced mr-2"></i> Compare Selection
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-500 hover:text-white transition-colors"
              >
                  <i className="fa-solid fa-xmark"></i>
              </button>
          </div>
      )}

    </div>
  );
};

// --- Sub-Component: Table Row ---
const Row = ({ item, isSelected, onToggle, onClick, showSite }: { item: EnrichedScenario, isSelected: boolean, onToggle: () => void, onClick: () => void, showSite: boolean }) => {
    return (
        <tr className={`group transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}>
            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={onToggle}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                />
            </td>
            <td className="p-4 cursor-pointer" onClick={onClick}>
                <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">
                    {item.scenario.name}
                </div>
                <div className="mt-1 flex items-center space-x-2">
                    {item.scenario.isBaseline && <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Baseline</span>}
                    {item.scenario.status === 'Draft' && <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Draft</span>}
                </div>
            </td>
            {showSite && (
                <td className="p-4 cursor-pointer" onClick={onClick}>
                    <div className="font-bold text-slate-700 text-xs">{item.siteName}</div>
                    <div className="text-[10px] text-slate-400">{item.siteState} • {item.siteStatus}</div>
                </td>
            )}
            <td className="p-4 cursor-pointer" onClick={onClick}>
                <div className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase w-fit ${item.scenario.strategy === 'SELL' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                    <i className={`fa-solid ${item.scenario.strategy === 'SELL' ? 'fa-tags' : 'fa-building-user'}`}></i>
                    <span>{item.scenario.strategy}</span>
                </div>
            </td>
            <td className="p-4 text-right font-mono font-bold text-slate-700 cursor-pointer" onClick={onClick}>
                ${(item.metrics.profit / 1000000).toFixed(2)}m
            </td>
            <td className="p-4 text-right cursor-pointer" onClick={onClick}>
                <span className={`font-mono font-bold ${item.metrics.margin < 10 ? 'text-red-500' : 'text-slate-800'}`}>
                    {item.metrics.margin.toFixed(2)}%
                </span>
            </td>
            <td className="p-4 text-right cursor-pointer" onClick={onClick}>
                <span className={`font-mono font-bold ${item.metrics.irr < 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {item.metrics.irr.toFixed(1)}%
                </span>
            </td>
            <td className="p-4 text-right font-mono text-slate-500 text-xs cursor-pointer" onClick={onClick}>
                ${(item.metrics.totalCost / 1000000).toFixed(1)}m
            </td>
            <td className="p-4 text-xs text-slate-400 font-medium">
                {new Date(item.scenario.lastModified).toLocaleDateString()}
            </td>
        </tr>
    );
};
