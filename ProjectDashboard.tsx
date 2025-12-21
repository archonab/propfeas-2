
import React, { useState } from 'react';
import { Project, ProjectModule } from './types';
import { FeasibilityEngine } from './FeasibilityEngine';

interface Props {
  project: Project;
  onBack: () => void;
}

const ProjectSidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all text-sm font-semibold ${
      active ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`}
  >
    <i className={`${icon} w-5 text-center`}></i>
    <span>{label}</span>
  </button>
);

export const ProjectDashboard: React.FC<Props> = ({ project, onBack }) => {
  const [activeModule, setActiveModule] = useState<ProjectModule>('overview');

  const navItems: { id: ProjectModule; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-pie' },
    { id: 'feasibility', label: 'Feasibility (Baseline)', icon: 'fa-solid fa-calculator' },
    { id: 'procurement', label: 'RFQs / Tenders', icon: 'fa-solid fa-file-contract' },
    { id: 'sales', label: 'Sales & Settlements', icon: 'fa-solid fa-dollar-sign' },
    { id: 'files', label: 'Documents', icon: 'fa-solid fa-folder' },
  ];

  return (
    <div className="h-full flex overflow-hidden animate-in fade-in duration-300">
      {/* Project Secondary Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col no-print shrink-0">
        <div className="p-6 border-b border-slate-200 bg-white">
          <button onClick={onBack} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors mb-4 flex items-center">
            <i className="fa-solid fa-chevron-left mr-2"></i> Portfolio
          </button>
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="overflow-hidden">
                <h2 className="text-sm font-black text-slate-800 truncate leading-tight">{project.name}</h2>
                <p className="text-[10px] text-slate-500 truncate">{project.address}</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
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

        <div className="p-6 bg-white border-t border-slate-200">
           <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stage: {project.stage}</span>
              <span className="text-[10px] font-bold text-blue-600">42%</span>
           </div>
           <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[42%]"></div>
           </div>
        </div>
      </aside>

      {/* Module Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-white relative">
        <div className="max-w-6xl mx-auto">
          {activeModule === 'overview' && (
            <div className="animate-in fade-in duration-500">
               <header className="mb-10">
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Project Overview</h1>
                  <p className="text-sm text-slate-500">Consolidated live performance data from all enterprise modules.</p>
               </header>

               <div className="grid grid-cols-4 gap-6 mb-10">
                  <SummaryCard label="Open Tasks" val={project.openTasks} icon="fa-solid fa-list-check" color="text-slate-800" />
                  <SummaryCard label="Open RFIs" val={project.openRFIs} icon="fa-solid fa-circle-question" color="text-amber-600" />
                  <SummaryCard label="Conditions" val={project.conditions} icon="fa-solid fa-file-contract" color="text-blue-600" />
                  <SummaryCard label="Settled Units" val="8/20" icon="fa-solid fa-hand-holding-dollar" color="text-emerald-600" />
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                     <i className="fa-solid fa-chart-line text-4xl text-slate-200 mb-4 block"></i>
                     <h3 className="text-sm font-bold text-slate-800">Financial Variance Tracking</h3>
                     <p className="text-xs text-slate-500 mt-2">Comparison of live actuals against the Feasibility Baseline. Coming soon.</p>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                     <i className="fa-solid fa-users-gear text-4xl text-slate-200 mb-4 block"></i>
                     <h3 className="text-sm font-bold text-slate-800">Team Collaboration</h3>
                     <p className="text-xs text-slate-500 mt-2">Manage user permissions and task assignments for this site.</p>
                  </div>
               </div>
            </div>
          )}

          {activeModule === 'feasibility' && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
               <header className="mb-8 flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Feasibility Baseline</h1>
                    <p className="text-sm text-slate-500 italic">Locked snapshot from Acquisition Phase</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-widest border border-blue-200">
                    <i className="fa-solid fa-lock mr-2"></i> Read Only
                  </span>
               </header>
               <FeasibilityEngine projectName={project.name} isEditable={false} />
            </div>
          )}

          {['procurement', 'sales', 'files'].includes(activeModule) && (
            <div className="flex flex-col items-center justify-center py-40 animate-in zoom-in-95 duration-500">
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
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
     <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
           <i className={icon}></i>
        </div>
     </div>
     <p className={`text-2xl font-black ${color}`}>{val}</p>
     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
  </div>
);
