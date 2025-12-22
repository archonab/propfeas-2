
import React, { useState } from 'react';
import { Site, SiteDNA, TaxState, PermitStatus, Stakeholder, StakeholderRole, LeadStatus, FloodZone, ScenarioStatus } from '../types';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  readOnly?: boolean;
}

// --- CONSTANTS ---
const PERMIT_STATUSES: PermitStatus[] = ['Not Started', 'Draft', 'Lodged', 'RFI', 'Approved', 'Rejected'];
const FLOOD_ZONES: FloodZone[] = ['Low', 'Medium', 'High'];
const STAKEHOLDER_ROLES: StakeholderRole[] = ['Client', 'Investor', 'Lender', 'Consultant', 'Authority'];

type Tab = 'overview' | 'dna' | 'stakeholders' | 'documents';

export const SiteDNAHub: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // --- Handlers ---
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

  // Stakeholder CRUD
  const addStakeholder = () => {
    if (readOnly) return;
    const newPerson: Stakeholder = {
        id: `sh-${Date.now()}`,
        role: 'Consultant',
        name: 'New Contact',
        company: 'Unassigned'
    };
    onUpdate({
        ...site,
        stakeholders: [...(site.stakeholders || []), newPerson]
    });
  };

  const updateStakeholder = (id: string, field: keyof Stakeholder, value: any) => {
    if (readOnly) return;
    const updatedList = (site.stakeholders || []).map(s => 
        s.id === id ? { ...s, [field]: value } : s
    );
    onUpdate({ ...site, stakeholders: updatedList });
  };

  const removeStakeholder = (id: string) => {
    if (readOnly) return;
    const updatedList = (site.stakeholders || []).filter(s => s.id !== id);
    onUpdate({ ...site, stakeholders: updatedList });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden">
        
        {/* --- LEFT COLUMN: SITE PROFILE (MASTER) --- */}
        <aside className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0 lg:h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            
            {/* Visual Identity */}
            <div className="relative h-48 bg-slate-200 group">
                <img 
                    src={site.thumbnail} 
                    className="w-full h-full object-cover opacity-90 transition-opacity" 
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
                {/* Status Badge - Floating */}
                <div className="absolute top-4 right-4">
                    <select 
                        value={site.status}
                        disabled={readOnly}
                        onChange={(e) => updateSiteField('status', e.target.value as LeadStatus)}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border-none cursor-pointer focus:ring-2 focus:ring-white/50 shadow-lg appearance-none ${
                            site.status === 'Acquired' ? 'bg-emerald-500 text-white' : 
                            site.status === 'Due Diligence' ? 'bg-purple-500 text-white' : 'bg-amber-500 text-white'
                        }`}
                    >
                        <option value="Prospect">Prospect</option>
                        <option value="Due Diligence">Due Diligence</option>
                        <option value="Acquired">Acquired</option>
                        <option value="Archive">Archive</option>
                    </select>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Primary Address</label>
                    <div className="flex items-start">
                        <i className="fa-solid fa-location-dot mt-1 mr-3 text-indigo-500"></i>
                        <p className="text-sm font-bold text-slate-700 leading-snug">{site.dna.address}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Land Area</span>
                        <span className="text-sm font-mono font-bold text-slate-800">{site.dna.landArea.toLocaleString()} m²</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Zone</span>
                        <span className="text-sm font-bold text-slate-800">{site.dna.zoningCode || 'Pending'}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Council</span>
                        <span className="text-xs font-bold text-slate-800 truncate" title={site.dna.lga}>{site.dna.lga}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Permit</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${site.dna.permitStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {site.dna.permitStatus || 'N/A'}
                        </span>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase">Models Active</span>
                            <span className="text-xs font-bold text-indigo-800">{site.scenarios.length}</span>
                        </div>
                        <div className="w-full bg-white h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-3/4"></div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        {/* --- RIGHT COLUMN: WORKSPACE (DETAIL) --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto no-scrollbar shrink-0">
                <div className="flex space-x-8">
                    {(['overview', 'dna', 'stakeholders', 'documents'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                                activeTab === tab 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            {tab === 'dna' ? 'Asset DNA' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
                <div className="max-w-5xl mx-auto">
                    
                    {/* TAB 1: OVERVIEW (Scenarios) */}
                    {activeTab === 'overview' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800">Feasibility Scenarios</h3>
                                {/* Note: Adding scenarios happens in ScenarioManager, usually accessed via parent */}
                            </div>
                            
                            {site.scenarios.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                    <i className="fa-solid fa-calculator text-3xl text-slate-300 mb-3"></i>
                                    <p className="text-slate-500 font-medium text-sm">No models created yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {site.scenarios.map(scen => (
                                        <div key={scen.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                            {scen.isBaseline && (
                                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-widest">
                                                    Baseline
                                                </div>
                                            )}
                                            <div className="flex items-center space-x-3 mb-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm ${scen.strategy === 'SELL' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                                                    <i className={`fa-solid ${scen.strategy === 'SELL' ? 'fa-tags' : 'fa-building-user'}`}></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{scen.name}</h4>
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide mt-0.5">{scen.strategy}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                                <span className="text-[10px] text-slate-400 font-mono">Last Mod: {new Date(scen.lastModified).toLocaleDateString()}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                    scen.status === ScenarioStatus.LOCKED ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                    {scen.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: ASSET DNA (Forms) */}
                    {activeTab === 'dna' && (
                        <div className="animate-in fade-in duration-300 space-y-8">
                            
                            {/* Section: Statutory */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center">
                                    <i className="fa-solid fa-gavel mr-2 text-slate-400"></i> Statutory & Planning
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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

                            {/* Section: Legal & Title */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center">
                                    <i className="fa-solid fa-file-contract mr-2 text-slate-400"></i> Legal & Title
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-1 md:col-span-2">
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
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title Reference (Vol/Folio)</label>
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
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contamination Status</label>
                                        <input 
                                            type="text"
                                            disabled={readOnly}
                                            value={site.dna.contaminationStatus || ''}
                                            onChange={(e) => updateDNAField('contaminationStatus', e.target.value)}
                                            className="w-full border-slate-200 rounded-lg text-sm"
                                            placeholder="e.g. Clean / Audited"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
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
                    )}

                    {/* TAB 3: STAKEHOLDERS */}
                    {activeTab === 'stakeholders' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 text-sm">Project Stakeholders</h3>
                                    {!readOnly && (
                                        <button onClick={addStakeholder} className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors">
                                            <i className="fa-solid fa-plus mr-1"></i> Add Person
                                        </button>
                                    )}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {(!site.stakeholders || site.stakeholders.length === 0) && (
                                        <div className="p-8 text-center text-slate-400 text-sm italic">
                                            No stakeholders linked to this asset.
                                        </div>
                                    )}
                                    {(site.stakeholders || []).map(person => (
                                        <div key={person.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors group">
                                            <div className="md:col-span-2">
                                                <select 
                                                    value={person.role}
                                                    disabled={readOnly}
                                                    onChange={(e) => updateStakeholder(person.id, 'role', e.target.value)}
                                                    className="w-full text-xs font-bold border-slate-200 rounded uppercase bg-slate-50"
                                                >
                                                    {STAKEHOLDER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-3">
                                                <input 
                                                    type="text" 
                                                    value={person.name}
                                                    disabled={readOnly}
                                                    onChange={(e) => updateStakeholder(person.id, 'name', e.target.value)}
                                                    className="w-full text-sm font-bold border-transparent bg-transparent hover:border-slate-200 rounded px-2"
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <input 
                                                    type="text" 
                                                    value={person.company}
                                                    disabled={readOnly}
                                                    onChange={(e) => updateStakeholder(person.id, 'company', e.target.value)}
                                                    className="w-full text-sm text-slate-500 border-transparent bg-transparent hover:border-slate-200 rounded px-2"
                                                    placeholder="Company"
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <input 
                                                    type="text" 
                                                    value={person.email || ''}
                                                    disabled={readOnly}
                                                    onChange={(e) => updateStakeholder(person.id, 'email', e.target.value)}
                                                    className="w-full text-xs text-slate-400 border-transparent bg-transparent hover:border-slate-200 rounded px-2"
                                                    placeholder="Email Address"
                                                />
                                            </div>
                                            <div className="md:col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!readOnly && (
                                                    <button onClick={() => removeStakeholder(person.id)} className="text-slate-300 hover:text-red-500">
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: DOCUMENTS (Placeholder) */}
                    {activeTab === 'documents' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {['Contract of Sale', 'Title Search', 'Planning Permit', 'Feature Survey'].map((doc, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group h-40">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-3 transition-colors">
                                            <i className="fa-solid fa-file-pdf text-xl"></i>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">{doc}</span>
                                        <span className="text-[10px] text-slate-400 mt-1">PDF • 2.4 MB</span>
                                    </div>
                                ))}
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors h-40">
                                    <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300 mb-2"></i>
                                    <span className="text-xs font-bold text-slate-500">Upload New File</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};
