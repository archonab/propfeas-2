
import React from 'react';

interface Props {
  children: React.ReactNode;
  activeModule?: 'portfolio' | 'settings' | 'tasks' | 'feasibilities';
  onNavigate?: (module: 'portfolio' | 'settings' | 'tasks' | 'feasibilities') => void;
}

export const AppShell: React.FC<Props> = ({ children, activeModule = 'portfolio', onNavigate }) => {
  
  const NavIcon = ({ id, icon, label }: { id: 'portfolio' | 'settings' | 'tasks' | 'feasibilities', icon: string, label: string }) => (
    <button 
      onClick={() => onNavigate && onNavigate(id)}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200 group relative ${
        activeModule === id 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <i className={`fa-solid ${icon}`}></i>
      
      {/* Tooltip */}
      <span className="absolute left-14 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700">
        {label}
      </span>
    </button>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* GLOBAL RAIL (Immutable) */}
      <aside className="w-[60px] bg-slate-900 flex flex-col items-center py-6 shrink-0 z-[60] border-r border-slate-800">
        
        {/* Brand */}
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs mb-8 shadow-inner border border-white/10">
           DF
        </div>

        {/* App Switcher */}
        <nav className="flex-1 flex flex-col space-y-4">
           <NavIcon id="portfolio" icon="fa-th-large" label="Portfolio" />
           <NavIcon id="feasibilities" icon="fa-calculator" label="All Feasibilities" />
           <NavIcon id="tasks" icon="fa-list-check" label="Tasks & Gantt" />
           <div className="flex-1"></div>
           <NavIcon id="settings" icon="fa-sliders" label="System Settings" />
        </nav>

        {/* User Profile */}
        <div className="mt-auto pt-4">
           <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 cursor-pointer hover:border-slate-400">
              JD
           </div>
        </div>
      </aside>

      {/* MAIN CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        {children}
      </div>

    </div>
  );
};
