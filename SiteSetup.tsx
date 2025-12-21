
import React, { useState } from 'react';
import { FeasibilitySettings, SiteDNA } from './types';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (settings: FeasibilitySettings) => void;
}

// Simulated "Smart Data" Provider
const MOCK_ADDRESS_RESULTS = [
  {
    address: "49 King St, Dandenong VIC 3175",
    dna: {
      landArea: 1250,
      zoning: "GRZ1 (General Residential)",
      lga: "City of Greater Dandenong",
      overlays: ["Heritage Overlay (HO102)", "Vegetation Protection (VPO1)"]
    }
  },
  {
    address: "120 Collins St, Melbourne VIC 3000",
    dna: {
      landArea: 2400,
      zoning: "C1Z (Commercial 1 Zone)",
      lga: "City of Melbourne",
      overlays: ["Design and Development (DDO10)"]
    }
  },
  {
    address: "88 O'Riordan St, Mascot NSW 2020",
    dna: {
      landArea: 3100,
      zoning: "B4 Mixed Use",
      lga: "Bayside Council",
      overlays: ["Airport Operating Height"]
    }
  },
  {
    address: "1 Martin Pl, Sydney NSW 2000",
    dna: {
      landArea: 1850,
      zoning: "B8 Metropolitan Centre",
      lga: "City of Sydney",
      overlays: ["Heritage (State)", "Rail Infrastructure"]
    }
  },
  {
    address: "1 Queen St, Brisbane City QLD 4000",
    dna: {
      landArea: 950,
      zoning: "PC1 Principal Centre",
      lga: "Brisbane City Council",
      overlays: ["Biodiversity Areas", "Flood Planning"]
    }
  }
];

