
import React, { useState } from 'react';
import { GlobalView, Site, FeasibilityScenario } from './types';
import { createDefaultScenario } from './constants';
import { FeasibilityEngine } from './FeasibilityEngine';
import { ProjectDashboard } from './ProjectDashboard';
import { AdminSettings } from './AdminSettings';
import { ScenarioManager } from './components/ScenarioManager';
import { SiteDNAHub } from './components/SiteDNAHub';
import { GlobalFeasibilityList } from './components/GlobalFeasibilityList';
import { useProject } from './contexts/SiteContext';

export default function App() {
  const { 
    sites, 
    selectedSiteId,
    selectedScenarioId,
    selectSite,
    selectScenario,
    isSaving,
    
    // Actions
    addSite,
    updateSite,
    deleteSite,
    updateScenario,
    
    // Global Settings
    smartRates, 
    taxScales, 
    customLibrary,
    setSmartRates,
    setTaxScales,
    setCustomLibrary
  } = useProject();

  // Expanded View State
  const [view, setView] = useState<GlobalView | 'feasibility-master'>('pipeline');
  const [isEditingSite, setIsEditingSite] = useState(false);
  
  // Creation State (Draft) - Remains local until committed
  const [pendingSite, setPendingSite] = useState<Site | null>(null);

  // Derived Selection
  const selectedSite = sites.find(p => p.id === selectedSiteId);
  const selectedScenario = selectedSite?.scenarios.find(s => s.id === selectedScenarioId);

  const handleBackToPipeline = () => {
    selectSite(null);
  };

  const handleBackToScenarios = () => {
    selectScenario(null);
  };

  const handleSaveScenario = (updatedScenario: FeasibilityScenario) => {
    if (selectedSiteId) {
        updateScenario(selectedSiteId, updatedScenario.id, updatedScenario);
    }
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
      stakeholders: [],
      scenarios: [createDefaultScenario()]
    };

    setPendingSite(newSite);
    setIsEditingSite(true); 
  };

  const handleCommitPendingSite = () => {
    if (pendingSite) {
        addSite(pendingSite);
        selectSite(pendingSite.id);
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
        deleteSite(id);
    }
  };

  const handleSiteUpdateFromModal = (updatedSite: Site) => {
      if (pendingSite && updatedSite.id === pendingSite.id) {
          setPendingSite(updatedSite);
      } else {
          updateSite(updatedSite.id, updatedSite);
      }
  };

  // Determine which site to show in the Edit Modal
  const siteToEdit = pendingSite || selectedSite;

  // -- Render Helpers --
  const NavIconDesktop = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
    <button 
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-center py-4 relative group transition-all duration-200 ${active ? 'text-indigo-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]"></div>}
      <i className={`${icon} text-xl mb-1.5 transition-transform group-hover:scale-110`}></i>
      <span className="text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity absolute left-full ml-4 bg-slate-900 text-white px-3 py-1.5 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none border border-slate-700">{label}</span>
    </button>
  );

  const BottomTabItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-2 relative transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full"></div>}
      <i className={`${icon} text-lg mb-1`}></i>
      <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="h-screen flex md:flex-row bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. Desktop Sidebar (Fixed Rail) */}
      <aside className="hidden md:flex w-20 bg-slate-900 flex-col items-center py-6 shrink-0 z-50 h-full border-r border-slate-800 shadow-2xl relative">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center text-white mb-8 shadow-lg shadow-indigo-900/40 cursor-pointer hover:shadow-indigo-500/30 transition-all">
          <i className="fa-solid fa-cube text-xl"></i>
        </div>
        
        <nav className="flex-1 w-full flex flex-col items-center space-y-1">
          <NavIconDesktop 
            active={view === 'pipeline' && !selectedSiteId} 
            onClick={() => { setView('pipeline'); handleBackToPipeline(); }} 
            icon="fa-solid fa-filter-circle-dollar" 
            label="Pipeline" 
          />
          <NavIconDesktop 
            active={view === 'feasibility-master'} 
            onClick={() => { setView('feasibility-master'); handleBackToPipeline(); }} 
            icon="fa-solid fa-layer-group" 
            label="Feasibilities" 
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

        {/* Sync Indicator */}
        <div className="mb-6">
            <div className={`flex flex-col items-center transition-all duration-500 ${isSaving ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-90'}`}>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full mb-2 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider">Synced</span>
            </div>
        </div>
      </aside>

      {/* 2. Main App Content */}
      <main className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-slate-50 pb-16 md:pb-0">
        
        {/* VIEW: Pipeline List (Site Scanner) */}
        {view === 'pipeline' && !selectedSiteId && (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in duration-300">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Acquisition Pipeline</h1>
                <p className="text-sm text-slate-500 font-medium">Site scanning and rapid feasibility analysis.</p>
              </div>
              <button 
                onClick={handleCreateNewSite}
                className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg text-xs flex items-center justify-center uppercase tracking-wide"
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
                        onClick={() => selectSite(site.id)}
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
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors md:opacity-0 md:group-hover:opacity-100"
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

        {/* VIEW: Global Feasibility Master List */}
        {view === 'feasibility-master' && !selectedSiteId && (
            <GlobalFeasibilityList />
        )}

        {/* VIEW: Pipeline - SCENARIO MANAGER (Intermediate) */}
        {/* Note: This activates when we select a site from ANY view */}
        {selectedSite && !selectedScenarioId && (
           <ScenarioManager 
              site={selectedSite} 
              onBack={handleBackToPipeline}
              onRequestEdit={() => setIsEditingSite(true)}
           />
        )}

        {/* VIEW: Pipeline - FEASIBILITY ENGINE (Detail) */}
        {selectedSite && selectedScenario && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 animate-in slide-in-from-right-4 duration-500">
              <header className="shrink-0 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-b border-slate-200">
                <div className="flex flex-col">
                  <button 
                    onClick={handleBackToScenarios} 
                    className="text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center mb-1 w-fit"
                  >
                    <i className="fa-solid fa-chevron-left mr-2"></i> Back to Scenarios
                  </button>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight uppercase leading-none">{selectedScenario.name}</h2>
                    {selectedScenario.isBaseline && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase">Baseline</span>}
                  </div>
                </div>
                <div className="text-right hidden md:block">
                    <div className="text-xs font-bold text-slate-700">{selectedSite.name}</div>
                    <div className="text-[10px] text-slate-400">{selectedSite.dna.address}</div>
                </div>
              </header>
              
              <div className="flex-1 overflow-hidden">
                <FeasibilityEngine 
                  site={selectedSite} 
                  activeScenario={selectedScenario}
                  isEditable={true} 
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
                    onClick={() => { selectSite(site.id); }} // Portfolio opens Dashboard directly
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative"
                  >
                    <div className="h-40 bg-slate-100 relative overflow-hidden">
                       <img src={site.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                       <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-800 shadow-sm">
                          {site.stage}
                       </div>
                       {/* Delete Button */}
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
            onBack={() => selectSite(null)}
            onUpdateSite={(site) => updateSite(site.id, site)}
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
                      onUpdate={handleSiteUpdateFromModal} 
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

      {/* 3. Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-between px-2 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <BottomTabItem 
          active={view === 'pipeline'} 
          onClick={() => { setView('pipeline'); handleBackToPipeline(); }} 
          icon="fa-solid fa-filter-circle-dollar" 
          label="Pipeline" 
        />
        <BottomTabItem 
          active={view === 'feasibility-master'} 
          onClick={() => { setView('feasibility-master'); handleBackToPipeline(); }} 
          icon="fa-solid fa-layer-group" 
          label="Feasibilities" 
        />
        <BottomTabItem 
          active={view === 'portfolio'} 
          onClick={() => { setView('portfolio'); handleBackToPipeline(); }} 
          icon="fa-solid fa-building-user" 
          label="Portfolio" 
        />
        <BottomTabItem 
          active={view === 'admin'} 
          onClick={() => setView('admin')} 
          icon="fa-solid fa-gears" 
          label="Admin" 
        />
      </nav>

    </div>
  );
}
