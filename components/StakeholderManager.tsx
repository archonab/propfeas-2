import React from 'react';
import { Site, Stakeholder, StakeholderRole } from '../types';

interface Props {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  readOnly?: boolean;
}

const STAKEHOLDER_ROLES: StakeholderRole[] = ['Client', 'Investor', 'Lender', 'Consultant', 'Authority'];

export const StakeholderManager: React.FC<Props> = ({ site, onUpdate, readOnly = false }) => {
  
  const addStakeholder = () => {
    if (readOnly) return;
    const newPerson: Stakeholder = {
        id: `sh-${Date.now()}`,
        role: 'Consultant',
        name: 'New Contact',
        company: 'Unassigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
    <div className="animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800">Project Stakeholders</h3>
                <p className="text-sm text-slate-500">Manage key contacts, consultants, and authorities.</p>
            </div>
            {!readOnly && (
                <button onClick={addStakeholder} className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center shadow-sm">
                    <i className="fa-solid fa-user-plus mr-2"></i> Add Person
                </button>
            )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 grid grid-cols-12 gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="col-span-2">Role</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-3">Email / Contact</div>
                <div className="col-span-1 text-right"></div>
            </div>
            
            <div className="divide-y divide-slate-100">
                {(!site.stakeholders || site.stakeholders.length === 0) && (
                    <div className="p-12 text-center text-slate-400 text-sm italic">
                        No stakeholders linked to this asset.
                    </div>
                )}
                {(site.stakeholders || []).map(person => (
                    <div key={person.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors group">
                        <div className="col-span-2">
                            <select 
                                value={person.role}
                                disabled={readOnly}
                                onChange={(e) => updateStakeholder(person.id, 'role', e.target.value)}
                                className="w-full text-xs font-bold border-slate-200 rounded uppercase bg-slate-50 focus:ring-indigo-500"
                            >
                                {STAKEHOLDER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="col-span-3">
                            <input 
                                type="text" 
                                value={person.name}
                                disabled={readOnly}
                                onChange={(e) => updateStakeholder(person.id, 'name', e.target.value)}
                                className="w-full text-sm font-bold border-transparent bg-transparent hover:border-slate-200 rounded px-2 focus:ring-indigo-500"
                                placeholder="Name"
                            />
                        </div>
                        <div className="col-span-3">
                            <input 
                                type="text" 
                                value={person.company}
                                disabled={readOnly}
                                onChange={(e) => updateStakeholder(person.id, 'company', e.target.value)}
                                className="w-full text-sm text-slate-500 border-transparent bg-transparent hover:border-slate-200 rounded px-2 focus:ring-indigo-500"
                                placeholder="Company"
                            />
                        </div>
                        <div className="col-span-3">
                            <input 
                                type="text" 
                                value={person.email || ''}
                                disabled={readOnly}
                                onChange={(e) => updateStakeholder(person.id, 'email', e.target.value)}
                                className="w-full text-xs text-slate-400 border-transparent bg-transparent hover:border-slate-200 rounded px-2 focus:ring-indigo-500"
                                placeholder="Email Address"
                            />
                        </div>
                        <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            {!readOnly && (
                                <button onClick={() => removeStakeholder(person.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};