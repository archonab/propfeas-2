
import React, { useState } from 'react';
import { Site, SiteDNA, TaxState } from '../types';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  readOnly?: boolean;
}

// Simulated "Smart Data" Provider Database
const MOCK_ADDRESS_DATABASE = {
  "49 King St": {
    address: "49 King Street, Dandenong VIC 3175",
    dna: {
      landArea: 1240,
      state: 'VIC',
      zoning: "GRZ1 (General Residential)",
      lga: "City of Greater Dandenong",
      overlays: ["Heritage Overlay (HO102)", "Vegetation Protection (VPO1)"],
      agent: { name: "John Smith", company: "Ray White Commercial" },
      vendor: { name: "Private Holding Co" },
      auv: 1200000,
      acv: 1450000
    },
    geometry: { lat: -37.9875, lng: 145.2146 }
  },
  "142 O'Riordan St": {
    address: "142 O'Riordan Street, Mascot NSW 2020",
    dna: {
        landArea: 2100,
        state: 'NSW',
        zoning: "B4 Mixed Use",
        lga: "Bayside Council",
        overlays: ["Airport Height Ops"],
        agent: { name: "Pending", company: "CBRE" },
        vendor: { name: "Logistics REIT" },
        auv: 4500000,
        acv: 5200000
    },
    geometry: { lat: -33.928, lng: 151.188 }
  },
  "Default": {
    address: "New Site Scenario",
    dna: {
      landArea: 1000,
      state: 'VIC',
      zoning: "Pending",
      lga: "Pending",
      overlays: [],
      agent: { name: "", company: "" },
      vendor: { name: "" },
      auv: 0,
      acv: 0
    }
  }
};

type Tab = 'physical' | 'statutory' | 'team';

