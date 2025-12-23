
import React from 'react';
import { Site } from '../types-v2';

interface Props {
  site: Site;
  onOpenScenario: (scenarioId: string) => void;
  onCreateScenario: () => void;
}

export const SiteDashboard: React.FC<Props> = ({ site, onOpenScenario, onCreateScenario }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* 1. SITE HEADER (The Asset) */}
      <div className="flex justify-between items-start mb-8">
        <div>
           <div className="flex items-center space-x-3 mb-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${
                  site.status === 'Acquired' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                 {site.status}
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">{site.code}</span>
           </div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{site.name}</h1>
           <div className="flex items-center text-slate-500 text-sm">
              <i className="fa-solid fa-location-dot mr-2"></i> {site.identity.address}
              <span className="mx-3">•</span>
              <i className="fa-solid fa-ruler-combined mr-2"></i> {site.identity.landArea.toLocaleString()} sqm
              <span className="mx-3">•</span>
              <i className="fa-solid fa-building mr-2"></i> {site.identity.zoning}
           </div>
        </div>
        
        {/* Map / Hero Thumbnail */}
        <div className="w-48 h-32 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-sm">
           <img src={site.thumbnail} className="w-full h-full object-cover" alt="Site" />
        </div>
      </div>

      <hr className="border-slate-200 mb-8" />

      {/* 2. SCENARIO MATRIX (The Options) */}
      <div className="flex justify-between items-end mb-6">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Feasibility Scenarios</h2>
            <p className="text-slate-500 text-sm mt-1">Manage financial models and development options for this site.</p>
         </div>
         <button 
            onClick={onCreateScenario}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors text-sm flex items-center"
         >
            <i className="fa-solid fa-plus mr-2"></i> New Scenario
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Scenario Cards */}
         {site.scenarios.map(scen => (
            <div 
               key={scen.id} 
               onClick={() => onOpenScenario(scen.id)}
               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group"
            >
               <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${scen.strategy === 'SELL' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>
                     {scen.strategy}
                  </span>
                  {scen.isBaseline && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Baseline</span>}
               </div>
               
               <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-indigo-600">{scen.name}</h3>
               <p className="text-xs text-slate-400 mb-4">Last updated {new Date(scen.updatedAt).toLocaleDateString()}</p>
               
               <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>View Details</span>
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
               </div>
            </div>
         ))}
         
         {/* Add New Ghost Card (for empty states) */}
         {site.scenarios.length === 0 && (
            <div 
                onClick={onCreateScenario}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all min-h-[200px]"
            >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <i className="fa-solid fa-plus text-xl"></i>
                </div>
                <h3 className="font-bold text-slate-600">Create First Scenario</h3>
            </div>
         )}
      </div>

      {/* 3. ACTIVE PROJECT (Execution) - Future Proofing */}
      {site.status === 'Acquired' && (
         <div className="mt-12 opacity-50 grayscale hover:grayscale-0 transition-all cursor-not-allowed border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
            <i className="fa-solid fa-helmet-safety text-4xl text-slate-300 mb-4"></i>
            <h3 className="text-lg font-bold text-slate-800">Construction Project</h3>
            <p className="text-sm text-slate-500">Promote a feasibility scenario to start the active project module.</p>
         </div>
      )}

    </div>
  );
};
