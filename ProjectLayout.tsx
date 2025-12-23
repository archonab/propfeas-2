
import React, { useState } from 'react';
import { Site, ProjectModule } from './types';
import { FeasibilityModule } from './FeasibilityModule';

interface Props {
  site: Site;
  onBack: () => void;
}

export const ProjectLayout: React.FC<Props> = ({ site, onBack }) => {
  const [activeModule, setActiveModule] = useState<ProjectModule>('feasibility');

  const ModuleTab = ({ id, label, icon }: { id: ProjectModule, label: string, icon: string }) => (
    <button
      onClick={() => setActiveModule(id)}
      className={`relative px-4 py-3 text-sm font-bold flex items-center transition-colors ${
        activeModule === id 
        ? 'text-slate-900' 
        : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <i className={`${icon} mr-2 ${activeModule === id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
      {label}
      {/* Active Underline */}
      {activeModule === id && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* PROJECT HEADER (Context) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shrink-0">
        
        {/* Top Row: Breadcrumbs & Actions */}
        <div className="px-6 py-3 flex justify-between items-center border-b border-slate-100">
           <div className="flex items-center space-x-3 text-sm">
              <button onClick={onBack} className="text-slate-400 hover:text-slate-700 font-medium transition-colors">
                 Portfolio
              </button>
              <span className="text-slate-300">/</span>
              <div className="flex items-center space-x-2">
                 <div className="font-bold text-slate-800">{site.name}</div>
                 <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                     site.status === 'Acquired' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                     'bg-amber-50 text-amber-700 border-amber-100'
                 }`}>
                    {site.status}
                 </span>
              </div>
           </div>

           <div className="flex items-center space-x-3">
              <button className="text-slate-400 hover:text-slate-600 px-2">
                 <i className="fa-solid fa-bell"></i>
              </button>
              <button className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                 Share
              </button>
           </div>
        </div>

        {/* Bottom Row: Module Navigation */}
        <div className="px-6 flex space-x-2">
           <ModuleTab id="overview" label="Overview" icon="fa-solid fa-chart-pie" />
           <ModuleTab id="feasibility" label="Feasibility" icon="fa-solid fa-calculator" />
           <ModuleTab id="tasks" label="Construction" icon="fa-solid fa-helmet-safety" />
           <ModuleTab id="sales" label="Sales & CRM" icon="fa-solid fa-tags" />
        </div>
      </header>

      {/* CANVAS CONTENT */}
      <main className="flex-1 overflow-hidden relative">
        {activeModule === 'feasibility' && <FeasibilityModule site={site} />}
        
        {/* Placeholders for future modules */}
        {activeModule === 'overview' && (
           <div className="p-12 text-center text-slate-400">
              <i className="fa-solid fa-chart-pie text-4xl mb-4 opacity-20"></i>
              <p>Project Dashboard Coming Soon</p>
           </div>
        )}
        {activeModule === 'tasks' && (
           <div className="p-12 text-center text-slate-400">
              <i className="fa-solid fa-helmet-safety text-4xl mb-4 opacity-20"></i>
              <p>Construction Management Module</p>
           </div>
        )}
        {activeModule === 'sales' && (
           <div className="p-12 text-center text-slate-400">
              <i className="fa-solid fa-tags text-4xl mb-4 opacity-20"></i>
              <p>Sales & CRM Module</p>
           </div>
        )}
      </main>

    </div>
  );
};
