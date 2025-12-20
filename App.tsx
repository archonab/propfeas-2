
import React, { useState } from 'react';
import { GlobalTab, Project } from './types';
import { MOCK_PROJECTS } from './constants';
import { ProjectDashboard } from './ProjectDashboard';

const GlobalSidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex flex-col items-center py-4 space-y-1 transition-all group ${
      active ? 'text-slate-900 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    <i className={`${icon} text-lg`}></i>
    <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default function App() {
  const [activeGlobalTab, setActiveGlobalTab] = useState<GlobalTab>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const activeProject = MOCK_PROJECTS.find(p => p.id === activeProjectId);

  if (activeProject) {
    return (
      <div className="h-screen flex bg-slate-100 overflow-hidden font-sans">
        {/* Global Sidebar Persistent */}
        <aside className="w-20 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-6 no-print">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white mb-8">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <nav className="flex-1 w-full">
            <GlobalSidebarItem active={activeGlobalTab === 'projects'} onClick={() => { setActiveProjectId(null); setActiveGlobalTab('projects'); }} icon="fa-solid fa-building" label="Projects" />
            <GlobalSidebarItem active={activeGlobalTab === 'sites'} onClick={() => {}} icon="fa-solid fa-map-pin" label="Sites" />
            <GlobalSidebarItem active={activeGlobalTab === 'vendors'} onClick={() => {}} icon="fa-solid fa-users" label="Vendors" />
            <GlobalSidebarItem active={activeGlobalTab === 'procurement'} onClick={() => {}} icon="fa-solid fa-file-invoice" label="RFQs" />
            <GlobalSidebarItem active={activeGlobalTab === 'contracts'} onClick={() => {}} icon="fa-solid fa-file-signature" label="Contracts" />
            <GlobalSidebarItem active={activeGlobalTab === 'crm'} onClick={() => {}} icon="fa-solid fa-address-book" label="CRM" />
            <GlobalSidebarItem active={activeGlobalTab === 'admin'} onClick={() => {}} icon="fa-solid fa-user-gear" label="Admin" />
          </nav>
        </aside>
        
        <div className="flex-1 relative overflow-hidden">
          <ProjectDashboard project={activeProject} onBack={() => setActiveProjectId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-100 font-sans overflow-hidden">
      {/* Global Sidebar */}
      <aside className="w-20 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-6">
        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white mb-8">
          <i className="fa-solid fa-layer-group"></i>
        </div>
        <nav className="flex-1 w-full">
          <GlobalSidebarItem active={activeGlobalTab === 'projects'} onClick={() => setActiveGlobalTab('projects')} icon="fa-solid fa-building" label="Projects" />
          <GlobalSidebarItem active={activeGlobalTab === 'sites'} onClick={() => {}} icon="fa-solid fa-map-pin" label="Sites" />
          <GlobalSidebarItem active={activeGlobalTab === 'vendors'} onClick={() => {}} icon="fa-solid fa-users" label="Vendors" />
          <GlobalSidebarItem active={activeGlobalTab === 'procurement'} onClick={() => {}} icon="fa-solid fa-file-invoice" label="RFQs" />
          <GlobalSidebarItem active={activeGlobalTab === 'contracts'} onClick={() => {}} icon="fa-solid fa-file-signature" label="Contracts" />
          <GlobalSidebarItem active={activeGlobalTab === 'crm'} onClick={() => {}} icon="fa-solid fa-address-book" label="CRM" />
          <GlobalSidebarItem active={activeGlobalTab === 'admin'} onClick={() => {}} icon="fa-solid fa-user-gear" label="Admin" />
        </nav>
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer">
          <i className="fa-solid fa-user"></i>
        </div>
      </aside>

      {/* Main Content: Project Portfolio */}
      <main className="flex-1 overflow-y-auto p-10">
        <div className="max-w-7xl mx-auto">
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Portfolio</h1>
              <p className="text-slate-500 text-sm mt-1 font-medium">Global development directory and status overview.</p>
            </div>
            <button className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-all shadow-lg flex items-center text-sm">
              <i className="fa-solid fa-plus mr-2"></i> Create Project
            </button>
          </header>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center space-x-4">
              <div className="relative flex-1">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input type="text" placeholder="Search projects..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-slate-300 outline-none" />
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"><i className="fa-solid fa-filter mr-2"></i>Stage</button>
                <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"><i className="fa-solid fa-layer-group mr-2"></i>Status</button>
              </div>
            </div>
            
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Stage</th>
                  <th className="px-6 py-4">Start</th>
                  <th className="px-6 py-4">Finish</th>
                  <th className="px-6 py-4">Open Tasks</th>
                  <th className="px-6 py-4">RFIs</th>
                  <th className="px-6 py-4">Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MOCK_PROJECTS.map(project => (
                  <tr 
                    key={project.id} 
                    onClick={() => setActiveProjectId(project.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 mono text-xs text-slate-400">{project.code}</td>
                    <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{project.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight ${
                        project.stage === 'Planning' ? 'bg-blue-100 text-blue-700' :
                        project.stage === 'Construction' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {project.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">01 Mar 2024</td>
                    <td className="px-6 py-4 text-slate-500">{project.targetFinish}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-600">{project.openTasks}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-600">{project.openRFIs}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-600">{project.conditions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-400 font-medium tracking-tight">Showing {MOCK_PROJECTS.length} of {MOCK_PROJECTS.length} projects</span>
              <div className="flex space-x-1">
                <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50"><i className="fa-solid fa-chevron-left text-xs"></i></button>
                <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-slate-800 text-white font-bold text-xs">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50"><i className="fa-solid fa-chevron-right text-xs"></i></button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
