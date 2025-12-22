
import React, { useState } from 'react';
import { Site, ProjectModule, LineItem, CostCategory, RevenueItem, SmartRates, FeasibilityScenario, TaxConfiguration } from './types';
import { FeasibilityEngine } from './FeasibilityEngine';
import { ScenarioComparison } from './ScenarioComparison';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS, createDefaultScenario } from './constants';
import { SiteSettings } from './components/SiteSettings';

interface Props {
  site: Site;
  onBack: () => void;
  onUpdateSite?: (site: Site) => void;
  smartRates?: SmartRates;
  libraryData?: LineItem[];
  taxScales?: TaxConfiguration;
}

const ProjectSidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all text-sm font-semibold whitespace-nowrap ${
      active ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`}
  >
    <i className={`${icon} w-5 text-center`}></i>
    <span>{label}</span>
  </button>
);

export const ProjectDashboard: React.FC<Props> = ({ site, onBack, onUpdateSite, smartRates, libraryData, taxScales }) => {
  const [activeModule, setActiveModule] = useState<ProjectModule | 'compare' | 'settings'>('overview');

  const navItems: { id: ProjectModule | 'compare' | 'settings'; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-pie' },
    { id: 'feasibility', label: 'Feasibility (Baseline)', icon: 'fa-solid fa-calculator' },
    { id: 'compare', label: 'Scenario Compare', icon: 'fa-solid fa-scale-balanced' },
    { id: 'procurement', label: 'RFQs / Tenders', icon: 'fa-solid fa-file-contract' },
    { id: 'sales', label: 'Sales & Settlements', icon: 'fa-solid fa-dollar-sign' },
    { id: 'files', label: 'Documents', icon: 'fa-solid fa-folder' },
    { id: 'settings', label: 'Site Settings', icon: 'fa-solid fa-sliders' },
  ];

  // Mock Data Construction for "Compare" view using new Type
  // Note: For a real dashboard, we'd pull from site.scenarios
  const baselineScenario: FeasibilityScenario = createDefaultScenario('Approved Baseline');
  baselineScenario.isBaseline = true;
  baselineScenario.settings.projectName = site.name;

  const optionBScenario: FeasibilityScenario = createDefaultScenario('High Spec Option');
  optionBScenario.costs = INITIAL_COSTS.map(c => {
       if (c.category === CostCategory.CONSTRUCTION) {
         return { ...c, amount: c.amount * 1.15 }; // +15% Construction Cost
       }
       return c;
  });
  optionBScenario.revenues = INITIAL_REVENUE.map(r => ({
       ...r,
       pricePerUnit: r.pricePerUnit * 1.20 // +20% Sales Price
  }));
  optionBScenario.settings.projectName = site.name;

  const comparisonScenarios = [baselineScenario, optionBScenario];

  const activeFeasibilityScenario = site.scenarios.find(s => s.isBaseline) || site.scenarios[0];

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden animate-in fade-in duration-300">
      {/* Project Secondary Sidebar */}
      {/* Mobile: Top Bar, Desktop: Left Sidebar */}
      <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex flex-col no-print shrink-0">
        <div className="p-4 lg:p-6 border-b border-slate-200 bg-white flex justify-between lg:block items-center">
          <div className="flex items-center space-x-3 overflow-hidden">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                <img src={site.thumbnail} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="overflow-hidden min-w-0">
                <h2 className="text-sm font-black text-slate-800 truncate leading-tight">{site.name}</h2>
                <p className="text-[10px] text-slate-500 truncate">{site.dna.address}</p>
             </div>
          </div>
          
          <button onClick={onBack} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors flex items-center shrink-0 ml-4 lg:ml-0 lg:mb-4 lg:mt-0">
            <span className="hidden lg:inline"><i className="fa-solid fa-chevron-left mr-2"></i> Portfolio</span>
            <span className="lg:hidden"><i className="fa-solid fa-xmark text-lg"></i></span>
          </button>
        </div>

        {/* Scrollable Nav on Mobile */}
        <nav className="flex-1 p-2 lg:p-4 space-x-2 lg:space-x-0 lg:space-y-1 flex lg:flex-col overflow-x-auto no-scrollbar">
          {navItems.map(item => (
            <ProjectSidebarItem 
              key={item.id} 
              active={activeModule === item.id} 
              onClick={() => setActiveModule(item.id)} 
              icon={item.icon} 
              label={item.label} 
            />
          ))}
        </nav>

        <div className="hidden lg:block p-6 bg-white border-t border-slate-200">
           <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stage: {site.stage}</span>
              <span className="text-[10px] font-bold text-blue-600">42%</span>
           </div>
           <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[42%]"></div>
           </div>
        </div>
      </aside>

      {/* Module Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-white relative pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto">
          {activeModule === 'overview' && (
            <div className="animate-in fade-in duration-500">
               <header className="mb-6 lg:mb-10">
                  <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight uppercase">Project Overview</h1>
                  <p className="text-sm text-slate-500">Consolidated live performance data from all enterprise modules.</p>
               </header>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
                  <SummaryCard label="Open Tasks" val={site.openTasks} icon="fa-solid fa-list-check" color="text-slate-800" />
                  <SummaryCard label="Open RFIs" val={site.openRFIs} icon="fa-solid fa-circle-question" color="text-amber-600" />
                  <SummaryCard label="Conditions" val={site.conditions} icon="fa-solid fa-file-contract" color="text-blue-600" />
                  <SummaryCard label="Settled Units" val="8/20" icon="fa-solid fa-hand-holding-dollar" color="text-emerald-600" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <div className="bg-slate-50 p-6 lg:p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                     <i className="fa-solid fa-chart-line text-4xl text-slate-200 mb-4 block"></i>
                     <h3 className="text-sm font-bold text-slate-800">Financial Variance Tracking</h3>
                     <p className="text-xs text-slate-500 mt-2">Comparison of live actuals against the Feasibility Baseline. Coming soon.</p>
                  </div>
                  <div className="bg-slate-50 p-6 lg:p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                     <i className="fa-solid fa-users-gear text-4xl text-slate-200 mb-4 block"></i>
                     <h3 className="text-sm font-bold text-slate-800">Team Collaboration</h3>
                     <p className="text-xs text-slate-500 mt-2">Manage user permissions and task assignments for this site.</p>
                  </div>
               </div>
            </div>
          )}

          {activeModule === 'feasibility' && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
               <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div>
                    <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight uppercase">Feasibility Baseline</h1>
                    <p className="text-sm text-slate-500 italic">Locked snapshot from Acquisition Phase</p>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-widest border border-blue-200">
                    <i className="fa-solid fa-lock mr-2"></i> Read Only
                  </span>
               </header>
               <FeasibilityEngine 
                  site={site} 
                  activeScenario={activeFeasibilityScenario}
                  isEditable={false} 
                  smartRates={smartRates}
                  libraryData={libraryData}
                  taxScales={taxScales}
                  onRequestEditSite={() => setActiveModule('settings')}
               />
            </div>
          )}
          
          {activeModule === 'compare' && (
            <ScenarioComparison scenarios={comparisonScenarios} siteDNA={site.dna} />
          )}

          {activeModule === 'settings' && onUpdateSite && (
             <SiteSettings site={site} onUpdate={onUpdateSite} />
          )}

          {['procurement', 'sales', 'files'].includes(activeModule as any) && (
            <div className="flex flex-col items-center justify-center py-20 lg:py-40 animate-in zoom-in-95 duration-500">
              <i className={`${navItems.find(n => n.id === activeModule)?.icon} text-5xl text-slate-100 mb-6`}></i>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">{navItems.find(n => n.id === activeModule)?.label} Module</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-sm text-center font-medium">
                Integrated enterprise features for active sites. Connecting to Golden Thread live database.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, val, icon, color }: { label: string, val: string | number, icon: string, color: string }) => (
  <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm">
     <div className="flex justify-between items-start mb-4">
        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
           <i className={icon}></i>
        </div>
     </div>
     <p className={`text-xl lg:text-2xl font-black ${color}`}>{val}</p>
     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
  </div>
);
