
import React, { useState, useMemo } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings, GstTreatment } from './types';
import { PhasingChart } from './PhasingChart';
import { CostLibraryModal } from './CostLibraryModal';

interface Props {
  costs: LineItem[];
  settings: FeasibilitySettings;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: (category: CostCategory) => void;
  onBulkAdd: (items: LineItem[]) => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
}

// --- SUB-COMPONENT: COST SECTION ---
// Handles the Table (Desktop) / Card (Mobile) rendering for a specific group of categories
const CostSection: React.FC<{
  title: string;
  icon: string;
  categories: CostCategory[];
  costs: LineItem[];
  settings: FeasibilitySettings;
  defaultOpen?: boolean;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: (category: CostCategory) => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
  estimatedRevenue: number;
}> = ({ 
  title, icon, categories, costs, settings, defaultOpen = false, 
  onUpdate, onAdd, onRemove, constructionTotal, estimatedRevenue 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sectionCosts = costs.filter(c => categories.includes(c.category));
  
  const sectionTotal = sectionCosts.reduce((acc, item) => acc + item.amount, 0);
  const perUnit = settings.totalUnits > 0 ? sectionTotal / settings.totalUnits : 0;

  const toggleExpanded = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  const handleMilestoneChange = (id: string, value: string) => {
    try {
      const milestoneMap: Record<number, number> = {};
      const parts = value.split(',');
      parts.forEach(part => {
        const [mo, pct] = part.split(':').map(s => parseFloat(s.trim()));
        if (!isNaN(mo) && !isNaN(pct)) milestoneMap[mo] = pct;
      });
      onUpdate(id, 'milestones', milestoneMap);
    } catch (e) { /* Ignore while typing */ }
  };

  const getMilestoneString = (milestones?: Record<number, number>) => {
    if (!milestones) return '';
    return Object.entries(milestones).map(([k, v]) => `${k}:${v}`).join(', ');
  };

  // --- Shared Advanced Config Form ---
  const AdvancedConfigSection = ({ item }: { item: LineItem }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Escalation %</label>
            <div className="flex items-center bg-white border border-slate-200 rounded px-2 shadow-sm">
              <input 
                  type="number" 
                  value={item.escalationRate || 0}
                  onChange={(e) => onUpdate(item.id, 'escalationRate', parseFloat(e.target.value))}
                  className="w-full text-sm md:text-xs font-bold border-none focus:ring-0 p-1.5"
              />
            </div>
        </div>
        {item.method === DistributionMethod.S_CURVE && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Steepness (k)</label>
              <div className="flex items-center h-[34px]">
                <input 
                    type="range" min="5" max="20" step="1"
                    value={item.sCurveSteepness || 10}
                    onChange={(e) => onUpdate(item.id, 'sCurveSteepness', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
        )}
      </div>
      {item.method === DistributionMethod.MILESTONE && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Milestones</label>
            <input 
                type="text" placeholder="1:10, 6:40"
                defaultValue={getMilestoneString(item.milestones)}
                onBlur={(e) => handleMilestoneChange(item.id, e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm md:text-xs mono focus:ring-2 focus:ring-blue-100 shadow-sm"
            />
          </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* SECTION HEADER */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 bg-white border border-slate-200 shadow-sm group-hover:text-blue-600 group-hover:border-blue-200 transition-colors`}>
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div>
             <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h4>
             <p className="text-[10px] text-slate-500 font-medium hidden md:block">
               {sectionCosts.length} items • Avg Duration: {sectionCosts.length > 0 ? (sectionCosts.reduce((a,b)=>a+b.span,0)/sectionCosts.length).toFixed(0) : 0} mos
             </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <div className="text-right">
              <div className="text-sm font-black text-slate-800">${(sectionTotal/1e6).toFixed(2)}m</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                Subtotal
              </div>
           </div>
           <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>
      </div>

      {/* SECTION CONTENT */}
      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white text-slate-400 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2 w-16">Code</th>
                  <th className="px-4 py-2 w-1/4">Description</th>
                  <th className="px-4 py-2">Input Mode</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-center">Start</th>
                  <th className="px-4 py-2 text-center">Dur.</th>
                  <th className="px-4 py-2">GST</th>
                  <th className="px-4 py-2">Curve</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {sectionCosts.map((item) => {
                   const isOverProject = (item.startDate + item.span) > settings.durationMonths;
                   const isCalculated = item.inputType !== InputType.FIXED;

                   return (
                     <React.Fragment key={item.id}>
                        <tr className={`hover:bg-blue-50/30 transition-colors ${expandedRow === item.id ? 'bg-blue-50/50' : ''}`}>
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => toggleExpanded(item.id)} className={`text-slate-400 hover:text-blue-600 ${expandedRow === item.id ? 'rotate-90 text-blue-600' : ''}`}>
                               <i className="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <input type="text" value={item.code} onChange={e => onUpdate(item.id, 'code', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-400 font-mono" />
                          </td>
                          <td className="px-4 py-2">
                             <input type="text" value={item.description} onChange={e => onUpdate(item.id, 'description', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700" />
                          </td>
                          <td className="px-4 py-2">
                             <select value={item.inputType} onChange={e => onUpdate(item.id, 'inputType', e.target.value)} className="bg-transparent border-none focus:ring-0 text-xs text-blue-600 font-medium cursor-pointer w-full">
                                {Object.values(InputType).map(t => <option key={t} value={t}>{t}</option>)}
                             </select>
                          </td>
                          <td className="px-4 py-2 text-right">
                             <div className="flex flex-col items-end">
                                <input type="number" value={item.amount} onChange={e => onUpdate(item.id, 'amount', parseFloat(e.target.value))} className={`w-24 bg-transparent text-right mono text-xs font-bold border-none focus:ring-0 ${isCalculated ? 'text-indigo-600' : 'text-slate-900'}`} />
                                {item.inputType === InputType.PCT_CONSTRUCTION && (
                                   <span className="text-[9px] text-slate-400">Yield: ${(constructionTotal * (item.amount/100)).toLocaleString()}</span>
                                )}
                             </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                             <input type="number" value={item.startDate} onChange={e => onUpdate(item.id, 'startDate', parseInt(e.target.value))} className={`w-12 bg-transparent text-center mono text-xs border-none focus:ring-0 ${isOverProject ? 'text-red-600 font-bold' : ''}`} />
                          </td>
                          <td className="px-4 py-2 text-center">
                             <input type="number" value={item.span} onChange={e => onUpdate(item.id, 'span', parseInt(e.target.value))} className="w-12 bg-transparent text-center mono text-xs border-none focus:ring-0" />
                          </td>
                          <td className="px-4 py-2">
                             <select value={item.gstTreatment} onChange={e => onUpdate(item.id, 'gstTreatment', e.target.value)} className="bg-transparent border-none focus:ring-0 text-[10px] font-bold cursor-pointer uppercase text-slate-500 w-24">
                                {Object.values(GstTreatment).map(g => <option key={g} value={g}>{g}</option>)}
                             </select>
                          </td>
                          <td className="px-4 py-2">
                             <select value={item.method} onChange={e => onUpdate(item.id, 'method', e.target.value)} className="bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-600 cursor-pointer w-24">
                                {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                             </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                             <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash-can"></i></button>
                          </td>
                        </tr>
                        
                        {/* Desktop Expand */}
                        {expandedRow === item.id && (
                           <tr className="bg-slate-50 border-b border-slate-100 shadow-inner">
                              <td colSpan={10} className="px-6 py-6">
                                 <div className="flex gap-8">
                                    <div className="flex-1">
                                       <h4 className="text-xs font-bold text-slate-700 uppercase mb-4">Advanced Configuration</h4>
                                       <AdvancedConfigSection item={item} />
                                    </div>
                                    <div className="w-[400px]">
                                       <PhasingChart item={item} settings={settings} constructionTotal={constructionTotal} totalRevenue={estimatedRevenue} />
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </React.Fragment>
                   );
                 })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST */}
          <div className="md:hidden space-y-3 p-3">
             {sectionCosts.map(item => {
               const isCalculated = item.inputType !== InputType.FIXED;
               const isOverProject = (item.startDate + item.span) > settings.durationMonths;

               return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                     {/* Card Header */}
                     <div 
                        className="p-4 flex flex-col gap-3"
                        onClick={(e) => {
                           if ((e.target as HTMLElement).tagName === 'INPUT') return;
                           toggleExpanded(item.id);
                        }}
                     >
                        <div className="flex justify-between items-start gap-3">
                           <div className="flex-1">
                              <input 
                                 type="text" value={item.description}
                                 onChange={e => onUpdate(item.id, 'description', e.target.value)}
                                 className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-base font-bold text-slate-800 placeholder:text-slate-300"
                                 placeholder="Description..."
                              />
                              <div className="flex items-center mt-1 space-x-2">
                                 <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded">{item.code}</span>
                                 {isOverProject && <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1.5 rounded">Duration Error</span>}
                              </div>
                           </div>
                           <div className="text-right">
                              <input 
                                 type="number" value={item.amount}
                                 onChange={e => onUpdate(item.id, 'amount', parseFloat(e.target.value))}
                                 className={`w-28 text-right bg-transparent border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-base font-bold ${isCalculated ? 'text-indigo-600' : 'text-slate-900'}`}
                              />
                              <button onClick={() => toggleExpanded(item.id)} className="block ml-auto mt-1 text-slate-400 p-1">
                                 <i className={`fa-solid fa-chevron-down transition-transform ${expandedRow === item.id ? 'rotate-180 text-blue-500' : ''}`}></i>
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Card Body */}
                     {expandedRow === item.id && (
                        <div className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-1">
                           <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Input Type</label>
                                 <select value={item.inputType} onChange={e => onUpdate(item.id, 'inputType', e.target.value)} className="w-full mt-1 bg-slate-50 border-slate-200 rounded text-sm text-blue-600 font-medium py-2">
                                    {Object.values(InputType).map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">GST</label>
                                 <select value={item.gstTreatment} onChange={e => onUpdate(item.id, 'gstTreatment', e.target.value)} className="w-full mt-1 bg-slate-50 border-slate-200 rounded text-sm text-slate-700 font-medium py-2">
                                    {Object.values(GstTreatment).map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Start Month</label>
                                 <input type="number" value={item.startDate} onChange={e => onUpdate(item.id, 'startDate', parseInt(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Duration</label>
                                 <input type="number" value={item.span} onChange={e => onUpdate(item.id, 'span', parseInt(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" />
                              </div>
                           </div>

                           <div className="pt-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Distribution Method</label>
                              <select value={item.method} onChange={e => onUpdate(item.id, 'method', e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded text-sm font-medium py-2">
                                 {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                           </div>

                           <AdvancedConfigSection item={item} />
                           
                           {/* Mobile Chart */}
                           <div className="h-32 w-full mt-2 -ml-2">
                              <PhasingChart item={item} settings={settings} constructionTotal={constructionTotal} totalRevenue={estimatedRevenue} />
                           </div>

                           <button onClick={() => onRemove(item.id)} className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-lg text-sm flex items-center justify-center hover:bg-red-100">
                              <i className="fa-solid fa-trash-can mr-2"></i> Remove Item
                           </button>
                        </div>
                     )}
                  </div>
               );
             })}
          </div>

          {/* SECTION FOOTER */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
             <button 
                onClick={() => onAdd(categories[0])}
                className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center shadow-sm"
             >
                <i className="fa-solid fa-plus mr-2"></i> Add Item
             </button>
             <div className="flex space-x-6">
                <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">Section Total</div>
                   <div className="text-sm font-bold text-slate-800">${sectionTotal.toLocaleString()}</div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">Rate / Unit</div>
                   <div className="text-sm font-bold text-slate-600">${perUnit.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                </div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
};


// --- MAIN GRID COMPONENT ---
export const FeasibilityInputGrid: React.FC<Props> = ({ costs, settings, onUpdate, onAdd, onBulkAdd, onRemove, constructionTotal }) => {
  // Estimated Revenue for Yield Calcs (Fixed for now, usually passed in)
  const estimatedRevenue = 10000000; 
  const [showLibrary, setShowLibrary] = useState(false);

  const handleAdd = (category: CostCategory) => {
    onAdd(category); 
  };

  return (
    <div className="space-y-4 pb-24">
      
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
         <div>
            <h3 className="text-sm font-bold text-slate-800">Development Costs</h3>
            <p className="text-xs text-slate-500">Manage budget line items</p>
         </div>
         <button 
           onClick={() => setShowLibrary(true)}
           className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 hover:text-blue-700 transition-all shadow-sm flex items-center"
         >
           <i className="fa-solid fa-boxes-packing mr-2 text-blue-500"></i> Load from Template
         </button>
      </div>

      <CostLibraryModal 
         isOpen={showLibrary} 
         onClose={() => setShowLibrary(false)} 
         onImport={(items) => {
            onBulkAdd(items);
         }}
      />

      {/* 1. Acquisition Costs */}
      <CostSection 
        title="1. Acquisition & Land" 
        icon="fa-map-location-dot"
        categories={[CostCategory.LAND]}
        costs={costs} settings={settings}
        defaultOpen={true}
        onUpdate={onUpdate} onAdd={handleAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 2. Construction Costs */}
      <CostSection 
        title="2. Construction Costs" 
        icon="fa-trowel-bricks"
        categories={[CostCategory.CONSTRUCTION]}
        costs={costs} settings={settings}
        defaultOpen={true}
        onUpdate={onUpdate} onAdd={handleAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 3. Professional Fees */}
      <CostSection 
        title="3. Professional Fees" 
        icon="fa-user-tie"
        categories={[CostCategory.CONSULTANTS]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={handleAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 4. Statutory & General */}
      <CostSection 
        title="4. Statutory & General" 
        icon="fa-scale-balanced"
        categories={[CostCategory.STATUTORY, CostCategory.MISCELLANEOUS]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={handleAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 5. Selling Costs */}
      <CostSection 
        title="5. Selling & Marketing" 
        icon="fa-bullhorn"
        categories={[CostCategory.SELLING]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={handleAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

    </div>
  );
};