export const SiteSetup: React.FC<Props> = ({ settings, onUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { site } = settings;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowResults(true);
    
    // Enable manual entry persistence:
    // Update the site address AND Project Name in real-time
    onUpdate({
      ...settings,
      projectName: val.split(',')[0], // Sync Title to Address
      site: { ...site, address: val }
    });
  };

  const selectAddress = (result: typeof MOCK_ADDRESS_RESULTS[0]) => {
    const newSite: SiteDNA = {
      ...site,
      address: result.address,
      landArea: result.dna.landArea,
      zoning: result.dna.zoning,
      lga: result.dna.lga,
      overlays: result.dna.overlays
    };

    onUpdate({
      ...settings,
      projectName: result.address.split(',')[0], // Set Project Name to Address automatically
      site: newSite
    });

    setSearchQuery(result.address);
    setShowResults(false);
  };

  const updateSiteField = (field: keyof SiteDNA, value: any) => {
    onUpdate({ ...settings, site: { ...site, [field]: value } });
  };

  const updateNestedField = (parent: 'agent' | 'vendor' | 'milestones', field: string, value: any) => {
    onUpdate({
      ...settings,
      site: {
        ...site,
        [parent]: { ...site[parent], [field]: value }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Smart Address Search */}
      <div className="relative z-50">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Search Property Address</label>
        <div className="relative">
          <div className="absolute left-4 top-3.5 text-slate-400">
            <i className="fa-solid fa-magnifying-glass text-lg"></i>
          </div>
          <input 
            type="text" 
            value={searchQuery || site.address}
            onChange={handleSearchChange}
            onFocus={() => setShowResults(true)}
            placeholder="Start typing address (e.g. 49 King St)..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl shadow-sm text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {showResults && searchQuery.length > 1 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
               <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 CoreLogic / Title Suggestions
               </div>
               {MOCK_ADDRESS_RESULTS.filter(r => r.address.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                 <div className="p-4 text-sm text-slate-500 italic">
                    No exact match in database. Manual entry enabled.
                 </div>
               ) : (
                 MOCK_ADDRESS_RESULTS.filter(r => r.address.toLowerCase().includes(searchQuery.toLowerCase())).map((result, idx) => (
                    <button 
                      key={idx}
                      onClick={() => selectAddress(result)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center group transition-colors border-b border-slate-50 last:border-0"
                    >
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-200 group-hover:text-blue-600 mr-3">
                          <i className="fa-solid fa-map-pin"></i>
                       </div>
                       <div>
                          <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700">{result.address}</div>
                          <div className="text-xs text-slate-500 flex items-center mt-0.5">
                             <span className="mr-2">Lot {idx + 10} PS402</span>
                             <span className="w-1 h-1 rounded-full bg-slate-300 mx-2"></span>
                             <span>{result.dna.zoning}</span>
                          </div>
                       </div>
                    </button>
                 ))
               )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Section A: Site Identity (Left) */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center">
                    <i className="fa-solid fa-city mr-2 text-slate-400"></i>
                    Site Context & DNA
                 </h3>
                 <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase">Verified Data</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                 {/* Map Placeholder */}
                 <div className="bg-slate-100 min-h-[250px] relative group overflow-hidden border-r border-slate-200">
                    <img 
                       src="https://images.unsplash.com/photo-1524813686514-a5756c97759e?q=80&w=600&auto=format&fit=crop" 
                       className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                       alt="Map" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <button className="bg-white/90 backdrop-blur shadow-lg px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:scale-105 transition-transform">
                          <i className="fa-solid fa-map-pin inline mr-1 text-red-500"></i> View on Maps
                       </button>
                    </div>
                 </div>

                 {/* Physical Attributes Form */}
                 <div className="p-6 space-y-5">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Land Area (sqm)</label>
                       <input 
                         type="number" 
                         value={site.landArea}
                         onChange={(e) => updateSiteField('landArea', parseFloat(e.target.value))}
                         className="w-full border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-blue-500"
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local Government Area (LGA)</label>
                       <input 
                         type="text" 
                         value={site.lga}
                         onChange={(e) => updateSiteField('lga', e.target.value)}
                         className="w-full border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-blue-500"
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoning Code</label>
                       <input 
                         type="text" 
                         value={site.zoning}
                         onChange={(e) => updateSiteField('zoning', e.target.value)}
                         className="w-full border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-blue-500"
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Planning Overlays</label>
                       <div className="flex flex-wrap gap-2">
                          {site.overlays.map((ov, i) => (
                             <span key={i} className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-800 rounded text-[10px] font-bold flex items-center">
                                <i className="fa-solid fa-circle-exclamation mr-1"></i> {ov}
                             </span>
                          ))}
                          {site.overlays.length === 0 && <span className="text-xs text-slate-400 italic">No overlays detected</span>}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Section B: Deal Team */}
           <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                     <i className="fa-solid fa-circle-user mr-2 text-blue-500"></i> Selling Agent
                  </h4>
                  <div className="space-y-3">
                     <input 
                        type="text" placeholder="Agent Name"
                        value={site.agent.name}
                        onChange={(e) => updateNestedField('agent', 'name', e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                     />
                     <input 
                        type="text" placeholder="Agency / Company"
                        value={site.agent.company}
                        onChange={(e) => updateNestedField('agent', 'company', e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                     />
                     <div className="flex items-center space-x-2 pt-1">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors">
                           <i className="fa-solid fa-link text-sm"></i>
                        </div>
                        <span className="text-xs text-slate-400 italic">Link to CRM Contact</span>
                     </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                     <i className="fa-solid fa-circle-user mr-2 text-indigo-500"></i> Vendor Details
                  </h4>
                  <div className="space-y-3">
                     <input 
                        type="text" placeholder="Vendor Name / Entity"
                        value={site.vendor.name}
                        onChange={(e) => updateNestedField('vendor', 'name', e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-indigo-500"
                     />
                     <input 
                        type="text" placeholder="Vendor Solicitor (Optional)"
                        value={site.vendor.company}
                        onChange={(e) => updateNestedField('vendor', 'company', e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-indigo-500"
                     />
                  </div>
              </div>
           </div>
        </div>

        {/* Section C: Critical Path (Right) */}
        <div className="col-span-12 lg:col-span-4">
           <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-6 h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                 <i className="fa-solid fa-calendar text-8xl"></i>
              </div>
              
              <h3 className="text-lg font-bold mb-1 relative z-10">Critical Path</h3>
              <p className="text-xs text-slate-400 mb-6 relative z-10">Key Dates & Milestones</p>

              <div className="space-y-8 relative z-10 flex-1">
                 {/* Acquisition */}
                 <div className="relative pl-6 border-l-2 border-slate-700">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Acquisition / Exchange</label>
                    <input 
                       type="date" 
                       value={site.milestones.acquisitionDate || ''}
                       onChange={(e) => updateNestedField('milestones', 'acquisitionDate', e.target.value)}
                       className="bg-slate-800 border-slate-700 text-white text-xs rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500"
                    />
                 </div>

                 {/* Settlement */}
                 <div className="relative pl-6 border-l-2 border-slate-700">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-700 border-4 border-slate-900"></div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Land Settlement</label>
                    <input 
                       type="date" 
                       value={site.milestones.settlementDate || ''}
                       onChange={(e) => updateNestedField('milestones', 'settlementDate', e.target.value)}
                       className="bg-slate-800 border-slate-700 text-white text-xs rounded px-2 py-1 w-full focus:ring-1 focus:ring-slate-500"
                    />
                 </div>

                 {/* Construction Start */}
                 <div className="relative pl-6 border-l-2 border-slate-700">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-700 border-4 border-slate-900"></div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Construction Commences</label>
                    <input 
                       type="date" 
                       value={site.milestones.constructionStartDate || ''}
                       onChange={(e) => updateNestedField('milestones', 'constructionStartDate', e.target.value)}
                       className="bg-slate-800 border-slate-700 text-white text-xs rounded px-2 py-1 w-full focus:ring-1 focus:ring-slate-500"
                    />
                 </div>

                 {/* Practical Completion */}
                 <div className="relative pl-6 border-l-2 border-transparent">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-slate-900"></div>
                    <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-1">Practical Completion</label>
                    <input 
                       type="date" 
                       value={site.milestones.completionDate || ''}
                       onChange={(e) => updateNestedField('milestones', 'completionDate', e.target.value)}
                       className="bg-slate-800 border-slate-700 text-white text-xs rounded px-2 py-1 w-full focus:ring-1 focus:ring-emerald-500"
                    />
                 </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Duration</span>
                    <span className="font-mono font-bold text-white">{settings.durationMonths} Months</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
