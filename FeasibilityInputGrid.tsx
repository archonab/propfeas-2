
import React, { useState } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings, LineItemTag } from './types';
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
  estimatedRevenue?: number;
  smartRates?: any;
  libraryData?: LineItem[];
}

// --- SUB-COMPONENT: COST SECTION ---
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
  
  const sectionTotal = sectionCosts.reduce((acc, item) => {
    let amount = item.amount;
    if (item.inputType === InputType.PCT_CONSTRUCTION) amount = (item.amount / 100) * constructionTotal;
    else if (item.inputType === InputType.PCT_REVENUE) amount = (item.amount / 100) * estimatedRevenue;
    else if (item.inputType === InputType.RATE_PER_SQM) amount = item.amount * (settings.site.landArea || 0);
    else if (item.inputType === InputType.RATE_PER_UNIT) amount = item.amount * (settings.totalUnits || 0);
    return acc + amount;
  }, 0);

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

  // --- Helper: Smart Driver Context ---
  const getSmartContext = (item: LineItem) => {
    let driverValue = 0;
    let driverLabel = '';
    let isPercentage = false;
    let showDriver = false;
    let warning: string | null = null;

    switch (item.inputType) {
        case InputType.PCT_CONSTRUCTION:
            driverValue = constructionTotal;
            driverLabel = 'Const. Cost';
            isPercentage = true;
            showDriver = true;
            if (driverValue <= 0) warning = 'No Construction Cost';
            break;
        case InputType.PCT_REVENUE:
            driverValue = estimatedRevenue;
            driverLabel = 'Est. Revenue';
            isPercentage = true;
            showDriver = true;
            break;
        case InputType.RATE_PER_SQM:
            driverValue = settings.site.landArea;
            driverLabel = `${(driverValue || 0).toLocaleString()} sqm Site`;
            showDriver = true;
            if (!driverValue || driverValue <= 0) warning = 'Missing Land Area';
            break;
        case InputType.RATE_PER_UNIT:
            driverValue = settings.totalUnits;
            driverLabel = `${driverValue} Units`;
            showDriver = true;
            if (!driverValue || driverValue <= 0) warning = 'No Units Defined';
            break;
    }

    const calculatedValue = isPercentage 
        ? (driverValue * (item.amount / 100)) 
        : (driverValue * item.amount);

    return { showDriver, driverLabel, calculatedValue, warning };
  };

  // --- Shared Advanced Config Form ---
  const AdvancedConfigSection = ({ item }: { item: LineItem }) => {
    const getAvailableTags = (): { value: LineItemTag, label: string }[] => {
      const base = [{ value: 'NONE' as LineItemTag, label: 'Standard Item (No Special Logic)' }];
      
      if (item.category === CostCategory.LAND) {
        return [...base, 
          { value: 'LAND_PRICE', label: 'Land Purchase Price' },
          { value: 'STAMP_DUTY', label: 'Stamp Duty (Acquisition)' },
          { value: 'LEGAL_PURCHASE', label: 'Legal Fees (Purchase)' }
        ];
      }
      if (item.category === CostCategory.SELLING) {
        return [...base,
          { value: 'AGENT_FEE', label: 'Agent Commission (Dynamic)' },
          { value: 'LEGAL_SALES', label: 'Legal Fees (Settlement)' }
        ];
      }
      if (item.category === CostCategory.STATUTORY) {
         return [...base, { value: 'STAMP_DUTY', label: 'Stamp Duty (If Statutory)' }];
      }
      return base;
    };

    const availableTags = getAvailableTags();

    return (
      <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
        <div className="flex flex-col md:flex-row gap-4">
           {/* Left: Phasing Chart */}
           <div className="flex-1">
              <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Cashflow Distribution</label>
              <PhasingChart item={item} settings={settings} constructionTotal={constructionTotal} totalRevenue={estimatedRevenue} />
           </div>

           {/* Right: Controls */}
           <div className="w-full md:w-64 space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-slate-500">Distribution Method</label>
                 <select 
                    value={item.method} 
                    onChange={(e) => onUpdate(item.id, 'method', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded text-xs font-medium py-1.5"
                 >
                    {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Start Month</label>
                    <input 
                      type="number" 
                      value={item.startDate}
                      onChange={(e) => onUpdate(item.id, 'startDate', parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Duration (Mo)</label>
                    <input 
                      type="number" 
                      value={item.span}
                      onChange={(e) => onUpdate(item.id, 'span', parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold"
                    />
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Escalation %</label>
                    <input 
                       type="number" 
                       value={item.escalationRate || 0}
                       onChange={(e) => onUpdate(item.id, 'escalationRate', parseFloat(e.target.value))}
                       className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold"
                    />
                 </div>
                 {item.method === DistributionMethod.S_CURVE && (
                     <div className="space-y-1">
                       <label className="text-[10px] font-bold uppercase text-slate-500">Steepness (k)</label>
                       <input 
                          type="number" min="5" max="20"
                          value={item.sCurveSteepness || 10}
                          onChange={(e) => onUpdate(item.id, 'sCurveSteepness', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold"
                       />
                     </div>
                 )}
              </div>

              {availableTags.length > 1 && (
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Special Function</label>
                    <select 
                       value={item.specialTag || 'NONE'} 
                       onChange={(e) => onUpdate(item.id, 'specialTag', e.target.value)}
                       className="w-full bg-white border border-slate-200 rounded text-xs font-bold text-indigo-700 py-1.5"
                    >
                       {availableTags.map(tag => (
                          <option key={tag.value} value={tag.value}>{tag.label}</option>
                       ))}
                    </select>
                 </div>
              )}

              {item.method === DistributionMethod.MILESTONE && (
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold uppercase text-slate-500">Milestones (Mo:%)</label>
                   <input 
                       type="text" placeholder="1:10, 6:40"
                       defaultValue={getMilestoneString(item.milestones)}
                       onBlur={(e) => handleMilestoneChange(item.id, e.target.value)}
                       className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"
                   />
                 </div>
              )}
           </div>
        </div>
      </div>
    );
  };

  return (
     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Section Header */}
        <div 
          className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
           <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                 <i className={`fa-solid ${icon}`}></i>
              </div>
              <div>
                 <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                 <p className="text-[10px] text-slate-500 font-medium">
                   {sectionCosts.length} Items • Total: ${sectionTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                 </p>
              </div>
           </div>
           <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>

        {/* Section Body */}
        {isOpen && (
           <div className="divide-y divide-slate-100">
              {sectionCosts.map(item => {
                 const { showDriver, driverLabel, calculatedValue, warning } = getSmartContext(item);
                 const isExpanded = expandedRow === item.id;

                 return (
                    <div key={item.id} className={`bg-white transition-colors ${isExpanded ? 'bg-blue-50/20' : 'hover:bg-slate-50'}`}>
                       <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                          {/* Row Inputs */}
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                             <div className="md:col-span-4">
                                <input 
                                   type="text" 
                                   value={item.description}
                                   onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                                   className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 px-0 py-1 text-sm font-bold text-slate-800"
                                   placeholder="Item Description"
                                />
                             </div>
                             
                             <div className="md:col-span-3">
                                <select 
                                   value={item.inputType} 
                                   onChange={(e) => onUpdate(item.id, 'inputType', e.target.value)}
                                   className="w-full bg-transparent border-none text-xs font-medium text-slate-500 focus:ring-0 px-0 py-1"
                                >
                                   {Object.values(InputType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                {showDriver && (
                                   <div className="text-[9px] text-blue-600 font-medium truncate" title={driverLabel}>
                                      Linked to {driverLabel}
                                   </div>
                                )}
                             </div>

                             <div className="md:col-span-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                   <input 
                                      type="number" 
                                      value={item.amount}
                                      onChange={(e) => onUpdate(item.id, 'amount', parseFloat(e.target.value))}
                                      className="w-24 text-right bg-transparent border-b border-slate-200 focus:border-blue-500 focus:ring-0 px-1 py-1 text-sm font-bold text-slate-800"
                                   />
                                   <span className="text-xs text-slate-400 font-bold">
                                      {item.inputType.includes('Pct') || item.inputType.includes('%') ? '%' : '$'}
                                   </span>
                                </div>
                                {showDriver && (
                                   <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      = ${calculatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                   </div>
                                )}
                                {warning && <div className="text-[9px] text-red-500 font-bold">{warning}</div>}
                             </div>
                             
                             <div className="md:col-span-2 flex justify-end items-center space-x-2">
                                <button 
                                   onClick={() => toggleExpanded(item.id)} 
                                   className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                   title="Advanced Settings"
                                >
                                   <i className="fa-solid fa-sliders"></i>
                                </button>
                                <button 
                                   onClick={() => onRemove(item.id)} 
                                   className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                   title="Remove Item"
                                >
                                   <i className="fa-solid fa-trash"></i>
                                </button>
                             </div>
                          </div>
                       </div>
                       
                       {/* Expanded Panel */}
                       {isExpanded && (
                          <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                             <AdvancedConfigSection item={item} />
                          </div>
                       )}
                    </div>
                 );
              })}

              {/* Add Button */}
              <div className="p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => onAdd(categories[0])}>
                 <div className="flex justify-center items-center text-xs font-bold text-blue-600">
                    <i className="fa-solid fa-plus mr-2"></i> Add Item to {title}
                 </div>
              </div>
           </div>
        )}
     </div>
  );
};

// --- MAIN COMPONENT: FEASIBILITY INPUT GRID ---

export const FeasibilityInputGrid: React.FC<Props> = ({ 
  costs, settings, constructionTotal, estimatedRevenue = 0,
  onUpdate, onAdd, onBulkAdd, onRemove, smartRates, libraryData 
}) => {
  const [showLibrary, setShowLibrary] = useState(false);

  const handleLibraryImport = (items: LineItem[]) => {
    onBulkAdd(items);
  };

  return (
    <div className="space-y-6 pb-24">
      
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
         onImport={handleLibraryImport}
         libraryData={libraryData}
      />

      {/* 1. Construction Costs */}
      <CostSection 
        title="1. Construction Costs" 
        icon="fa-trowel-bricks"
        categories={[CostCategory.CONSTRUCTION]}
        costs={costs} settings={settings}
        defaultOpen={true}
        onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 2. Professional Fees */}
      <CostSection 
        title="2. Professional Fees" 
        icon="fa-user-tie"
        categories={[CostCategory.CONSULTANTS]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 3. Statutory & General */}
      <CostSection 
        title="3. Statutory & General" 
        icon="fa-scale-balanced"
        categories={[CostCategory.STATUTORY, CostCategory.MISCELLANEOUS]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

      {/* 4. Selling Costs */}
      <CostSection 
        title="4. Selling & Marketing" 
        icon="fa-bullhorn"
        categories={[CostCategory.SELLING]}
        costs={costs} settings={settings}
        onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
        constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
      />

    </div>
  );
};
