
import React, { useState } from 'react';
import { FeasibilitySettings, SiteDNA } from './types';

interface Props {
  settings: FeasibilitySettings;
  onUpdate: (settings: FeasibilitySettings) => void;
  landCost?: number; // Optional prop to show land value metrics
}

// Simulated "Smart Data" Provider Database
const MOCK_ADDRESS_DATABASE = {
  "49 King St": {
    address: "49 King Street, Dandenong VIC 3175",
    dna: {
      landArea: 1240,
      zoning: "GRZ1 (General Residential)",
      lga: "City of Greater Dandenong",
      overlays: ["Heritage Overlay (HO102)", "Vegetation Protection (VPO1)"],
      agent: { name: "John Smith", company: "Ray White Commercial" },
      vendor: { name: "Private Holding Co" }
    },
    geometry: { lat: -37.9875, lng: 145.2146 }
  },
  "Default": {
    address: "New Site Scenario",
    dna: {
      landArea: 1000,
      zoning: "Pending",
      lga: "Pending",
      overlays: [],
      agent: { name: "", company: "" },
      vendor: { name: "" }
    }
  }
};

export const SiteSetup: React.FC<Props> = ({ settings, onUpdate, landCost = 0 }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { site } = settings;

  const handleSimulatedFetch = (query: string) => {
    setIsSearching(true);
    setShowResults(false);
    
    // Simulate API Latency (800ms)
    setTimeout(() => {
      setIsSearching(false);
      
      // Simple matching logic for the demo
      let match = MOCK_ADDRESS_DATABASE["Default"];
      if (query.toLowerCase().includes("49 king")) {
        match = MOCK_ADDRESS_DATABASE["49 King St"];
      }
      
      // Populate Global State
      const newSite: SiteDNA = {
        ...site,
        address: match.address,
        landArea: match.dna.landArea,
        zoning: match.dna.zoning,
        lga: match.dna.lga,
        overlays: match.dna.overlays,
        agent: { ...site.agent, ...match.dna.agent },
        vendor: { ...site.vendor, ...match.dna.vendor }
      };

      onUpdate({
        ...settings,
        projectName: match.address.split(',')[0], // Auto-name project
        site: newSite
      });
      
      setSearchQuery(match.address);
    }, 800);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSimulatedFetch(searchQuery);
    }
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
      <div className="sticky top-0 z-40 bg-slate-50 pb-4 pt-1 -mt-1">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Search Property Address</label>
        <div className="relative">
          <div className="absolute left-4 top-3.5 text-slate-400">
            {isSearching ? (
              <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-lg"></i>
            ) : (
              <i className="fa-solid fa-magnifying-glass text-lg"></i>
            )}
          </div>
          <input 
            type="text" 
            value={searchQuery || site.address}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Start typing address (e.g. 49 King St)..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl shadow-sm text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {isSearching && (
            <div className="absolute right-4 top-3.5 text-xs font-bold text-blue-500 animate-pulse">
              Fetching Planning Data...
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
                 {/* Map Placeholder - Reduced height on mobile */}
                 <div className="bg-slate-100 min-h-[150px] md:min-h-[250px] relative group overflow-hidden border-r md:border-r border-b md:border-b-0 border-slate-200">
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
                       {landCost > 0 && site.landArea > 0 && (
                          <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-50 border border-blue-100 rounded text-[10px] font-bold text-blue-700">
                             <i className="fa-solid fa-calculator mr-1.5 opacity-50"></i>
                             ${(landCost / site.landArea).toFixed(0)} / sqm
                          </div>
                       )}
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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
