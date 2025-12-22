
import React, { useState, useEffect } from 'react';
import { GlobalView, Site, FeasibilityScenario, SmartRates, LineItem, CostCategory, ScenarioStatus, TaxConfiguration, TaxState } from './types';
import { MOCK_SITES, DEFAULT_RATES, DEFAULT_TAX_SCALES, createDefaultScenario } from './constants';
import { STANDARD_LIBRARY } from './costLibrary';
import { FeasibilityEngine } from './FeasibilityEngine';
import { ProjectDashboard } from './ProjectDashboard';
import { AdminSettings } from './AdminSettings';
import { ScenarioManager } from './components/ScenarioManager';
import { SiteDNAHub } from './components/SiteDNAHub';

const flattenLibrary = (lib: Record<CostCategory, LineItem[]>): LineItem[] => {
  return Object.values(lib).flat();
};

export default function App() {
  const [view, setView] = useState<GlobalView>('pipeline');
  const [sites, setSites] = useState<Site[]>(MOCK_SITES);
  
  // Selection State
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isEditingSite, setIsEditingSite] = useState(false);
  
  // Creation State (Draft)
  const [pendingSite, setPendingSite] = useState<Site | null>(null);

  // --- Global Admin State ---
  const [smartRates, setSmartRates] = useState<SmartRates>(DEFAULT_RATES);
  const [taxScales, setTaxScales] = useState<TaxConfiguration>(DEFAULT_TAX_SCALES);
  const [customLibrary, setCustomLibrary] = useState<LineItem[]>([]);

  useEffect(() => {
    const savedRates = localStorage.getItem('devfeas_admin_rates');
    if (savedRates) setSmartRates(JSON.parse(savedRates));

    const savedTax = localStorage.getItem('devfeas_admin_tax');
    if (savedTax) setTaxScales(JSON.parse(savedTax));

    const savedLib = localStorage.getItem('devfeas_admin_library');
    if (savedLib) setCustomLibrary(JSON.parse(savedLib));
    else setCustomLibrary(flattenLibrary(STANDARD_LIBRARY));
  }, []);

  useEffect(() => {
    localStorage.setItem('devfeas_admin_rates', JSON.stringify(smartRates));
  }, [smartRates]);

  useEffect(() => {
    localStorage.setItem('devfeas_admin_tax', JSON.stringify(taxScales));
  }, [taxScales]);

  useEffect(() => {
    if (customLibrary.length > 0) {
      localStorage.setItem('devfeas_admin_library', JSON.stringify(customLibrary));
    }
  }, [customLibrary]);

  const selectedSite = sites.find(p => p.id === selectedSiteId);
  const selectedScenario = selectedSite?.scenarios.find(s => s.id === selectedScenarioId);

  const handleBackToPipeline = () => {
    setSelectedSiteId(null);
    setSelectedScenarioId(null);
  };

  const handleBackToScenarios = () => {
    setSelectedScenarioId(null);
  };

  const promoteSite = (id: string) => {
    setSites(prev => prev.map(p => p.id === id ? { ...p, status: 'Acquired', stage: 'Planning' } : p));
    setSelectedSiteId(null);
    setSelectedScenarioId(null);
    setView('portfolio');
  };

  const handleUpdateSite = (updatedSite: Site) => {
    // If we are in "Pending/Creation" mode, update the draft state instead of the main list
    if (pendingSite && updatedSite.id === pendingSite.id) {
        setPendingSite(updatedSite);
        return;
    }

    // Standard Update Logic
    const prevSite = sites.find(s => s.id === updatedSite.id);
    const stateChanged = prevSite && prevSite.dna.state !== updatedSite.dna.state;

    let finalSite = updatedSite;

    if (stateChanged) {
        const newState = updatedSite.dna.state as TaxState;
        const syncedScenarios = updatedSite.scenarios.map(scen => ({
            ...scen,
            settings: {
                ...scen.settings,
                acquisition: {
                    ...scen.settings.acquisition,
                    stampDutyState: newState
                }
            }
        }));
        finalSite = { ...updatedSite, scenarios: syncedScenarios };
    }

    setSites(prev => prev.map(s => s.id === finalSite.id ? finalSite : s));
  };

  const handleSaveScenario = (updatedScenario: FeasibilityScenario) => {
    setSites(prev => prev.map(site => {
      if (site.id === selectedSiteId) {
        return {
          ...site,
          scenarios: site.scenarios.map(s => s.id === updatedScenario.id ? updatedScenario : s)
        };
      }
      return site;
    }));
  };

  const handleCreateNewSite = () => {
    const newId = `lead-${Date.now()}`;
    const newSite: Site = {
      id: newId,
      code: `PROS-${Math.floor(Math.random() * 1000)}`,
      name: "New Acquisition Opportunity",
      thumbnail: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=400&auto=format&fit=crop",
      status: 'Prospect',
      stage: 'Analysis',
      pm: 'Unassigned',
      openTasks: 0,
      openRFIs: 0,
      conditions: 0,
      dna: {
        address: "Enter Site Address...",
        state: 'VIC', // Default
        landArea: 0,
        lga: "Pending",
        zoning: "Pending",
        overlays: [],
        agent: { name: "", company: "" },
        vendor: { name: "Pending" },
        milestones: {}
      },
      scenarios: [createDefaultScenario()]
    };

    // Set as Pending Draft (Do not add to list yet)
    setPendingSite(newSite);
    setIsEditingSite(true); 
  };

  const handleCommitPendingSite = () => {
    if (pendingSite) {
        setSites(prev => [pendingSite, ...prev]);
        setSelectedSiteId(pendingSite.id);
        setSelectedScenarioId(pendingSite.scenarios[0].id);
        setPendingSite(null);
        setIsEditingSite(false);
    }
  };

  const handleCancelPendingSite = () => {
    setPendingSite(null);
    setIsEditingSite(false);
  };

  const handleDeleteSite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this project and all its scenarios?")) {
        setSites(prev => prev.filter(s => s.id !== id));
        if (selectedSiteId === id) {
            setSelectedSiteId(null);
            setSelectedScenarioId(null);
        }
    }
  };

  // Determine which site to show in the Edit Modal
  const siteToEdit = pendingSite || selectedSite;

  // -- Render Helpers --
  const NavIconDesktop = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
    <button 
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-center py-4 relative group transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r shadow-[0_0_15px_rgba(99,102,241,0.6)]"></div>}
      <i className={`${icon} text-xl mb-1`}></i>
      <span className="text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity absolute left-16 bg-slate-800 text-white px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none border border-slate-700">{label}</span>
    </button>
  );

  return (
    <div className="h-screen flex md:flex-row bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex w-20 bg-slate-900 flex-col items-center py-6 shrink-0 z-50 h-full border-r border-slate-800 shadow-xl">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-8 shadow-lg shadow-indigo-900/40 cursor-pointer hover:bg-indigo-500 transition-colors">
          <i className="fa-solid fa-cube text-xl"></i>
        </div>
        
        <nav className="flex-1 w-full flex flex-col items-center space-y-2">
          <NavIconDesktop 
            active={view === 'pipeline'} 
            onClick={() => { setView('pipeline'); handleBackToPipeline(); }} 
            icon="fa-solid fa-filter-circle-dollar" 
            label="Pipeline" 
          />
          <NavIconDesktop 
            active={view === 'portfolio'} 
            onClick={() => { setView('portfolio'); handleBackToPipeline(); }} 
            icon="fa-solid fa-building-user" 
            label="Portfolio" 
          />
          <NavIconDesktop 
            active={view === 'admin'} 
            onClick={() => setView('admin')} 
            icon="fa-solid fa-gears" 
            label="Admin" 
          />
        </nav>
      </aside>

      {/* 2. Main App Content */}
      <main className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50">
        
        {/* VIEW: Pipeline List */}
        {view === 'pipeline' && !selectedSiteId && (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in duration-300">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Acquisition Pipeline</h1>
                <p className="text-sm text-slate-500 font-medium">Site scanning and rapid feasibility analysis.</p>
              </div>
              <button 
                onClick={handleCreateNewSite}
                className="w-full md:w-auto px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg text-xs flex items-center justify-center"
              >
                <i className="fa-solid fa-plus mr-2"></i> Scan New Site
              </button>
            </header>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Opportunity</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Scenarios</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sites.filter(p => p.status === 'Prospect' || p.status === 'Due Diligence').map(site => (
                      <tr 
                        key={site.id} 
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <td className="px-4 py-3 mono text-xs text-slate-400">{site.code}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{site.name}</td>
                        <td className="px-4 py-3 text-slate-500">{site.dna.address}</td>
                        <td className="px-4 py-3">
                           <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{site.scenarios.length} Models</span>
                        </td>
                        <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                              site.status === 'Due Diligence' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {site.status}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center space-x-3">
                             <button 
                                onClick={(e) => handleDeleteSite(e, site.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Site"
                             >
                                <i className="fa-solid fa-trash"></i>
                             </button>
                             <button className="text-indigo-600 font-bold text-xs hover:underline flex items-center">
                                <span className="hidden md:inline">Open</span> <i className="fa-solid fa-arrow-right ml-2"></i>
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: Pipeline - SCENARIO MANAGER (Intermediate) */}
        {view === 'pipeline' && selectedSite && !selectedScenarioId && (
           <ScenarioManager 
              site={selectedSite} 
              onUpdateSite={handleUpdateSite}
              onSelectScenario={setSelectedScenarioId}
              onBack={handleBackToPipeline}
              onRequestEdit={() => setIsEditingSite(true)}
           />
        )}

        {/* VIEW: Pipeline - FEASIBILITY ENGINE (Detail) */}
        {view === 'pipeline' && selectedSite && selectedScenario && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 animate-in slide-in-from-right-4 duration-500">
              <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <div>
                  <button 
                    onClick={handleBackToScenarios} 
                    className="text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center mb-1"
                  >
                    <i className="fa-solid fa-chevron-left mr-2"></i> Back to Scenarios
                  </button>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-tight">{selectedScenario.name}</h2>
                </div>
                <div className="text-xs text-slate-500 font-medium hidden md:block">
                    {selectedSite.name}
                </div>
              </header>
              
              <div className="flex-1 overflow-hidden">
                <FeasibilityEngine 
                  site={selectedSite} 
                  activeScenario={selectedScenario}
                  isEditable={true} 
                  onPromote={() => promoteSite(selectedSite.id)}
                  onSaveScenario={handleSaveScenario}
                  onRequestEditSite={() => setIsEditingSite(true)}
                  smartRates={smartRates}
                  libraryData={customLibrary}
                  taxScales={taxScales}
                />
              </div>
          </div>
        )}

        {/* VIEW: Portfolio */}
        {view === 'portfolio' && !selectedSiteId && (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in duration-500">
             <header className="mb-6 md:mb-8">
               <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Owned Portfolio</h1>
               <p className="text-sm text-slate-500 font-medium">Enterprise management of live development sites.</p>
             </header>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {sites.filter(p => p.status === 'Acquired').map(site => (
                  <div 
                    key={site.id}
                    onClick={() => { setSelectedSiteId(site.id); }} // Portfolio opens Dashboard directly
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative"
                  >
                    <div className="h-40 bg-slate-100 relative overflow-hidden">
                       <img src={site.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                       <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-800 shadow-sm">
                          {site.stage}
                       </div>
                       {/* Delete Button (Visible on Hover) */}
                       <div className="absolute top-4 left-4">
                          <button 
                             onClick={(e) => handleDeleteSite(e, site.id)}
                             className="w-8 h-8 rounded-full bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                             title="Delete Project"
                          >
                             <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                       </div>
                    </div>
                    <div className="p-6">
                       <h3 className="text-lg font-bold text-slate-800 leading-tight">{site.name}</h3>
                       <p className="text-xs text-slate-500 mt-1 flex items-center">
                          <i className="fa-solid fa-location-dot mr-2 opacity-50"></i> {site.dna.address}
                       </p>
                       <div className="mt-6 flex justify-between items-end">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project PM</p>
                             <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">SM</div>
                                <span className="text-xs font-bold text-slate-700">{site.pm}</span>
                             </div>
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center">
                             Workspace <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                          </span>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* VIEW: Portfolio - PROJECT DASHBOARD */}
        {view === 'portfolio' && selectedSite && (
          <ProjectDashboard 
            site={selectedSite} 
            onBack={() => setSelectedSiteId(null)}
            onUpdateSite={handleUpdateSite}
            smartRates={smartRates}
            libraryData={customLibrary}
            taxScales={taxScales}
          />
        )}

        {/* VIEW: Admin */}
        {view === 'admin' && (
          <AdminSettings 
            rates={smartRates} 
            setRates={setSmartRates} 
            library={customLibrary} 
            setLibrary={setCustomLibrary} 
            taxScales={taxScales}
            setTaxScales={setTaxScales}
          />
        )}

        {/* Global Site Edit / Create Modal */}
        {isEditingSite && siteToEdit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden border border-slate-200 flex flex-col">
                <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
                   <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                      {pendingSite ? 'Initialize New Site' : 'Edit Site Context'}
                   </h2>
                   {!pendingSite && (
                       <button onClick={() => setIsEditingSite(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                          <i className="fa-solid fa-xmark text-lg"></i>
                       </button>
                   )}
                </div>
                <div className="flex-1 overflow-hidden">
                   <SiteDNAHub 
                      site={siteToEdit} 
                      onUpdate={handleUpdateSite} 
                   />
                </div>
                {/* Pending Site Footer Actions */}
                {pendingSite && (
                    <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end space-x-3">
                        <button 
                            onClick={handleCancelPendingSite}
                            className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCommitPendingSite}
                            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center"
                        >
                            <i className="fa-solid fa-check mr-2"></i> Create Project
                        </button>
                    </div>
                )}
             </div>
          </div>
        )}

      </main>
    </div>
  );
}
