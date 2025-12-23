
import React, { useState, useEffect } from 'react';
import { CockpitTab, LineItem, CostCategory, RevenueItem, SmartRates, TaxConfiguration } from './types';
import { Site, FeasibilityScenario } from './types-v2';
import { FeasibilityEngine } from './FeasibilityEngine';
import { ScenarioManager } from './components/ScenarioManager';
import { SiteAssetRegister } from './components/SiteAssetRegister';
import { StakeholderManager } from './components/StakeholderManager';
import { DocumentVault } from './components/DocumentVault';
import { SiteSettings } from './components/SiteSettings';
import { useProject } from './contexts/SiteContext';

interface Props {
  site: Site;
  onBack: () => void;
  onUpdateSite?: (site: Site) => void;
  smartRates?: SmartRates;
  libraryData?: LineItem[];
  taxScales?: TaxConfiguration;
}

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

export const SiteCockpit: React.FC<Props> = ({ site, onBack, onUpdateSite, smartRates, libraryData, taxScales }) => {
  const { selectedScenarioId, selectScenario, updateScenario, addScenario } = useProject();
  
  // Initialize activeTab based on whether a scenario is selected. 
  const [activeTab, setActiveTab] = useState<CockpitTab>(selectedScenarioId ? 'feasibility' : 'overview');
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Derived
  const activeScenario = site.scenarios.find(s => s.id === selectedScenarioId);

  // Auto-switch to feasibility tab if a scenario is selected externally while component is mounted
  useEffect(() => {
    if (selectedScenarioId && activeTab !== 'feasibility') {
        setActiveTab('feasibility');
    }
  }, [selectedScenarioId]);

  // Handlers
  const handleSaveScenario = (updatedScenario: FeasibilityScenario) => {
    if (selectedScenarioId) {
        updateScenario(site.id, selectedScenarioId, updatedScenario);
    }
  };

  const handleBackToModels = () => {
      selectScenario(null);
  };

  // Nav Helpers
  const TabButton = ({ id, label, icon }: { id: CockpitTab, label: string, icon: string }) => (
      <button
        onClick={() => { setActiveTab(id); selectScenario(null); }}
        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center whitespace-nowrap ${
            activeTab === id && !selectedScenarioId 
            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        }`}
      >
          <i className={`${icon} mr-2 text-sm ${activeTab === id ? 'text-indigo-500' : 'text-slate-400'}`}></i>
          {label}
      </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300 bg-slate-50/50">
      
      {/* 1. COCKPIT HEADER (Sticky) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shrink-0 shadow-sm">
          <div className="px-6 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                  <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center">
                      <i className="fa-solid fa-arrow-left mr-2"></i> All Sites
                  </button>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div>
                      <div className="flex items-center space-x-2">
                          <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">{site.name}</h1>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                              site.status === 'Acquired' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                              site.status === 'Due Diligence' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                              'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                              {site.status}
                          </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 flex items-center mt-0.5">
                          <i className="fa-solid fa-location-dot mr-1.5 opacity-60"></i> {site.identity.address}
                          <span className="mx-2">•</span>
                          {site.identity.landArea.toLocaleString()} sqm
                      </div>
                  </div>
              </div>

              <div className="flex items-center space-x-3">
                  {onUpdateSite && (
                      <button 
                        onClick={() => setIsEditingSettings(true)}
                        className="text-slate-500 hover:text-indigo-600 transition-colors text-xs font-bold flex items-center px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                      >
                          <i className="fa-solid fa-sliders mr-2"></i> Global Settings
                      </button>
                  )}
              </div>
          </div>

          {/* Sub-Navigation (Flattened) */}
          <div className="px-6 flex space-x-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
              <TabButton id="overview" label="Overview" icon="fa-solid fa-chart-pie" />
              <TabButton id="dna" label="Asset Register" icon="fa-solid fa-city" />
              <button
                onClick={() => setActiveTab('feasibility')}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center whitespace-nowrap ${
                    activeTab === 'feasibility' 
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                  <i className={`fa-solid fa-calculator mr-2 text-sm ${activeTab === 'feasibility' ? 'text-indigo-500' : 'text-slate-400'}`}></i>
                  Feasibility Models
                  <span className="ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black">{site.scenarios.length}</span>
              </button>
              <TabButton id="stakeholders" label="Stakeholders" icon="fa-solid fa-users" />
              {/* Add Documents Tab manually if not in type yet, but assume extended */}
              <button
                onClick={() => { setActiveTab('stakeholders'); /* Reuse tab for demo, ideally add 'documents' to type */ }}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center whitespace-nowrap ${
                    false // Placeholder for document tab active state if type extended
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                  <i className={`fa-solid fa-folder-open mr-2 text-sm text-slate-400`}></i>
                  Documents
              </button>
          </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
              
              {/* SETTINGS MODAL OVERLAY */}
              {isEditingSettings && onUpdateSite && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
                          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
                              <h3 className="font-bold text-slate-800 text-lg">Global Site Settings</h3>
                              <button onClick={() => setIsEditingSettings(false)} className="text-slate-400 hover:text-slate-600">
                                  <i className="fa-solid fa-xmark text-lg"></i>
                              </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                              <SiteSettings site={site as any} onUpdate={onUpdateSite as any} />
                          </div>
                          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                              <button onClick={() => setIsEditingSettings(false)} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Done</button>
                          </div>
                      </div>
                  </div>
              )}

              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                  <div className="animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mb-8">
                          <SummaryCard label="Models" val={site.scenarios.length} icon="fa-solid fa-layer-group" color="text-slate-800" />
                          <SummaryCard label="Open Tasks" val={site.openTasks} icon="fa-solid fa-list-check" color="text-slate-800" />
                          <SummaryCard label="Open RFIs" val={site.openRFIs} icon="fa-solid fa-circle-question" color="text-amber-600" />
                          <SummaryCard label="Conditions" val={site.conditions || 0} icon="fa-solid fa-file-contract" color="text-blue-600" />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-80 relative group">
                              <img 
                                src="https://images.unsplash.com/photo-1524813686514-a5756c97759e?q=80&w=800&auto=format&fit=crop" 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" 
                                alt="Map" 
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setActiveTab('dna')} className="bg-white text-slate-800 px-4 py-2 rounded-lg font-bold shadow-lg text-sm">
                                      View Asset Details
                                  </button>
                              </div>
                              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                                  {site.identity.lga} Council
                              </div>
                          </div>

                          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center">
                              <i className="fa-solid fa-chart-simple text-4xl text-slate-200 mb-4"></i>
                              <h3 className="text-lg font-bold text-slate-800">Financial Performance</h3>
                              <p className="text-slate-500 text-sm mt-2 max-w-sm">
                                  Select a baseline feasibility model to display key performance indicators on this dashboard.
                              </p>
                              <button onClick={() => setActiveTab('feasibility')} className="mt-6 text-indigo-600 font-bold text-sm hover:underline">
                                  Go to Feasibility Models
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* TAB: ASSET REGISTER (Flattened) */}
              {activeTab === 'dna' && (
                  <div className="h-full flex flex-col">
                      <SiteAssetRegister 
                          site={site} 
                          onUpdate={(updated) => onUpdateSite && onUpdateSite(updated)} 
                          readOnly={!onUpdateSite}
                      />
                  </div>
              )}

              {/* TAB: FEASIBILITY MODELS (The Engine Room) */}
              {activeTab === 'feasibility' && (
                  <div className="h-full flex flex-col animate-in fade-in duration-300">
                      
                      {selectedScenarioId && activeScenario ? (
                          // 1. ENGINE VIEW
                          <div className="flex-1 flex flex-col h-full">
                              <div className="mb-4 flex items-center">
                                  <button 
                                    onClick={handleBackToModels}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center"
                                  >
                                      <i className="fa-solid fa-chevron-left mr-2"></i> Back to Models
                                  </button>
                                  <div className="ml-4 h-4 w-px bg-slate-300"></div>
                                  <span className="ml-4 text-sm font-bold text-slate-700">{activeScenario.name}</span>
                              </div>
                              <div className="flex-1 border border-slate-200 rounded-xl shadow-sm overflow-hidden bg-white">
                                  <FeasibilityEngine 
                                      site={site} 
                                      activeScenario={activeScenario}
                                      isEditable={true} 
                                      onSaveScenario={handleSaveScenario}
                                      onRequestEditSite={() => setIsEditingSettings(true)}
                                      smartRates={smartRates}
                                      libraryData={libraryData}
                                      taxScales={taxScales}
                                  />
                              </div>
                          </div>
                      ) : (
                          // 2. LIST VIEW (Manager)
                          <div className="flex-1">
                              <ScenarioManager 
                                  site={site as any} 
                                  onBack={() => setActiveTab('overview')}
                                  onRequestEdit={() => setIsEditingSettings(true)}
                              />
                          </div>
                      )}
                  </div>
              )}

              {/* TAB: STAKEHOLDERS (Flattened) */}
              {activeTab === 'stakeholders' && (
                  <div className="h-full flex flex-col">
                      <StakeholderManager 
                          site={site as any} 
                          onUpdate={(updated) => onUpdateSite && onUpdateSite(updated as any)} 
                          readOnly={!onUpdateSite}
                      />
                      
                      <div className="mt-12">
                          <DocumentVault site={site as any} readOnly={!onUpdateSite} />
                      </div>
                  </div>
              )}

          </div>
      </main>
    </div>
  );
};
