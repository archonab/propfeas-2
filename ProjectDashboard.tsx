
import React, { useState } from 'react';
import { Project, ProjectModule } from './types';
import { FeasibilityModule } from './FeasibilityModule';

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
  const [activeModule, setActiveModule] = useState<ProjectModule>('feasibility');

  const navItems: { id: ProjectModule; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-pie' },
    { id: 'tasks', label: 'Tasks', icon: 'fa-solid fa-check-double' },
    { id: 'procurement', label: 'RFQs / Tenders', icon: 'fa-solid fa-file-contract' },
    { id: 'contracts', label: 'Contracts', icon: 'fa-solid fa-file-signature' },
    { id: 'rfi', label: 'RFIs & Issues', icon: 'fa-solid fa-circle-question' },
    { id: 'files', label: 'Files', icon: 'fa-solid fa-folder' },
    { id: 'sales', label: 'Sales & Settlements', icon: 'fa-solid fa-dollar-sign' },
    { id: 'feasibility', label: 'Feasibility', icon: 'fa-solid fa-calculator' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0 no-print">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 pr-6 border-r border-slate-100">
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-700">{project.name}</span>
              <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
            </div>
          </div>
          <div className="relative w-80">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" placeholder="Search project tasks, docs..." className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-1.5 border border-slate-200 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center">
            <i className="fa-solid fa-layer-group mr-2"></i> Apply Playbook
          </button>
          <button className="px-4 py-1.5 bg-slate-800 text-white rounded-md text-xs font-bold hover:bg-slate-700 transition-all flex items-center">
            <i className="fa-solid fa-plus mr-2"></i> New Scenario
          </button>
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600"><i className="fa-solid fa-bell"></i></button>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">SM</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Secondary Navigation */}
        <aside className="w-64 border-r border-slate-200 p-4 space-y-1 overflow-y-auto no-print">
          <button onClick={onBack} className="w-full mb-6 flex items-center px-4 py-2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold uppercase tracking-widest">
            <i className="fa-solid fa-chevron-left mr-2"></i> Portfolio
          </button>
          {navItems.map(item => (
            <ProjectSidebarItem key={item.id} active={activeModule === item.id} onClick={() => setActiveModule(item.id)} icon={item.icon} label={item.label} />
          ))}
          
          <div className="mt-10 pt-6 border-t border-slate-100">
            <h4 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Project Context</h4>
            <div className="px-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Project Manager</span>
                <span className="font-bold text-slate-700">{project.pm}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Status</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase">{project.status}</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-blue-500 w-[42%]"></div>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-2 font-medium italic">Stage Completion: 42%</p>
            </div>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-8 print:p-0">
          <div className="max-w-6xl mx-auto">
            {activeModule === 'feasibility' && (
              <div className="space-y-6">
                <header className="flex justify-between items-end mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Feasibility - {project.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">DCF & Residual Land Value Models</p>
                  </div>
                  <div className="flex space-x-2 no-print">
                    <button className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                      <i className="fa-solid fa-file-pdf mr-2"></i> Export Summary
                    </button>
                    <button className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-all">
                      <i className="fa-solid fa-plus mr-2"></i> New Scenario
                    </button>
                  </div>
                </header>
                <FeasibilityModule projectName={project.name} />
              </div>
            )}

            {activeModule === 'overview' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">{project.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">Performance Dashboard</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider">{project.stage} Phase</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-check-double"></i></div>
                      <span className="text-[10px] font-bold text-blue-500">+3 this week</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{project.openTasks}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Open Tasks</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-circle-question"></i></div>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{project.openRFIs}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Open RFIs</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-file-contract"></i></div>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{project.conditions}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Permit Conditions</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-chart-line"></i></div>
                      <span className="text-[10px] font-bold text-emerald-500">+8% MoM</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">42%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sales Progress</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-6">Recent Activity & Approvals</h3>
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-start space-x-4 pb-4 border-b border-slate-50 last:border-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0"></div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">John Davis <span className="font-medium text-slate-500">approved RFI-024</span></p>
                            <p className="text-[10px] text-slate-400 mt-1">2 hours ago</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-6">Latest Documents</h3>
                    <div className="space-y-2">
                      {['Architectural Plans Rev C', 'Feasibility Update Q4', 'Geotechnical Report'].map(doc => (
                        <div key={doc} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group">
                          <div className="flex items-center space-x-3">
                            <i className="fa-solid fa-file-lines text-slate-400"></i>
                            <span className="text-xs font-semibold text-slate-700">{doc}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-500 text-[9px] font-bold uppercase">Published</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {['tasks', 'procurement', 'contracts', 'rfi', 'files', 'sales'].includes(activeModule) && (
              <div className="flex flex-col items-center justify-center py-40 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-slate-200 shadow-sm border border-slate-100 mb-6">
                  <i className={`${navItems.find(n => n.id === activeModule)?.icon} text-4xl`}></i>
                </div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Enterprise Module: {navItems.find(n => n.id === activeModule)?.label}</h3>
                <p className="text-slate-500 text-sm mt-2 max-w-sm text-center font-medium leading-relaxed">
                  This core module is being integrated with the Golden Thread ledger. Real-time data sync with Feasibility Baseline coming soon.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
