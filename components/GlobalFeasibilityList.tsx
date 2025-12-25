
import React, { useMemo, useState } from 'react';
import { useProject } from '../contexts/SiteContext';
import { FeasibilityScenario, Site } from '../types-v2';
import { ScenarioStatus } from '../types';
import { FinanceEngine } from '../services/financeEngine';

// Enriched type for the flat list
interface EnrichedScenario {
  uniqueKey: string;
  siteId: string;
  scenario: FeasibilityScenario;
  metrics: {
    profit: number;
    margin: number;
    irr: number;
    totalCost: number;
    revenue: number;
  };
}

export const GlobalFeasibilityList: React.FC = () => {
  const { sites, selectSite, selectScenario } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set(sites.map(s => s.id))); // Default all open

  // 1. Calculate & Organize Data
  const groupedData = useMemo(() => {
    return sites.map(site => {
      const siteScenarios: EnrichedScenario[] = site.scenarios.map(scen => {
        const cashflow = FinanceEngine.calculateMonthlyCashflow(scen, site);
        // Fix: Added missing 'site' argument to calculateProjectMetrics
        const metrics = FinanceEngine.calculateProjectMetrics(cashflow, scen.settings, site);
        return {
          uniqueKey: `${site.id}-${scen.id}`,
          siteId: site.id,
          scenario: scen,
          metrics: {
            profit: metrics.netProfit,
            margin: metrics.devMarginPct,
            irr: metrics.equityIRR || 0,
            totalCost: metrics.totalDevelopmentCost,
            revenue: metrics.netRevenue
          }
        };
      }).filter(item => {
         // Search Filter
         if (!searchTerm) return true;
         const term = searchTerm.toLowerCase();
         return (
             site.name.toLowerCase().includes(term) || 
             item.scenario.name.toLowerCase().includes(term)
         );
      });

      // Calculate Site Level Aggregates
      const bestMargin = Math.max(...siteScenarios.map(s => s.metrics.margin), 0);
      const bestIRR = Math.max(...siteScenarios.map(s => s.metrics.irr), 0);

      return {
        site,
        scenarios: siteScenarios,
        aggregates: { bestMargin, bestIRR }
      };
    }).filter(group => group.scenarios.length > 0); // Hide sites with no matching scenarios
  }, [sites, searchTerm]);

  // 2. Global Aggregates
  const globalStats = useMemo(() => {
      const allScenarios = groupedData.flatMap(g => g.scenarios);
      const totalCount = allScenarios.length;
      const baselineCount = allScenarios.filter(s => s.scenario.isBaseline).length;
      const avgMargin = totalCount > 0 ? allScenarios.reduce((sum, s) => sum + s.metrics.margin, 0) / totalCount : 0;
      const avgIRR = totalCount > 0 ? allScenarios.reduce((sum, s) => sum + s.metrics.irr, 0) / totalCount : 0;

      return {
          sites: groupedData.length,
          scenarios: totalCount,
          baselines: baselineCount,
          avgMargin,
          avgIRR
      };
  }, [groupedData]);

  // Handlers
  const handleOpen = (siteId: string, scenarioId: string) => {
     selectSite(siteId);
     selectScenario(scenarioId); 
  };

  const toggleExpand = (siteId: string) => {
      const newSet = new Set(expandedSites);
      if (newSet.has(siteId)) newSet.delete(siteId);
      else newSet.add(siteId);
      setExpandedSites(newSet);
  };

  const toggleAll = (expand: boolean) => {
      if (expand) setExpandedSites(new Set(sites.map(s => s.id)));
      else setExpandedSites(new Set());
  };

  // Components
  const SummaryCard = ({ label, value, subLabel, color }: any) => (
      <div className={`bg-white border border-slate-200 rounded-lg p-3 md:p-4 flex flex-col justify-between shadow-sm min-w-[120px] md:min-w-[140px] h-full`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
          <div className={`text-xl md:text-2xl font-black ${color || 'text-slate-800'}`}>{value}</div>
          {subLabel && <div className="text-[10px] text-slate-400 font-medium mt-1">{subLabel}</div>}
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50/50 animate-in fade-in duration-300">
      
      {/* 1. Dashboard Header */}
      <div className="px-4 py-4 md:px-8 md:py-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm shrink-0 overflow-hidden">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 md:mb-6 gap-4">
            <div>
               <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Feasibility Scenarios</h1>
               <p className="text-xs md:text-sm text-slate-500 mt-1">Financial models grouped by development site.</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
               <button className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center">
                   <i className="fa-solid fa-download mr-2"></i> Export
               </button>
               <button className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center">
                   <i className="fa-solid fa-scale-balanced mr-2"></i> Compare
               </button>
               <button className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 rounded-lg text-xs font-bold text-white hover:bg-indigo-700 flex items-center justify-center shadow-md">
                   <i className="fa-solid fa-plus mr-2"></i> New
               </button>
            </div>
         </div>

         {/* Metric Cards - Horizontal Scroll on Mobile */}
         <div className="flex overflow-x-auto pb-2 md:pb-0 gap-3 md:grid md:grid-cols-5 no-scrollbar snap-x">
            <div className="snap-start"><SummaryCard label="Sites" value={globalStats.sites} /></div>
            <div className="snap-start"><SummaryCard label="Scenarios" value={globalStats.scenarios} /></div>
            <div className="snap-start"><SummaryCard label="Baseline" value={globalStats.baselines} color="text-emerald-600" /></div>
            <div className="snap-start"><SummaryCard label="Avg Margin" value={`${globalStats.avgMargin.toFixed(1)}%`} color="text-blue-600" /></div>
            <div className="snap-start"><SummaryCard label="Avg IRR" value={`${globalStats.avgIRR.toFixed(1)}%`} color="text-purple-600" /></div>
         </div>
      </div>

      {/* 2. Controls & List */}
      <div className="flex-1 overflow-y-auto p-3 md:p-8">
         
         {/* Toolbar */}
         <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
             <div className="relative w-full md:max-w-sm">
                 <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
                 <input 
                    type="text" 
                    placeholder="Search scenarios..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                 />
             </div>
             <div className="flex items-center space-x-3 text-xs font-bold text-slate-500 self-end md:self-auto">
                 <button onClick={() => toggleAll(true)} className="hover:text-indigo-600">Expand All</button>
                 <span className="text-slate-300">|</span>
                 <button onClick={() => toggleAll(false)} className="hover:text-indigo-600">Collapse All</button>
             </div>
         </div>

         {/* The Matrix */}
         <div className="space-y-4 pb-12">
            {groupedData.map(group => {
                const isExpanded = expandedSites.has(group.site.id);
                return (
                    <div key={group.site.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        
                        {/* Site Group Header */}
                        <div 
                            className="bg-slate-50 hover:bg-slate-100 transition-colors px-4 py-3 md:px-6 md:py-4 flex items-center cursor-pointer border-b border-slate-100"
                            onClick={() => toggleExpand(group.site.id)}
                        >
                            <div className={`mr-3 md:mr-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <i className="fa-solid fa-chevron-down"></i>
                            </div>
                            
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 mr-3 md:mr-4 hidden sm:flex">
                                <img src={group.site.thumbnail} className="w-full h-full object-cover rounded opacity-80" alt="" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-slate-800 truncate">{group.site.name}</h3>
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide border whitespace-nowrap ${
                                        group.site.stage === 'Planning' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        group.site.stage === 'Construction' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                        {group.site.stage}
                                    </span>
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                                        {group.scenarios.length} Models
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center space-x-2 truncate">
                                    <span className="font-mono">{group.site.code}</span>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="hidden sm:inline truncate">{group.site.identity.address}</span>
                                </div>
                            </div>

                            {/* Site Level Aggregates - Hidden on small mobile */}
                            <div className="hidden md:flex space-x-8 text-right">
                                <div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Best Margin</div>
                                    <div className="text-sm font-bold text-emerald-600">{group.aggregates.bestMargin.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Best IRR</div>
                                    <div className="text-sm font-bold text-emerald-600">{group.aggregates.bestIRR.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Scenarios Table */}
                        {isExpanded && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm min-w-[900px]">
                                    <thead className="bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Scenario</th>
                                            <th className="px-4 py-3 w-24">Status</th>
                                            <th className="px-4 py-3 w-20 text-center">Units</th>
                                            <th className="px-4 py-3 text-right">Dev Cost</th>
                                            <th className="px-4 py-3 text-right">Revenue</th>
                                            <th className="px-4 py-3 text-right text-emerald-600">Profit</th>
                                            <th className="px-4 py-3 text-right w-32">Margin</th>
                                            <th className="px-4 py-3 text-right w-24">IRR</th>
                                            <th className="px-4 py-3 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {group.scenarios.map(item => (
                                            <tr 
                                                key={item.uniqueKey} 
                                                onClick={() => handleOpen(item.siteId, item.scenario.id)}
                                                className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-4 py-4 text-center">
                                                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" onClick={(e) => e.stopPropagation()} />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-slate-700 text-xs group-hover:text-indigo-600 flex items-center">
                                                        {item.scenario.name}
                                                        {item.scenario.isBaseline && <i className="fa-solid fa-star text-amber-400 ml-2 text-[10px]"></i>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {item.scenario.id} • {new Date(item.scenario.updatedAt).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {item.scenario.isBaseline ? (
                                                        <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-1 rounded uppercase border border-emerald-200">Baseline</span>
                                                    ) : (
                                                        <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-1 rounded uppercase border border-amber-200">Draft</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center font-bold text-slate-700 text-xs">
                                                    {item.scenario.settings.totalUnits}
                                                </td>
                                                <td className="px-4 py-4 text-right font-mono text-xs text-slate-600">
                                                    ${(item.metrics.totalCost / 1e6).toFixed(2)}M
                                                </td>
                                                <td className="px-4 py-4 text-right font-mono text-xs text-slate-600">
                                                    ${(item.metrics.revenue / 1e6).toFixed(2)}M
                                                </td>
                                                <td className="px-4 py-4 text-right font-mono text-xs font-bold text-emerald-600">
                                                    ${(item.metrics.profit / 1e6).toFixed(2)}M
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                            <div 
                                                                className={`h-full rounded-full ${item.metrics.margin > 18 ? 'bg-emerald-500' : item.metrics.margin > 10 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                                                style={{ width: `${Math.min(item.metrics.margin * 3, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`text-xs font-bold ${item.metrics.margin > 15 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                            {item.metrics.margin.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right text-xs font-bold text-emerald-600">
                                                    {item.metrics.irr ? item.metrics.irr.toFixed(1) + '%' : '-'}
                                                </td>
                                                <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-slate-400 hover:text-indigo-600 p-1">
                                                        <i className="fa-solid fa-ellipsis"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
            
            {groupedData.length === 0 && (
                <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <i className="fa-solid fa-magnifying-glass text-3xl text-slate-300 mb-3"></i>
                    <p className="text-slate-500 font-medium">No scenarios found matching your search.</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
}
