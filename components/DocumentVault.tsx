
import React from 'react';
import { Site } from '../types';

interface Props {
  site: Site;
  readOnly?: boolean;
}

export const DocumentVault: React.FC<Props> = ({ site, readOnly = false }) => {
  return (
    <div className="animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800">Document Vault</h3>
                <p className="text-sm text-slate-500">Central repository for contracts, permits, and surveys.</p>
            </div>
            {!readOnly && (
                <button className="text-xs font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center shadow-sm">
                    <i className="fa-solid fa-cloud-arrow-up mr-2 text-indigo-500"></i> Upload
                </button>
            )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {['Contract of Sale', 'Title Search', 'Planning Permit', 'Feature Survey', 'Geotech Report'].map((doc, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group h-40 relative">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-3 transition-colors">
                        <i className="fa-solid fa-file-pdf text-xl"></i>
                    </div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900 line-clamp-2">{doc}</span>
                    <span className="text-[10px] text-slate-400 mt-1">2.4 MB • 12 Jan 24</span>
                    
                    <button className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </div>
            ))}
            
            {!readOnly && (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-all h-40">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        <i className="fa-solid fa-plus"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-500">Upload New File</span>
                </div>
            )}
        </div>
    </div>
  );
};