export const SiteDNAHub: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('physical');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // -- Smart Fetch Logic --
  const handleSimulatedFetch = (query: string) => {
    setIsSearching(true);
    
    // Simulate API Latency
    setTimeout(() => {
      setIsSearching(false);
      
      // Simple matching logic
      let match = MOCK_ADDRESS_DATABASE["Default"];
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes("49 king")) match = MOCK_ADDRESS_DATABASE["49 King St"];
      if (lowerQuery.includes("riordan")) match = MOCK_ADDRESS_DATABASE["142 O'Riordan St"];
      
      // Update Global Site DNA
      const newDNA: SiteDNA = {
        ...site.dna,
        ...match.dna as SiteDNA // Apply matched data
      };

      onUpdate({
        ...site,
        name: match.address.split(',')[0], // Auto-update project name
        dna: newDNA
      });
      
      setSearchQuery(match.address);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSimulatedFetch(searchQuery);
    }
  };

  const updateField = (field: keyof SiteDNA, value: any) => {
    onUpdate({
      ...site,
      dna: { ...site.dna, [field]: value }
    });
  };

  const updateNested = (parent: 'agent' | 'vendor', field: string, value: any) => {
    onUpdate({
      ...site,
      dna: {
        ...site.dna,
        [parent]: { ...site.dna[parent], [field]: value }
      }
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[500px] bg-slate-50 overflow-hidden">
        
        {/* LEFT PANEL: Form Inputs */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
            {/* Header: Smart Search */}
            <div className="bg-white p-6 border-b border-slate-200">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Project Address (Smart Search)</label>
                <div className="relative">
                    <div className="absolute left-4 top-3.5 text-slate-400">
                        {isSearching ? <i className="fa-solid fa-circle-notch fa-spin text-indigo-500"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                    </div>
                    <input 
                        type="text" 
                        disabled={readOnly}
                        value={searchQuery || site.dna.address}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search address to auto-populate..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6">
                {(['physical', 'statutory', 'team'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-4 mr-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                            activeTab === tab 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
                
                {/* TAB: PHYSICAL */}
                {activeTab === 'physical' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Land Area (m²)</label>
                                <input 
                                    type="number" 
                                    disabled={readOnly}
                                    value={site.dna.landArea}
                                    onChange={(e) => updateField('landArea', parseFloat(e.target.value))}
                                    className="w-full border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-800 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoning</label>
                                <input 
                                    type="text" 
                                    disabled={readOnly}
                                    value={site.dna.zoning}
                                    onChange={(e) => updateField('zoning', e.target.value)}
                                    className="w-full border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local Government (LGA)</label>
                            <input 
                                type="text" 
                                disabled={readOnly}
                                value={site.dna.lga}
                                onChange={(e) => updateField('lga', e.target.value)}
                                className="w-full border-slate-200 rounded-lg p-2.5 font-medium text-slate-700 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Planning Overlays</label>
                            <div className="flex flex-wrap gap-2">
                                {site.dna.overlays.map((ov, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center shadow-sm">
                                        <i className="fa-solid fa-layer-group mr-2 opacity-50"></i> {ov}
                                    </span>
                                ))}
                                {site.dna.overlays.length === 0 && (
                                    <span className="text-xs text-slate-400 italic py-2">No overlays detected.</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: STATUTORY */}
                {activeTab === 'statutory' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6">
                            <div className="flex items-center space-x-3 mb-2">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                                    <i className="fa-solid fa-scale-balanced"></i>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-indigo-900">Tax Jurisdiction</h4>
                                    <p className="text-[10px] text-indigo-600">Determines Stamp Duty & Land Tax Rates.</p>
                                </div>
                            </div>
                            <select 
                                value={site.dna.state || 'VIC'}
                                disabled={readOnly}
                                onChange={(e) => updateField('state', e.target.value as TaxState)}
                                className="w-full mt-2 border-indigo-200 rounded-lg p-2.5 font-bold text-indigo-900 focus:ring-indigo-500 bg-white shadow-sm"
                            >
                                <option value="VIC">Victoria (VIC)</option>
                                <option value="NSW">New South Wales (NSW)</option>
                                <option value="QLD">Queensland (QLD)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Site Value (AUV)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        disabled={readOnly}
                                        value={site.dna.auv || 0}
                                        onChange={(e) => updateField('auv', parseFloat(e.target.value))}
                                        className="w-full pl-8 border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-800 focus:ring-indigo-500"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Used for Land Tax calculations.</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capital Improved Value (ACV)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        disabled={readOnly}
                                        value={site.dna.acv || 0}
                                        onChange={(e) => updateField('acv', parseFloat(e.target.value))}
                                        className="w-full pl-8 border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-800 focus:ring-indigo-500"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Used for Council Rates.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: TEAM */}
                {activeTab === 'team' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                            <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                                <i className="fa-solid fa-user-tie mr-2 text-blue-500"></i> Selling Agent
                            </h4>
                            <div className="space-y-3">
                                <input 
                                    type="text" placeholder="Name"
                                    disabled={readOnly}
                                    value={site.dna.agent.name}
                                    onChange={(e) => updateNested('agent', 'name', e.target.value)}
                                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                                />
                                <input 
                                    type="text" placeholder="Agency"
                                    disabled={readOnly}
                                    value={site.dna.agent.company}
                                    onChange={(e) => updateNested('agent', 'company', e.target.value)}
                                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                            <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                                <i className="fa-solid fa-handshake mr-2 text-emerald-500"></i> Vendor
                            </h4>
                            <div className="space-y-3">
                                <input 
                                    type="text" placeholder="Entity Name"
                                    disabled={readOnly}
                                    value={site.dna.vendor.name}
                                    onChange={(e) => updateNested('vendor', 'name', e.target.value)}
                                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500"
                                />
                                <input 
                                    type="text" placeholder="Solicitor / Rep"
                                    disabled={readOnly}
                                    value={site.dna.vendor.company}
                                    onChange={(e) => updateNested('vendor', 'company', e.target.value)}
                                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* RIGHT PANEL: Intelligence & Map */}
        <div className="w-full md:w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
            
            {/* Map Placeholder */}
            <div className="h-48 relative group overflow-hidden bg-slate-200">
                <img 
                    src="https://images.unsplash.com/photo-1524813686514-a5756c97759e?q=80&w=600&auto=format&fit=crop" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                    alt="Map Location" 
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="text-[10px] font-bold text-slate-700 flex items-center">
                            <i className="fa-solid fa-location-dot mr-1.5 text-red-500"></i>
                            {site.dna.geometry ? `${site.dna.geometry.lat}, ${site.dna.geometry.lng}` : 'Locating...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* High Level Stats */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Site DNA Summary</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Project Code</span>
                            <span className="font-mono font-bold text-slate-700">{site.code}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Jurisdiction</span>
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{site.dna.state || 'VIC'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Status</span>
                            <span className={`font-bold px-2 py-0.5 rounded ${
                                site.status === 'Acquired' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>{site.status}</span>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Planning Constraints</h4>
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex items-center space-x-2 mb-2">
                            <i className="fa-solid fa-ruler-combined text-slate-400 text-xs"></i>
                            <span className="text-xs font-bold text-slate-700">Yield Analysis</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            Based on <strong>{site.dna.zoning || 'current zoning'}</strong> and a land area of <strong>{site.dna.landArea.toLocaleString()}m²</strong>, estimated yield is approx <strong>{Math.floor(site.dna.landArea / 60)} - {Math.floor(site.dna.landArea / 40)}</strong> units (STCA).
                        </p>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};
