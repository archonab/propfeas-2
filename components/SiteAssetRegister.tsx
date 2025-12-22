
import React from 'react';
import { Site, SiteDNA, TaxState, PermitStatus, FloodZone, LeadStatus } from '../types';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  readOnly?: boolean;
}

const PERMIT_STATUSES: PermitStatus[] = ['Not Started', 'Draft', 'Lodged', 'RFI', 'Approved', 'Rejected'];
const FLOOD_ZONES: FloodZone[] = ['Low', 'Medium', 'High'];

export const SiteAssetRegister: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  
  const updateSiteField = (field: keyof Site, value: any) => {
    if (readOnly) return;
    onUpdate({ ...site, [field]: value });
  };

  const updateDNAField = (field: keyof SiteDNA, value: any) => {
    if (readOnly) return;
    onUpdate({
      ...site,
      dna: { ...site.dna, [field]: value }
    });
  };

  const updateNestedDNA = (parent: 'agent' | 'vendor', field: string, value: any) => {
    if (readOnly) return;
    onUpdate({
      ...site,
      dna: {
        ...site.dna,
        [parent]: { ...site.dna[parent], [field]: value }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header / Context */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div>
            <h3 className="font-bold text-slate-800 text-sm">Asset Register</h3>
            <p className="text-xs text-slate-500">Manage physical parameters, statutory controls, and legal title.</p>
         </div>
         <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phase</span>
            <select 
                value={site.status}
                disabled={readOnly}
                onChange={(e) => updateSiteField('status', e.target.value as LeadStatus)}
                className={`text-xs font-bold uppercase px-2 py-1.5 rounded-md border-none cursor-pointer focus:ring-2 focus:ring-offset-1 ${
                    site.status === 'Acquired' ? 'bg-emerald-100 text-emerald-700' : 
                    site.status === 'Due Diligence' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}
            >
                <option value="Prospect">Prospect</option>
                <option value="Due Diligence">Due Diligence</option>
                <option value="Acquired">Acquired</option>
                <option value="Archive">Archive</option>
            </select>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: PHYSICAL & LOCATION */}
        <div className="space-y-6">
            
            {/* Map / Identity */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="relative h-48 bg-slate-200 group">
                    <img 
                        src={site.thumbnail} 
                        className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100" 
                        alt="Asset Thumbnail"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex flex-col justify-end p-6">
                        <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-1">
                            {site.code}
                        </span>
                        <h2 className="text-xl font-black text-white leading-none shadow-black drop-shadow-md">
                            {site.name}
                        </h2>
                    </div>
                    <button className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded text-[10px] font-bold text-slate-700 hover:bg-white shadow-sm transition-all">
                        <i className="fa-solid fa-camera mr-2"></i> Edit Photo
                    </button>
                </div>
                <div className="p-6">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Primary Address</label>
                    <input 
                        type="text" 
                        value={site.dna.address}
                        disabled={readOnly}
                        onChange={(e) => updateDNAField('address', e.target.value)}
                        className="w-full text-sm font-bold text-slate-800 border-slate-200 rounded-lg focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Physical Attributes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center">
                    <i className="fa-solid fa-ruler-combined mr-2 text-slate-400"></i> Physical Attributes
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Land Area (sqm)</label>
                        <input 
                            type="number" 
                            value={site.dna.landArea}
                            disabled={readOnly}
                            onChange={(e) => updateDNAField('landArea', parseFloat(e.target.value))}
                            className="w-full border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:ring-blue-500 bg-blue-50/10"
                        />
                        <p className="text-[10px] text-blue-600 mt-1">
                            <i className="fa-solid fa-link mr-1"></i> Linked to Rate/sqm calculations
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Flood Zone</label>
                            <select 
                                value={site.dna.floodZone || 'Low'}
                                disabled={readOnly}
                                onChange={(e) => updateDNAField('floodZone', e.target.value)}
                                className="w-full border-slate-200 rounded-lg text-sm"
                            >
                                {FLOOD_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contamination</label>
                            <input 
                                type="text"
                                disabled={readOnly}
                                value={site.dna.contaminationStatus || ''}
                                onChange={(e) => updateDNAField('contaminationStatus', e.target.value)}
                                className="w-full border-slate-200 rounded-lg text-sm"
                                placeholder="e.g. Clean / Audited"
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* RIGHT COLUMN: STATUTORY & LEGAL */}
        <div className="space-y-6">
            
            {/* Statutory & Planning */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center">
                    <i className="fa-solid fa-gavel mr-2 text-slate-400"></i> Statutory & Planning
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local Council (LGA)</label>
                        <input 
                            type="text" 
                            value={site.dna.lga}
                            disabled={readOnly}
                            onChange={(e) => updateDNAField('lga', e.target.value)}
                            className="w-full border-slate-200 rounded-lg text-sm font-medium text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax Jurisdiction</label>
                        <select 
                            value={site.dna.state}
                            disabled={readOnly}
                            onChange={(e) => updateDNAField('state', e.target.value as TaxState)}
                            className="w-full border-slate-200 rounded-lg text-sm font-bold text-slate-700"
                        >
                            <option value="VIC">Victoria</option>
                            <option value="NSW">New South Wales</option>
                            <option value="QLD">Queensland</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Permit Status</label>
                        <select 
                            value={site.dna.permitStatus || 'Not Started'}
                            disabled={readOnly}
                            onChange={(e) => updateDNAField('permitStatus', e.target.value)}
                            className="w-full border-slate-200 rounded-lg text-sm"
                        >
                            {PERMIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoning Code</label>
                        <input 
                            type="text"
                            disabled={readOnly}
                            value={site.dna.zoningCode || ''}
                            onChange={(e) => updateDNAField('zoningCode', e.target.value)}
                            className="w-full border-slate-200 rounded-lg text-sm font-mono uppercase"
                            placeholder="e.g. RGZ1"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Overlays</label>
                        <input 
                            type="text"
                            disabled={readOnly}
                            placeholder="Comma separated"
                            className="w-full border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                </div>
                
                {/* Valuations */}
                <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-6 border-t border-slate-100 mt-2">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assessed Site Value (AUV)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                            <input 
                                type="number"
                                disabled={readOnly}
                                value={site.dna.auv || ''}
                                onChange={(e) => updateDNAField('auv', parseFloat(e.target.value))}
                                className="w-full border-slate-200 rounded-lg pl-6 text-sm font-bold text-slate-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capital Improved Value (ACV)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                            <input 
                                type="number"
                                disabled={readOnly}
                                value={site.dna.acv || ''}
                                onChange={(e) => updateDNAField('acv', parseFloat(e.target.value))}
                                className="w-full border-slate-200 rounded-lg pl-6 text-sm font-bold text-slate-700"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Legal & Title */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center">
                    <i className="fa-solid fa-file-contract mr-2 text-slate-400"></i> Legal & Title
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title Volume/Folio</label>
                            <input 
                                type="text"
                                disabled={readOnly}
                                value={site.dna.titleReference || ''}
                                onChange={(e) => updateDNAField('titleReference', e.target.value)}
                                className="w-full border-slate-200 rounded-lg text-sm font-mono"
                                placeholder="e.g. 12345/678"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ownership Entity</label>
                            <input 
                                type="text"
                                disabled={readOnly}
                                value={site.dna.ownershipEntity || ''}
                                onChange={(e) => updateDNAField('ownershipEntity', e.target.value)}
                                className="w-full border-slate-200 rounded-lg text-sm"
                                placeholder="e.g. Project SPV Pty Ltd"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor Name</label>
                        <input 
                            type="text"
                            disabled={readOnly}
                            value={site.dna.vendor.name || ''}
                            onChange={(e) => updateNestedDNA('vendor', 'name', e.target.value)}
                            className="w-full border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Easements & Covenants</label>
                        <textarea 
                            disabled={readOnly}
                            value={site.dna.easements || ''}
                            onChange={(e) => updateDNAField('easements', e.target.value)}
                            className="w-full border-slate-200 rounded-lg text-sm h-20"
                            placeholder="List any easements or restrictive covenants..."
                        />
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
