
import React, { useState, useMemo } from 'react';
import { Site, LeadStatus } from './types';
import { createDefaultScenario } from './constants';
import { SiteDNAHub } from './components/SiteDNAHub';
import { AppShell } from './components/AppShell';
import { ProjectLayout } from './ProjectLayout';
import { useProject } from './contexts/SiteContext';
import { GlobalFeasibilityList } from './components/GlobalFeasibilityList';
import { AdminSettings } from './AdminSettings';

// --- Sort Types & Helper ---
type SortOption = 'updated' | 'created' | 'settlement' | 'eoi' | 'name';
type SortDirection = 'asc' | 'desc';

// Helper to calculate "Time Ago" string
const getTimeAgo = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Helper to determine deadline urgency color
const getDeadlineStatus = (isoDate?: string) => {
    if (!isoDate) return null;
    const diff = new Date(isoDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { color: 'text-slate-400', label: 'Past', bg: 'bg-slate-100' };
    if (days <= 7) return { color: 'text-red-600', label: `${days} Days`, bg: 'bg-red-50 border-red-100' };
    if (days <= 30) return { color: 'text-amber-600', label: `${days} Days`, bg: 'bg-amber-50 border-amber-100' };
    return { color: 'text-slate-500', label: new Date(isoDate).toLocaleDateString(), bg: 'bg-slate-50' };
};

export default function App() {
  const { 
    sites, 
    selectedSiteId, 
    selectSite, 
    selectScenario,
    addSite,
    updateSite,
    deleteSite,
    smartRates, 
    taxScales, 
    customLibrary,
    setSmartRates,
    setTaxScales,
    setCustomLibrary
  } = useProject();

  const [globalView, setGlobalView] = useState<'portfolio' | 'settings' | 'tasks' | 'feasibilities'>('portfolio');
  const [siteFilter, setSiteFilter] = useState<'ALL' | 'PIPELINE' | 'PORTFOLIO'>('ALL');
  
  // Sorting State
  const [sortOption, setSortOption] = useState<SortOption>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isEditingSite, setIsEditingSite] = useState(false);
  const [pendingSite, setPendingSite] = useState<Site | null>(null);

  // Derived Selection
  const selectedSite = sites.find(p => p.id === selectedSiteId);

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

  const siteToEdit = pendingSite || selectedSite;

  // Filter & Sort Logic
  const processedSites = useMemo(() => {
      // 1. Filter
      let result = sites.filter(site => {
          if (siteFilter === 'ALL') return true;
          if (siteFilter === 'PIPELINE') return site.status === 'Prospect' || site.status === 'Due Diligence';
          if (siteFilter === 'PORTFOLIO') return site.status === 'Acquired';
          return true;
      });

      // 2. Sort
      result.sort((a, b) => {
          let valA: number | string | undefined;
          let valB: number | string | undefined;

          switch (sortOption) {
              case 'updated':
                  valA = new Date(a.updatedAt).getTime();
                  valB = new Date(b.updatedAt).getTime();
                  break;
              case 'created':
                  valA = new Date(a.createdAt).getTime();
                  valB = new Date(b.createdAt).getTime();
                  break;
              case 'settlement':
                  valA = a.dna.milestones.settlementDate ? new Date(a.dna.milestones.settlementDate).getTime() : 0;
                  valB = b.dna.milestones.settlementDate ? new Date(b.dna.milestones.settlementDate).getTime() : 0;
                  break;
              case 'eoi':
                  valA = a.dna.milestones.eoiCloseDate ? new Date(a.dna.milestones.eoiCloseDate).getTime() : 0;
                  valB = b.dna.milestones.eoiCloseDate ? new Date(b.dna.milestones.eoiCloseDate).getTime() : 0;
                  break;
              case 'name':
                  valA = a.name.toLowerCase();
                  valB = b.name.toLowerCase();
                  break;
          }

          // Push null dates to bottom regardless of order if sorting by date
          if (sortOption !== 'name') {
              if (!valA) return 1;
              if (!valB) return -1;
          }

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  }, [sites, siteFilter, sortOption, sortDirection]);

  return (
    <AppShell activeModule={globalView} onNavigate={setGlobalView}>
      
      {/* A. PROJECT CONTEXT (If a site is selected) */}
      {selectedSiteId && selectedSite ? (
         <ProjectLayout 
            site={selectedSite} 
            onBack={() => { selectSite(null); selectScenario(null); }} 
         />
      ) : (
         /* B. GLOBAL PORTFOLIO LIST (If no site selected) */
         <div className="h-full flex flex-col overflow-hidden">
            
            {globalView === 'portfolio' && (
              <>
                {/* Portfolio Header */}
                <header className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-end shrink-0">
                   <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">Portfolio</h1>
                      <p className="text-slate-500 text-sm mt-1">Manage your development pipeline and active assets.</p>
                   </div>
                   <button 
                      onClick={handleCreateNewSite}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center"
                   >
                      <i className="fa-solid fa-plus mr-2"></i> New Site
                   </button>
                </header>

                {/* Filters & Sorting Toolbar */}
                <div className="px-8 py-4 flex flex-col md:flex-row gap-3 shrink-0">
                    <div className="bg-slate-200 p-1 rounded-lg flex space-x-1 w-full md:w-auto overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setSiteFilter('ALL')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap ${siteFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All Sites
                        </button>
                        <button 
                            onClick={() => setSiteFilter('PIPELINE')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap ${siteFilter === 'PIPELINE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pipeline
                        </button>
                        <button 
                            onClick={() => setSiteFilter('PORTFOLIO')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap ${siteFilter === 'PORTFOLIO' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Portfolio
                        </button>
                    </div>

                    <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm ml-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Sort By</span>
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="text-xs font-bold text-slate-700 border-none bg-transparent focus:ring-0 cursor-pointer pr-6 py-0"
                        >
                            <option value="updated">Recently Updated</option>
                            <option value="created">Date Created</option>
                            <option value="settlement">Settlement (Soonest)</option>
                            <option value="eoi">EOI Closing</option>
                            <option value="name">Name (A-Z)</option>
                        </select>
                        <button 
                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 rounded bg-slate-50 hover:bg-indigo-50 transition-colors"
                            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            <i className={`fa-solid ${sortDirection === 'asc' ? 'fa-arrow-up-wide-short' : 'fa-arrow-down-short-wide'} text-xs`}></i>
                        </button>
                    </div>
                </div>

                {/* Site List Canvas */}
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                   <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                         <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                               <th className="px-6 py-3 w-32">Site Code</th>
                               <th className="px-6 py-3">Project Name</th>
                               <th className="px-6 py-3">Key Dates</th>
                               <th className="px-6 py-3 text-center">Models</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3 text-right">Updated</th>
                               <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {processedSites.map(site => {
                               const settlement = getDeadlineStatus(site.dna.milestones.settlementDate);
                               const eoi = getDeadlineStatus(site.dna.milestones.eoiCloseDate);
                               return (
                               <tr key={site.id} onClick={() => selectSite(site.id)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                  <td className="px-6 py-4 font-mono text-xs text-slate-400 font-bold">{site.code}</td>
                                  <td className="px-6 py-4">
                                     <div className="font-bold text-slate-700">{site.name}</div>
                                     <div className="text-[10px] text-slate-400">{site.dna.address}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex flex-col space-y-1">
                                          {site.dna.milestones.settlementDate && settlement && (
                                              <div className="flex items-center text-[10px]">
                                                  <span className="text-slate-400 w-16">Settlement:</span>
                                                  <span className={`font-bold px-1.5 py-0.5 rounded border ${settlement.bg} ${settlement.color}`}>
                                                      {settlement.label}
                                                  </span>
                                              </div>
                                          )}
                                          {site.dna.milestones.eoiCloseDate && eoi && (
                                              <div className="flex items-center text-[10px]">
                                                  <span className="text-slate-400 w-16">EOI Close:</span>
                                                  <span className={`font-bold px-1.5 py-0.5 rounded border ${eoi.bg} ${eoi.color}`}>
                                                      {eoi.label}
                                                  </span>
                                              </div>
                                          )}
                                          {!site.dna.milestones.settlementDate && !site.dna.milestones.eoiCloseDate && (
                                              <span className="text-[10px] text-slate-300 italic">-</span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                     <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{site.scenarios.length}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                                        site.status === 'Acquired' ? 'bg-emerald-100 text-emerald-700' : 
                                        site.status === 'Due Diligence' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                                     }`}>
                                        {site.status}
                                     </span>
                                  </td>
                                  <td className="px-6 py-4 text-right text-xs font-medium text-slate-500">
                                      {getTimeAgo(site.updatedAt)}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                     <div className="flex justify-end items-center space-x-3">
                                         <button 
                                            onClick={(e) => handleDeleteSite(e, site.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Site"
                                         >
                                            <i className="fa-solid fa-trash"></i>
                                         </button>
                                         <button className="text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            Open <i className="fa-solid fa-arrow-right ml-1"></i>
                                         </button>
                                     </div>
                                  </td>
                               </tr>
                            )})}
                            {processedSites.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400 italic">No sites found matching your filter.</td>
                                </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
              </>
            )}

            {/* Other Views Integration */}
            {globalView === 'feasibilities' && <GlobalFeasibilityList />}
            {globalView === 'settings' && (
               <AdminSettings 
                  rates={smartRates} 
                  setRates={setSmartRates} 
                  library={customLibrary} 
                  setLibrary={setCustomLibrary} 
                  taxScales={taxScales}
                  setTaxScales={setTaxScales}
               />
            )}
            {globalView === 'tasks' && (
               <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                     <i className="fa-solid fa-helmet-safety text-4xl mb-4 opacity-20"></i>
                     <p>Task Manager Coming Soon</p>
                  </div>
               </div>
            )}
         </div>
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
      
    </AppShell>
  );
}
