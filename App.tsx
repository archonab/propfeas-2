
import React, { useState } from 'react';
import { GlobalView, SiteLead, FeasibilitySettings } from './types';
import { MOCK_SITES } from './constants';
import { FeasibilityEngine } from './FeasibilityEngine';
import { ProjectDashboard } from './ProjectDashboard';

export default function App() {
  const [view, setView] = useState<GlobalView>('pipeline');
  const [sites, setSites] = useState<SiteLead[]>(MOCK_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const selectedSite = sites.find(p => p.id === selectedSiteId);

  const promoteSite = (id: string) => {
    setSites(prev => prev.map(p => p.id === id ? { ...p, status: 'Acquired', stage: 'Planning' } : p));
    setSelectedSiteId(null);
    setView('portfolio');
  };

  const updateSiteData = (id: string, settings: FeasibilitySettings) => {
    setSites(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          name: settings.projectName, // Update Title from settings
          dna: {
            ...p.dna,
            address: settings.site.address // Update Address from settings
          }
        };
      }
      return p;
    }));
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden font-sans">
      {/* Global Sidebar (Left Rail on Desktop, Bottom Nav on Mobile) */}
      <aside className="w-full md:w-16 h-16 md:h-auto bg-slate-900 flex flex-row md:flex-col items-center justify-around md:justify-start px-4 md:px-0 py-0 md:py-6 shrink-0 no-print order-2 md:order-1 z-50">
        <div className="hidden md:flex w-10 h-10 bg-blue-600 rounded-lg items-center justify-center text-white mb-10 shadow-lg shadow-blue-900/40">
          <i className="fa-solid fa-cube text-xl"></i>
        </div>
        
        <nav className="flex-1 w-full flex flex-row md:flex-col justify-around md:justify-start md:space-y-6">
          <NavIcon 
            active={view === 'pipeline'} 
            onClick={() => { setView('pipeline'); setSelectedSiteId(null); }} 
            icon="fa-solid fa-filter-circle-dollar" 
            label="Pipeline" 
          />
          <NavIcon 
            active={view === 'portfolio'} 
            onClick={() => { setView('portfolio'); setSelectedSiteId(null); }} 
            icon="fa-solid fa-building-user" 
            label="Portfolio" 
          />
          <NavIcon 
            active={view === 'admin'} 
            onClick={() => setView('admin')} 
            icon="fa-solid fa-gears" 
            label="Admin" 
          />
        </nav>
        
        <div className="hidden md:block mt-auto">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-700 transition-colors">
            <i className="fa-solid fa-user-tie"></i>
          </div>
        </div>
      </aside>

      {/* Main App Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col order-1 md:order-2">
        
        {/* Pipeline List View (Funnel Prospects) */}
        {view === 'pipeline' && !selectedSiteId && (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in duration-300">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Acquisition Pipeline</h1>
                <p className="text-sm text-slate-500 font-medium">Site scanning and rapid feasibility analysis.</p>
              </div>
              <button className="w-full md:w-auto px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg text-xs flex items-center justify-center">
                <i className="fa-solid fa-plus mr-2"></i> Scan New Site
              </button>
            </header>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 md:px-6 md:py-4">ID</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Opportunity</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Location</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                      <th className="px-4 py-3 md:px-6 md:py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sites.filter(p => p.status === 'Prospect' || p.status === 'Due Diligence').map(site => (
                      <tr 
                        key={site.id} 
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <td className="px-4 py-3 md:px-6 md:py-4 mono text-xs text-slate-400">{site.code}</td>
                        <td className="px-4 py-3 md:px-6 md:py-4 font-bold text-slate-700">{site.name}</td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-slate-500">{site.dna.address}</td>
                        <td className="px-4 py-3 md:px-6 md:py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                              site.status === 'Due Diligence' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {site.status}
                            </span>
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                          <button className="text-blue-600 font-bold text-xs hover:underline flex items-center justify-end w-full">
                            <span className="hidden md:inline">Open Model</span> <i className="fa-solid fa-arrow-right ml-2"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Detail View (Full Page Acquisition Model) */}
        {view === 'pipeline' && selectedSite && (
          <div className="flex-1 p-3 md:p-8 overflow-y-auto bg-slate-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-7xl mx-auto">
              <header className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 pb-4 md:pb-6 border-b border-slate-200 gap-4 md:gap-0">
                <div>
                  <button 
                    onClick={() => setSelectedSiteId(null)} 
                    className="text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center mb-2 md:mb-4"
                  >
                    <i className="fa-solid fa-chevron-left mr-2"></i> Back to Pipeline
                  </button>
                  <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight uppercase leading-tight">{selectedSite.name}</h2>
                  <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Acquisition Feasibility Model v1.4</p>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto">
                   <div className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${selectedSite.status === 'Due Diligence' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
                      {selectedSite.status}
                   </div>
                   <div className="w-px h-8 bg-slate-300 mx-2"></div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Last Updated</p>
                      <p className="text-xs font-bold text-slate-700">Just Now</p>
                   </div>
                </div>
              </header>
              
              <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 p-4 md:p-8">
                <FeasibilityEngine 
                  site={selectedSite} // Pass full site object
                  isEditable={true} 
                  onPromote={() => promoteSite(selectedSite.id)}
                  onChange={(newSettings) => updateSiteData(selectedSite.id, newSettings)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Portfolio View (Active Projects) */}
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
                    onClick={() => setSelectedSiteId(site.id)}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
                  >
                    <div className="h-40 bg-slate-100 relative overflow-hidden">
                       <img src={site.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                       <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-800 shadow-sm">
                          {site.stage}
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
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center">
                             Workspace <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                          </span>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Selected Project Shell (Full ERP Workspace) */}
        {view === 'portfolio' && selectedSite && (
          <ProjectDashboard 
            site={selectedSite} 
            onBack={() => setSelectedSiteId(null)} 
          />
        )}

        {view === 'admin' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
             <i className="fa-solid fa-gears text-5xl mb-4"></i>
             <h2 className="text-xl font-bold">Admin Settings</h2>
             <p className="text-sm">Configure global tax rates, user roles, and enterprise modules.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const NavIcon = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
  <button 
    onClick={onClick}
    className={`md:w-full flex flex-col items-center space-y-1 transition-colors relative group py-2 px-4 md:px-0 md:py-0 ${active ? 'text-blue-400 md:text-white' : 'text-slate-500 hover:text-slate-300'}`}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r shadow-[0_0_15px_rgba(59,130,246,0.6)] hidden md:block"></div>}
    {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t md:hidden"></div>}
    <i className={`${icon} text-xl md:text-lg`}></i>
    <span className="text-[9px] font-black uppercase tracking-tighter hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">{label}</span>
  </button>
);
