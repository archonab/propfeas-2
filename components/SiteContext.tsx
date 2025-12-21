
import React from 'react';
import { Site } from '../types';

interface Props {
  site: Site;
  onRequestEdit: () => void;
}

export const SiteContext: React.FC<Props> = ({ site, onRequestEdit }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
       
       <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="fa-solid fa-lock"></i>
             </div>
             <div>
                <h3 className="text-sm font-bold text-blue-900">Site Context is Read-Only</h3>
                <p className="text-xs text-blue-700">These properties are managed globally in Site Settings.</p>
             </div>
          </div>
          <button 
            onClick={onRequestEdit}
            className="px-4 py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-100 transition-colors shadow-sm"
          >
            Edit in Site Settings <i className="fa-solid fa-arrow-right ml-2"></i>
          </button>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
             <h3 className="font-bold text-slate-800">Physical Attributes</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Address</label>
                   <div className="text-sm font-bold text-slate-800">{site.dna.address}</div>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Land Area</label>
                   <div className="text-lg font-mono font-bold text-slate-800">{site.dna.landArea.toLocaleString()} sqm</div>
                </div>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Council (LGA)</label>
                   <div className="text-sm font-bold text-slate-800">{site.dna.lga || '-'}</div>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Zoning</label>
                   <div className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block">
                      {site.dna.zoning || 'Pending'}
                   </div>
                </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-80">
             <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Agent Details</h4>
             <p className="text-sm font-bold text-slate-800">{site.dna.agent.name || 'Unassigned'}</p>
             <p className="text-xs text-slate-500">{site.dna.agent.company}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-80">
             <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Vendor Details</h4>
             <p className="text-sm font-bold text-slate-800">{site.dna.vendor.name || 'Unknown'}</p>
             <p className="text-xs text-slate-500">{site.dna.vendor.company}</p>
          </div>
       </div>

    </div>
  );
};
