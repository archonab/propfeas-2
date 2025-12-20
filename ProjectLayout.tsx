
import React, { useState } from 'react';
import { Project, ProjectModule } from './types';
import { FeasibilityModule } from './FeasibilityModule';

interface Props {
  project: Project;
  onBack: () => void;
}

export const ProjectLayout: React.FC<Props> = ({ project, onBack }) => {
  const [activeModule, setActiveModule] = useState<ProjectModule>('feasibility');

  const menuItems: { id: ProjectModule; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'fa-solid fa-house' },
    { id: 'feasibility', label: 'Feasibility', icon: 'fa-solid fa-calculator' },
    // Fix: Updated 'construction' to 'tasks' to match the ProjectModule type defined in types.ts
    { id: 'tasks', label: 'Construction (PM)', icon: 'fa-solid fa-helmet-safety' },
    { id: 'sales', label: 'Sales & Marketing', icon: 'fa-solid fa-tags' }
  ];

  return (
    <div className="flex h-full animate-in slide-in-from-left duration-300">
      {/* Project Sidebar */}
      <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col no-print">
        <div className="p-6 border-b border-slate-700">
          <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white mb-4 flex items-center">
            <i className="fa-solid fa-chevron-left mr-2"></i> Back to Portfolio
          </button>
          <div className="flex items-center space-x-3">
            <img src={project.thumbnail} className="w-10 h-10 rounded object-cover border border-slate-700" alt={project.name} />
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-white truncate leading-tight">{project.name}</h2>
              <p className="text-[10px] truncate text-slate-500">{project.address}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeModule === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-700'
              }`}
            >
              <i className={`${item.icon} w-5`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 bg-slate-900/50">
          <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Project Stats</div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px]">Status</span>
            <span className="text-[10px] text-emerald-400 font-bold">{project.status}</span>
          </div>
          <div className="w-full bg-slate-700 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-500 h-full w-[35%]"></div>
          </div>
        </div>
      </aside>

      {/* Module Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8 print:p-0">
        <header className="mb-8 no-print">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{menuItems.find(i => i.id === activeModule)?.label}</h1>
              <p className="text-sm text-slate-500 mt-1">{project.name} • Internal Module</p>
            </div>
            <div className="flex items-center space-x-4">
               <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-white">JD</div>
                  <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-white">SK</div>
                  <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-600">+3</div>
               </div>
               <button className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 transition-colors">
                  <i className="fa-solid fa-bell text-sm"></i>
               </button>
            </div>
          </div>
        </header>

        {activeModule === 'feasibility' && <FeasibilityModule projectName={project.name} />}
        
        {activeModule === 'overview' && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center animate-in zoom-in-95 duration-500">
            <i className="fa-solid fa-compass-drafting text-4xl text-slate-200 mb-4 block"></i>
            <h3 className="text-xl font-bold text-slate-800">Project Overview Dashboard</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Consolidating high-level metrics across all active modules. Coming soon to your DevFeas Pro workspace.</p>
          </div>
        )}

        {/* Fix: Updated module check from 'construction' to 'tasks' */}
        {activeModule === 'tasks' && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center animate-in zoom-in-95 duration-500">
            <i className="fa-solid fa-helmet-safety text-4xl text-slate-200 mb-4 block"></i>
            <h3 className="text-xl font-bold text-slate-800">Gantt & Tasks Module</h3>
            <p className="text-slate-500 mt-2">The construction module will integrate with feasibility baseline to track variance in real-time. Coming soon.</p>
          </div>
        )}

        {activeModule === 'sales' && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center animate-in zoom-in-95 duration-500">
            <i className="fa-solid fa-tags text-4xl text-slate-200 mb-4 block"></i>
            <h3 className="text-xl font-bold text-slate-800">Inventory & Leads</h3>
            <p className="text-slate-500 mt-2">Manage unit sales, commissions, and buyer communications in one secure portal. Coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
};
