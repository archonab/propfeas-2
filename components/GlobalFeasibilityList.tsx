
import React, { useMemo, useState } from 'react';
import { useProject } from '../contexts/SiteContext';
import { FeasibilityScenario, Site, ScenarioStatus } from '../types';
import { FinanceEngine } from '../services/financeEngine';

// Enriched type for the flat list
interface FlatScenario {
  uniqueKey: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  scenario: FeasibilityScenario;
  metrics: {
    profit: number;
    margin: number;
    irr: number;
    totalCost: number;
  };
}

export const GlobalFeasibilityList: React.FC = () => {
  const { sites, selectSite, selectScenario } = useProject();
  const [filterMode, setFilterMode] = useState<'ALL' | 'BASELINE' | 'HIGH_MARGIN' | 'DRAFTS'>('ALL');

  // 1. Flatten & Calculate Data
  const flatList = useMemo(() => {
    const list: FlatScenario[] = [];
    
    sites.forEach(site => {
      site.scenarios.forEach(scen => {
        // Run light calc to get sortable metrics
        const cashflow = FinanceEngine.calculateMonthlyCashflow(scen, site.dna);
        const metrics = FinanceEngine.calculateProjectMetrics(cashflow, scen.settings);
        
        list.push({
          uniqueKey: `${site.id}-${scen.id}`,
          siteId: site.id,
          siteName: site.name,
          siteAddress: site.dna.address,
          scenario: scen,
          metrics: {
            profit: metrics.netProfit,
            margin: metrics.devMarginPct,
            irr: metrics.equityIRR || 0,
            totalCost: metrics.totalDevelopmentCost
          }
        });
      });
    });
    return list;
  }, [sites]);

  // 2. Apply Filters
  const filteredList = useMemo(() => {
    return flatList.filter(item => {
      if (filterMode === 'BASELINE') return item.scenario.isBaseline;
      if (filterMode === 'HIGH_MARGIN') return item.metrics.margin > 15;
      if (filterMode === 'DRAFTS') return item.scenario.status === ScenarioStatus.DRAFT;
      return true; // ALL
    });
  }, [flatList, filterMode]);

  // 3. Navigation Handler
  const handleOpen = (siteId: string, scenarioId: string) => {
     selectSite(siteId);
     selectScenario(scenarioId); // Jump straight to workbench
  };

  // Helper for Filter Pills
  const FilterPill = ({ id, label, icon }: { id: typeof filterMode, label: string, icon: string }) => (
    <button 
      onClick={() => setFilterMode(id)}
      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center space-x-2 ${
        filterMode === id 
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      <i className={`fa-solid ${icon}`}></i>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 animate-in fade-in duration-300">
      
      {/* Header & Filters */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <div>
               <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                  <i className="fa-solid fa-layer-group text-indigo-600 mr-3"></i>
                  Feasibility Matrix
               </h1>
               <p className="text-sm text-slate-500 mt-1">Master schedule of {flatList.length} financial models across {sites.length} sites.</p>
            </div>
            <div className="text-right bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Potential Profit</div>
               <div className="text-2xl font-black text-emerald-600 font-mono leading-none">
                  ${(filteredList.reduce((acc, i) => acc + i.metrics.profit, 0) / 1e6).toFixed(2)}M
               </div>
            </div>
         </div>

         <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
            <FilterPill id="ALL" label="All Models" icon="fa-list" />
            <FilterPill id="BASELINE" label="Baselines Only" icon="fa-circle-check" />
            <FilterPill id="HIGH_MARGIN" label="High Margin (>15%)" icon="fa-chart-line" />
            <FilterPill id="DRAFTS" label="Drafts" icon="fa-pencil" />
         </div>
      </div>

      {/* The Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <tr>
                     <th className="px-6 py-3">Site / Scenario</th>
                     <th className="px-6 py-3">Strategy</th>
                     <th className="px-6 py-3 text-right">Net Profit</th>
                     <th className="px-6 py-3 text-right">Margin</th>
                     <th className="px-6 py-3 text-right">IRR</th>
                     <th className="px-6 py-3 text-right">Cost (TDC)</th>
                     <th className="px-6 py-3 w-20"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {/* We map SITES first to create the "Grouped" look */}
                  {sites.map(site => {
                     // Filter scenarios for this site based on global filter
                     const siteItems = filteredList.filter(i => i.siteId === site.id);
                     if (siteItems.length === 0) return null;

                     return (
                        <React.Fragment key={site.id}>
                           {/* Site Group Header */}
                           <tr className="bg-slate-50/80 border-y border-slate-200">
                              <td colSpan={7} className="px-6 py-2">
                                 <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">
                                        <i className="fa-solid fa-map-pin"></i>
                                    </div>
                                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">{site.name}</span>
                                    <span className="text-[10px] text-slate-400 font-medium"> • {site.dna.address}</span>
                                 </div>
                              </td>
                           </tr>

                           {/* Scenario Rows */}
                           {siteItems.map(item => (
                              <tr 
                                 key={item.uniqueKey} 
                                 onClick={() => handleOpen(item.siteId, item.scenario.id)}
                                 className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                              >
                                 <td className="px-6 py-4 pl-12">
                                    <div className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm">{item.scenario.name}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-1">
                                       <span>Updated {new Date(item.scenario.updatedAt).toLocaleDateString()}</span>
                                       {item.scenario.isBaseline && (
                                           <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 font-bold uppercase tracking-wide">
                                               Baseline
                                           </span>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                        item.scenario.strategy === 'SELL' 
                                        ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}>
                                       {item.scenario.strategy}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">
                                    ${(item.metrics.profit/1e6).toFixed(2)}m
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className={`font-mono font-bold ${item.metrics.margin < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                       {item.metrics.margin.toFixed(2)}%
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right font-mono text-slate-600 font-medium">
                                    {item.metrics.irr ? item.metrics.irr.toFixed(1) + '%' : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-right font-mono text-slate-400 text-xs">
                                    ${(item.metrics.totalCost/1e6).toFixed(1)}m
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <button className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors shadow-none hover:shadow-sm">
                                       <i className="fa-solid fa-chevron-right"></i>
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </React.Fragment>
                     );
                  })}
                  {filteredList.length === 0 && (
                      <tr>
                          <td colSpan={7} className="p-16 text-center text-slate-400 italic">
                              <i className="fa-solid fa-filter text-2xl mb-3 opacity-20"></i>
                              <p>No feasibility models found matching your filter.</p>
                          </td>
                      </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
