
import React, { useState } from 'react';
import { LeadStatus, InputScale } from '../types';
import { Site, SiteIdentity, SiteAcquisition } from '../types-v2';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
}

// Simulated "Smart Data" Provider Database
const MOCK_ADDRESS_DATABASE = {
  "49 King St": {
    address: "49 King Street, Dandenong VIC 3175",
    identity: {
      landArea: 1240,
      zoning: "GRZ1 (General Residential)",
      lga: "City of Greater Dandenong",
      overlays: ["Heritage Overlay (HO102)", "Vegetation Protection (VPO1)"],
      auv: 1200000,
      acv: 1450000
    },
    acquisition: {
      agent: { name: "John Smith", company: "Ray White Commercial" },
      vendor: { name: "Private Holding Co" }
    },
    geometry: { lat: -37.9875, lng: 145.2146 }
  },
  "Default": {
    address: "New Site Scenario",
    identity: {
      landArea: 1000,
      zoning: "Pending",
      lga: "Pending",
      overlays: [],
      auv: 0,
      acv: 0
    },
    acquisition: {
      agent: { name: "", company: "" },
      vendor: { name: "" }
    }
  }
};

export const SiteSettings: React.FC<Props> = ({ site, onUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSimulatedFetch = (query: string) => {
    setIsSearching(true);
    
    // Simulate API Latency
    setTimeout(() => {
      setIsSearching(false);
      
      // Simple matching logic
      let match = MOCK_ADDRESS_DATABASE["Default"];
      if (query.toLowerCase().includes("49 king")) {
        match = MOCK_ADDRESS_DATABASE["49 King St"];
      }
      
      // Update Global Site
      const updatedSite: Site = {
        ...site,
        name: match.address.split(',')[0],
        identity: {
            ...site.identity,
            address: match.address,
            landArea: match.identity.landArea,
            zoning: match.identity.zoning,
            lga: match.identity.lga,
            overlays: match.identity.overlays,
            auv: match.identity.auv,
            acv: match.identity.acv
        },
        acquisition: {
            ...site.acquisition,
            agent: { ...site.acquisition.agent, ...match.acquisition.agent },
            vendor: { ...site.acquisition.vendor, ...match.acquisition.vendor }
        }
      };

      onUpdate(updatedSite);
      
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

  const updateIdentityField = (field: keyof SiteIdentity, value: any) => {
    onUpdate({
      ...site,
      identity: { ...site.identity, [field]: value }
    });
  };

  const updateAcquisitionNested = (parent: 'agent' | 'vendor', field: string, value: any) => {
    onUpdate({
      ...site,
      acquisition: {
        ...site.acquisition,
        [parent]: { ...site.acquisition[parent], [field]: value }
      }
    });
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
      onUpdate({
          ...site,
          status: newStatus
      });
  };

  const handleScaleChange = (newScale: InputScale) => {
      // We update the scale on ALL scenarios for consistency across the site project
      const updatedScenarios = site.scenarios.map(s => ({
          ...s,
          settings: {
              ...s.settings,
              inputScale: newScale
          }
      }));
      onUpdate({ ...site, scenarios: updatedScenarios });
  };

  // Get current scale from first scenario or default
  const currentScale = site.scenarios[0]?.settings.inputScale || InputScale.ONES;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-slate-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
        <h3 className="text-sm font-bold text-slate-800">Global Site Settings</h3>
        <p className="text-xs text-slate-500 mt-1">
          Changes made here (e.g., Land Area, AUV) will automatically sync to <strong>all scenarios</strong> for this project.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Status & Identity */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase mb-1">Project Status</h3>
                <select 
                    value={site.status}
                    onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                    className="w-full border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-blue-500"
                >
                    <option value="Prospect">Prospect</option>
                    <option value="Due Diligence">Due Diligence</option>
                    <option value="Acquired">Acquired</option>
                    <option value="Archive">Archive</option>
                </select>
             </div>

             <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase mb-1 flex items-center">
                    Data Entry Scale
                    <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-700 px-1.5 rounded border border-indigo-200">Global</span>
                </h3>
                <select 
                    value={currentScale}
                    onChange={(e) => handleScaleChange(e.target.value as InputScale)}
                    className="w-full border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-blue-500"
                >
                    <option value={InputScale.ONES}>Ones (e.g. 50,000)</option>
                    <option value={InputScale.THOUSANDS}>Thousands (e.g. 50k)</option>
                    <option value={InputScale.MILLIONS}>Millions (e.g. 50m)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Controls how currency inputs are displayed and entered in all grids.</p>
             </div>
          </div>

          {/* 1. Smart Address Search */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
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
                value={searchQuery || site.identity.address}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Start typing address (e.g. 49 King St)..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Physical Attributes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Physical & Planning</h3>
            </div>
            <div className="p-6 space-y-5">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Land Area (sqm)</label>
                    <input 
                        type="number" 
                        value={site.identity.landArea}
                        onChange={(e) => updateIdentityField('landArea', parseFloat(e.target.value))}
                        className="w-full border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-blue-500 bg-blue-50/30"
                    />
                    <p className="text-[10px] text-blue-600 mt-1 font-medium">
                        <i className="fa-solid fa-link mr-1"></i>
                        Linked to Rate/sqm calculations in all scenarios
                    </p>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local Government Area (LGA)</label>
                    <input 
                        type="text" 
                        value={site.identity.lga}
                        onChange={(e) => updateIdentityField('lga', e.target.value)}
                        className="w-full border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoning Code</label>
                    <input 
                        type="text" 
                        value={site.identity.zoning}
                        onChange={(e) => updateIdentityField('zoning', e.target.value)}
                        className="w-full border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>

        {/* Statutory Values */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Statutory Valuations</h3>
                <p className="text-xs text-slate-500">Used for Council Rates & Land Tax calculations.</p>
            </div>
            <div className="p-6 space-y-5">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assessed Unimproved Value (AUV)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                        <input 
                            type="number" 
                            value={site.identity.auv || 0}
                            onChange={(e) => updateIdentityField('auv', parseFloat(e.target.value))}
                            className="w-full pl-8 border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-indigo-500"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Site Value for Land Tax</p>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assessed Capital Value (ACV)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                        <input 
                            type="number" 
                            value={site.identity.acv || 0}
                            onChange={(e) => updateIdentityField('acv', parseFloat(e.target.value))}
                            className="w-full pl-8 border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-indigo-500"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Improved Value for Council Rates</p>
                </div>
            </div>
        </div>

        {/* Deal Team */}
        <div className="space-y-6 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                    <i className="fa-solid fa-circle-user mr-2 text-blue-500"></i> Selling Agent
                </h4>
                <div className="space-y-3">
                    <input 
                    type="text" placeholder="Agent Name"
                    value={site.acquisition.agent?.name || ''}
                    onChange={(e) => updateAcquisitionNested('agent', 'name', e.target.value)}
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                    />
                    <input 
                    type="text" placeholder="Agency / Company"
                    value={site.acquisition.agent?.company || ''}
                    onChange={(e) => updateAcquisitionNested('agent', 'company', e.target.value)}
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center">
                    <i className="fa-solid fa-circle-user mr-2 text-indigo-500"></i> Vendor Details
                </h4>
                <div className="space-y-3">
                    <input 
                    type="text" placeholder="Vendor Name / Entity"
                    value={site.acquisition.vendor.name}
                    onChange={(e) => updateAcquisitionNested('vendor', 'name', e.target.value)}
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-indigo-500"
                    />
                    <input 
                    type="text" placeholder="Vendor Solicitor"
                    value={site.acquisition.vendor.company}
                    onChange={(e) => updateAcquisitionNested('vendor', 'company', e.target.value)}
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-indigo-500"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
