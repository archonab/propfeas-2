
import React, { useState } from 'react';
import { CostCategory, InputType, DistributionMethod, GstTreatment, LineItem, SmartRates, TaxConfiguration, TaxBracket, TaxState, TaxType } from './types';
import { STANDARD_LIBRARY } from './costLibrary';
import { DEFAULT_RATES, DEFAULT_TAX_SCALES } from './constants';

// --- Helper: Flatten the Library Object to Array ---
const flattenLibrary = (lib: Record<CostCategory, LineItem[]>): LineItem[] => {
  return Object.values(lib).flat();
};

interface Props {
  rates: SmartRates;
  setRates: React.Dispatch<React.SetStateAction<SmartRates>>;
  library: LineItem[];
  setLibrary: React.Dispatch<React.SetStateAction<LineItem[]>>;
  taxScales: TaxConfiguration;
  setTaxScales: React.Dispatch<React.SetStateAction<TaxConfiguration>>;
}

export const AdminSettings: React.FC<Props> = ({ rates, setRates, library, setLibrary, taxScales, setTaxScales }) => {
  const [activeTab, setActiveTab] = useState<'drivers' | 'library' | 'tax'>('drivers');
  const [searchTerm, setSearchTerm] = useState('');

  // Tax Tab State
  const [activeTaxState, setActiveTaxState] = useState<TaxState>('VIC');
  const [activeTaxType, setActiveTaxType] = useState<TaxType>('STAMP_DUTY');

  // -- Modal State --
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);

  // -- Handlers --
  const handleReset = () => {
    if (window.confirm("WARNING: This will wipe all custom library items and restore factory defaults. Are you sure?")) {
      setRates(DEFAULT_RATES);
      setTaxScales(DEFAULT_TAX_SCALES);
      setLibrary(flattenLibrary(STANDARD_LIBRARY));
      localStorage.removeItem('devfeas_admin_rates');
      localStorage.removeItem('devfeas_admin_library');
      localStorage.removeItem('devfeas_admin_tax');
    }
  };

  const handleRateChange = (field: keyof SmartRates, value: number) => {
    setRates(prev => ({ ...prev, [field]: value }));
  };

  // Tax Scale Handlers
  const handleTaxUpdate = (state: TaxState, type: TaxType, index: number, field: keyof TaxBracket, value: any) => {
      setTaxScales(prev => {
          const newStateConfig = { ...prev[state] };
          const newBrackets = [...(newStateConfig[type] || [])];
          newBrackets[index] = { ...newBrackets[index], [field]: value };
          
          return { 
              ...prev, 
              [state]: {
                  ...newStateConfig,
                  [type]: newBrackets
              }
          };
      });
  };

  const handleAddBracket = () => {
      setTaxScales(prev => {
          const newStateConfig = { ...prev[activeTaxState] };
          const newBrackets = [...(newStateConfig[activeTaxType] || [])];
          
          // Add new bracket with reasonable defaults
          const lastLimit = newBrackets.length > 0 ? newBrackets[newBrackets.length - 1].limit : 0;
          newBrackets.push({
              limit: lastLimit + 100000,
              rate: 0,
              base: 0,
              method: 'SLIDING'
          });

          return { 
              ...prev, 
              [activeTaxState]: {
                  ...newStateConfig,
                  [activeTaxType]: newBrackets
              }
          };
      });
  };

  const handleDeleteBracket = (index: number) => {
      setTaxScales(prev => {
          const newStateConfig = { ...prev[activeTaxState] };
          const newBrackets = [...(newStateConfig[activeTaxType] || [])];
          newBrackets.splice(index, 1);
          
          return { 
              ...prev, 
              [activeTaxState]: {
                  ...newStateConfig,
                  [activeTaxType]: newBrackets
              }
          };
      });
  };

  // Library Actions
  const handleDelete = (id: string) => {
    if (window.confirm("Delete this item from the standard library?")) {
      setLibrary(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleDuplicate = (item: LineItem) => {
    const newItem = {
      ...item,
      id: `LIB-${Date.now()}`,
      code: `${item.code}-COPY`,
      description: `${item.description} (Copy)`
    };
    setLibrary(prev => [...prev, newItem]);
  };

  const handleEdit = (item: LineItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    const newItem: LineItem = {
      id: `LIB-${Date.now()}`,
      code: 'NEW-001',
      category: CostCategory.CONSTRUCTION,
      description: 'New Cost Item',
      inputType: InputType.FIXED,
      amount: 10000,
      startDate: 0,
      span: 1,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE
    };
    setEditingItem(newItem);
    setIsModalOpen(true);
  };

  const saveItem = (item: LineItem) => {
    if (!item) return;
    setLibrary(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.map(i => i.id === item.id ? item : i);
      } else {
        return [...prev, item];
      }
    });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // -- Filtered Library --
  const filteredLibrary = library.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const NavButton = ({ id, label, icon }: { id: 'drivers' | 'library' | 'tax', label: string, icon: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 mb-2 transition-colors ${
        activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <i className={`fa-solid ${icon} w-5 text-center`}></i>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="h-full flex bg-slate-50">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-4">System Admin</h2>
        <nav className="flex-1">
          <NavButton id="drivers" label="Global Drivers" icon="fa-sliders" />
          <NavButton id="tax" label="Tax & Duty Scales" icon="fa-scale-balanced" />
          <NavButton id="library" label="Cost Library" icon="fa-book-open" />
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-100">
           <button 
             onClick={handleReset}
             className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex items-center"
           >
             <i className="fa-solid fa-rotate-left mr-2"></i> Factory Reset
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-5xl mx-auto">
          
          {/* TAB 1: GLOBAL DRIVERS */}
          {activeTab === 'drivers' && (
            <div className="animate-in fade-in duration-300 space-y-8">
               <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Global Drivers</h1>
                    <p className="text-slate-500 text-sm mt-1">Set default financial assumptions applied to new projects.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-8">
                  {/* Section 1: Economic Defaults */}
                  <section>
                     <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Economic Defaults</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <RateCard 
                          label="Default GST Rate" 
                          desc="Applied to Taxable items" 
                          value={rates.defaultGstRate || 10} 
                          suffix="%"
                          onChange={(v) => handleRateChange('defaultGstRate', v)} 
                        />
                        <RateCard 
                          label="Cost Escalation" 
                          desc="Default annual inflation" 
                          value={rates.defaultEscalationRate || 3} 
                          suffix="% p.a."
                          onChange={(v) => handleRateChange('defaultEscalationRate', v)} 
                        />
                        <RateCard 
                          label="Agent Commission" 
                          desc="Default Sales Fee" 
                          value={rates.defaultAgentFeePct || 2.2} 
                          suffix="%"
                          onChange={(v) => handleRateChange('defaultAgentFeePct', v)} 
                        />
                     </div>
                  </section>

                  {/* Section 2: Smart Logic */}
                  <section>
                     <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Smart Logic / Auto-Calcs</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <RateCard 
                          label="Architect Fees" 
                          desc="% of Construction" 
                          value={rates.architectPct} 
                          suffix="%"
                          onChange={(v) => handleRateChange('architectPct', v)} 
                        />
                        <RateCard 
                          label="Project Management" 
                          desc="% of Construction" 
                          value={rates.projectManagementPct} 
                          suffix="%"
                          onChange={(v) => handleRateChange('projectManagementPct', v)} 
                        />
                        <RateCard 
                          label="Civil Engineering" 
                          desc="Rate per Land Area" 
                          value={rates.civilEngRatePerSqm} 
                          suffix="$/m²"
                          onChange={(v) => handleRateChange('civilEngRatePerSqm', v)} 
                        />
                        <RateCard 
                          label="Landscaping" 
                          desc="Rate per Land Area" 
                          value={rates.landscapeRatePerSqm} 
                          suffix="$/m²"
                          onChange={(v) => handleRateChange('landscapeRatePerSqm', v)} 
                        />
                        <RateCard 
                          label="Construction Contingency" 
                          desc="% of Construction" 
                          value={rates.contingencyPct} 
                          suffix="%"
                          onChange={(v) => handleRateChange('contingencyPct', v)} 
                        />
                     </div>
                  </section>
               </div>
            </div>
          )}

          {/* TAB: TAX SCALES */}
          {activeTab === 'tax' && (
              <div className="animate-in fade-in duration-300">
                  <div className="flex justify-between items-end border-b border-slate-200 pb-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tax & Duty Scales</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage progressive tax brackets for Stamp Duty and Land Tax.</p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-6">
                      
                      {/* Controls */}
                      <div className="flex space-x-4">
                          <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex">
                              {(['VIC', 'NSW', 'QLD'] as TaxState[]).map(state => (
                                  <button
                                    key={state}
                                    onClick={() => setActiveTaxState(state)}
                                    className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
                                        activeTaxState === state 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                      {state}
                                  </button>
                              ))}
                          </div>

                          <select 
                            value={activeTaxType}
                            onChange={(e) => setActiveTaxType(e.target.value as TaxType)}
                            className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 focus:ring-blue-500"
                          >
                              <option value="STAMP_DUTY">Stamp Duty (Transfer)</option>
                              <option value="LAND_TAX_GENERAL">Land Tax (General)</option>
                              <option value="LAND_TAX_TRUST">Land Tax (Trust)</option>
                          </select>
                      </div>

                      {/* Dynamic Table */}
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                              <h3 className="font-bold text-slate-800 flex items-center">
                                  <i className="fa-solid fa-table mr-2 text-slate-400"></i>
                                  {activeTaxState} - {activeTaxType.replace(/_/g, ' ')}
                              </h3>
                              <button 
                                onClick={handleAddBracket}
                                className="text-[10px] font-bold bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-100 hover:bg-blue-50"
                              >
                                  <i className="fa-solid fa-plus mr-1"></i> Add Bracket
                              </button>
                          </div>
                          
                          <table className="w-full text-xs text-left">
                              <thead className="bg-white text-slate-500 border-b border-slate-100">
                                  <tr>
                                      <th className="px-4 py-2 font-bold w-32">Limit ($)</th>
                                      <th className="px-4 py-2 font-bold w-24">Rate (%)</th>
                                      <th className="px-4 py-2 font-bold w-32">Base ($)</th>
                                      <th className="px-4 py-2 font-bold w-32">Method</th>
                                      <th className="px-4 py-2 font-bold text-right">Actions</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {taxScales[activeTaxState]?.[activeTaxType]?.map((bracket, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-4 py-2">
                                              <input 
                                                type="number" 
                                                value={bracket.limit} 
                                                onChange={e => handleTaxUpdate(activeTaxState, activeTaxType, idx, 'limit', parseFloat(e.target.value))}
                                                className="w-full border-slate-200 rounded px-2 py-1"
                                              />
                                          </td>
                                          <td className="px-4 py-2">
                                              <input 
                                                type="number" step="0.01"
                                                value={bracket.rate} 
                                                onChange={e => handleTaxUpdate(activeTaxState, activeTaxType, idx, 'rate', parseFloat(e.target.value))}
                                                className="w-full border-slate-200 rounded px-2 py-1 font-bold text-slate-700"
                                              />
                                          </td>
                                          <td className="px-4 py-2">
                                              <input 
                                                type="number" 
                                                value={bracket.base} 
                                                onChange={e => handleTaxUpdate(activeTaxState, activeTaxType, idx, 'base', parseFloat(e.target.value))}
                                                className="w-full border-slate-200 rounded px-2 py-1 text-slate-500"
                                              />
                                          </td>
                                          <td className="px-4 py-2">
                                              <select 
                                                value={bracket.method}
                                                onChange={e => handleTaxUpdate(activeTaxState, activeTaxType, idx, 'method', e.target.value)}
                                                className="w-full border-slate-200 rounded px-2 py-1 text-[10px] font-bold"
                                              >
                                                  <option value="SLIDING">Sliding (Marginal)</option>
                                                  <option value="FLAT">Flat (Total)</option>
                                              </select>
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                              <button 
                                                onClick={() => handleDeleteBracket(idx)}
                                                className="text-slate-300 hover:text-red-500"
                                              >
                                                  <i className="fa-solid fa-trash"></i>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                                  {(!taxScales[activeTaxState]?.[activeTaxType] || taxScales[activeTaxState]?.[activeTaxType]?.length === 0) && (
                                      <tr>
                                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                              No tax brackets defined for this category.
                                          </td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}

          {/* TAB 2: LIBRARY */}
          {activeTab === 'library' && (
            <div className="animate-in fade-in duration-300">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Cost Library</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage standard line items and templates.</p>
                  </div>
                  <button 
                    onClick={handleCreate}
                    className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors text-sm flex items-center"
                  >
                    <i className="fa-solid fa-plus mr-2"></i> Add Item
                  </button>
               </div>

               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Search Bar */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative max-w-md">
                       <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400"></i>
                       <input 
                         type="text" 
                         placeholder="Search code, description or category..." 
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                       />
                    </div>
                  </div>

                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-3 w-32">Code</th>
                        <th className="px-6 py-3 w-48">Category</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3 text-right">Default Amount</th>
                        <th className="px-6 py-3 text-right w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLibrary.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-3 font-mono text-xs font-bold text-slate-500">{item.code}</td>
                          <td className="px-6 py-3">
                             <span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border border-slate-200 whitespace-nowrap">
                                {item.category.split(' ')[0]}
                             </span>
                          </td>
                          <td className="px-6 py-3 font-bold text-slate-700">{item.description}</td>
                          <td className="px-6 py-3 text-xs text-slate-500">{item.inputType}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">
                            {item.amount > 0 ? `$${item.amount.toLocaleString()}` : <span className="text-slate-300 italic">Input</span>}
                          </td>
                          <td className="px-6 py-3 text-right">
                             <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                                  <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onClick={() => handleDuplicate(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors" title="Duplicate">
                                  <i className="fa-solid fa-copy"></i>
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredLibrary.length === 0 && (
                    <div className="p-12 text-center text-slate-400 italic">No library items found matching your search.</div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
           <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">
                   {editingItem.id.startsWith('NEW') ? 'Create New Item' : 'Edit Library Item'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-xmark text-slate-400 hover:text-slate-600"></i></button>
              </div>
              <div className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Code</label>
                       <input 
                         type="text" value={editingItem.code} 
                         onChange={e => setEditingItem({...editingItem, code: e.target.value})}
                         className="w-full border-slate-200 rounded text-sm font-mono font-bold uppercase" 
                       />
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                       <select 
                         value={editingItem.category} 
                         onChange={e => setEditingItem({...editingItem, category: e.target.value as CostCategory})}
                         className="w-full border-slate-200 rounded text-sm font-medium"
                       >
                          {Object.values(CostCategory).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                    <input 
                      type="text" value={editingItem.description} 
                      onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                      className="w-full border-slate-200 rounded text-sm font-medium" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Input Type</label>
                       <select 
                         value={editingItem.inputType} 
                         onChange={e => setEditingItem({...editingItem, inputType: e.target.value as InputType})}
                         className="w-full border-slate-200 rounded text-sm text-blue-600 font-medium"
                       >
                          {Object.values(InputType).map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Default Amount</label>
                       <input 
                         type="number" value={editingItem.amount} 
                         onChange={e => setEditingItem({...editingItem, amount: parseFloat(e.target.value)})}
                         className="w-full border-slate-200 rounded text-sm font-bold text-right" 
                       />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Distribution</label>
                       <select 
                         value={editingItem.method} 
                         onChange={e => setEditingItem({...editingItem, method: e.target.value as DistributionMethod})}
                         className="w-full border-slate-200 rounded text-sm font-medium"
                       >
                          {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Treatment</label>
                       <select 
                         value={editingItem.gstTreatment} 
                         onChange={e => setEditingItem({...editingItem, gstTreatment: e.target.value as GstTreatment})}
                         className="w-full border-slate-200 rounded text-sm font-medium"
                       >
                          {Object.values(GstTreatment).map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                 <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                 <button onClick={() => saveItem(editingItem)} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md">
                   Save Item
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

const RateCard = ({ label, desc, value, suffix, onChange }: { label: string, desc: string, value: number, suffix: string, onChange: (v: number) => void }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
     <div className="flex justify-between items-start mb-4">
        <div>
           <h4 className="font-bold text-slate-800 text-sm">{label}</h4>
           <p className="text-xs text-slate-400 mt-1">{desc}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
           <i className="fa-solid fa-sliders"></i>
        </div>
     </div>
     <div className="relative">
        <input 
           type="number" 
           value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           className="w-full border-slate-200 rounded-lg text-lg font-bold text-slate-800 pr-10 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">{suffix}</span>
     </div>
  </div>
);
