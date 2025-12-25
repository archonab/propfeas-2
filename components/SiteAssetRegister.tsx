import React from 'react';
import { Site, SiteIdentity, SiteAcquisition, SitePlanning } from '../types-v2';
import { TaxState, PermitStatus, FloodZone } from '../types';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  readOnly?: boolean;
}

const PERMIT_STATUSES: PermitStatus[] = ['Not Started', 'Draft', 'Lodged', 'RFI', 'Approved', 'Rejected'];
const FLOOD_ZONES: FloodZone[] = ['Low', 'Medium', 'High'];

export const SiteAssetRegister: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  
  // Helper functions to update nested structures
  const updateIdentity = (field: keyof SiteIdentity, value: any) => {
    if (readOnly) return;
    onUpdate({
      ...site,
      identity: { ...site.identity, [field]: value }
    });
  };
  
  const updateAcquisition = (field: keyof SiteAcquisition, value: any) => {
    if (readOnly) return;
    onUpdate({
      ...site,
      acquisition: { ...site.acquisition, [field]: value }
    });
  };
  
  const updatePlanning = (field: keyof SitePlanning, value: any) => {
    if (readOnly) return;
    onUpdate({
      ...site,
      planning: { ...site.planning, [field]: value }
    });
  };
  
  return (
    <div className="space-y-6">
      
      {/* SECTION 1: SITE IDENTITY (Immutable) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center">
            <i className="fa-solid fa-map-marker-alt mr-2 text-blue-500"></i>
            Site Identity
            </h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Address
            </label>
            <input 
              type="text"
              value={site.identity.address}
              onChange={(e) => updateIdentity('address', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Land Area (sqm)
            </label>
            <input 
              type="number"
              value={site.identity.landArea}
              onChange={(e) => updateIdentity('landArea', parseFloat(e.target.value))}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              State (Tax Jurisdiction)
            </label>
            <select 
              value={site.identity.state}
              onChange={(e) => updateIdentity('state', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-blue-500"
            >
              <option value="VIC">Victoria</option>
              <option value="NSW">New South Wales</option>
              <option value="QLD">Queensland</option>
            </select>
          </div>

          <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gross Floor Area (GFA)</label>
              <div className="relative">
                  <input 
                      type="number"
                      value={site.identity.totalGFA || ''}
                      onChange={(e) => updateIdentity('totalGFA', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full border-slate-200 rounded-lg focus:ring-blue-500 font-bold"
                      placeholder="0"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">sqm</span>
              </div>
          </div>

          <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Net Saleable Area (NSA)</label>
              <div className="relative">
                  <input 
                      type="number"
                      value={site.identity.totalNSA || ''}
                      onChange={(e) => updateIdentity('totalNSA', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full border-slate-200 rounded-lg focus:ring-blue-500 font-bold"
                      placeholder="0"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">sqm</span>
              </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              LGA (Council)
            </label>
            <input 
              type="text"
              value={site.identity.lga}
              onChange={(e) => updateIdentity('lga', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Zoning Code
            </label>
            <input 
              type="text"
              value={site.identity.zoningCode || ''}
              onChange={(e) => updateIdentity('zoningCode', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg font-mono focus:ring-blue-500"
              placeholder="e.g., RGZ1"
            />
          </div>
        </div>
      </div>
      
      {/* SECTION 2: ACQUISITION (Commercial Terms) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
            <h3 className="font-bold text-emerald-900 flex items-center">
            <i className="fa-solid fa-file-contract mr-2 text-emerald-600"></i>
            Acquisition Terms
            </h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Purchase Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
              <input 
                type="number"
                value={site.acquisition.purchasePrice}
                onChange={(e) => updateAcquisition('purchasePrice', parseFloat(e.target.value))}
                disabled={readOnly}
                className="w-full border-slate-200 rounded-lg pl-6 text-lg font-bold text-slate-800 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[10px] text-emerald-600 mt-1 font-bold">
              <i className="fa-solid fa-link mr-1"></i>
              Global Variable: Used by all feasibility scenarios
            </p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Settlement Period (Months)
            </label>
            <input 
              type="number"
              value={site.acquisition.settlementPeriod || 0}
              onChange={(e) => updateAcquisition('settlementPeriod', parseFloat(e.target.value))}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Vendor Name
            </label>
            <input 
              type="text"
              value={site.acquisition.vendor.name}
              onChange={(e) => updateAcquisition('vendor', { 
                ...site.acquisition.vendor, 
                name: e.target.value 
              })}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Foreign Buyer?
            </label>
            <select 
              value={site.acquisition.isForeignBuyer ? 'yes' : 'no'}
              onChange={(e) => updateAcquisition('isForeignBuyer', e.target.value === 'yes')}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-emerald-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* SECTION 3: PLANNING (Statutory) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
            <h3 className="font-bold text-indigo-900 flex items-center">
            <i className="fa-solid fa-gavel mr-2 text-indigo-600"></i>
            Planning & Approvals
            </h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Permit Status
            </label>
            <select 
              value={site.planning.permitStatus}
              onChange={(e) => updatePlanning('permitStatus', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-indigo-500"
            >
              {PERMIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Flood Zone
            </label>
            <select 
              value={site.planning.floodZone || 'Low'}
              onChange={(e) => updatePlanning('floodZone', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg focus:ring-indigo-500"
            >
              {FLOOD_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Easements & Covenants
            </label>
            <textarea 
              value={site.planning.easements || ''}
              onChange={(e) => updatePlanning('easements', e.target.value)}
              disabled={readOnly}
              className="w-full border-slate-200 rounded-lg h-20 focus:ring-indigo-500"
              placeholder="List any easements or restrictive covenants..."
            />
          </div>
        </div>
      </div>
      
    </div>
  );
};