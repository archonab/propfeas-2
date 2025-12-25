import React, { useState, useEffect, useRef } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings, LineItemTag, MilestoneLink, SiteDNA, TaxConfiguration, CalculationLink, GstTreatment, InputScale } from './types';
import { Site } from './types-v2';
import { PhasingChart } from './PhasingChart';
import { CostLibraryModal } from './CostLibraryModal';
import { HelpTooltip } from './components/HelpTooltip';
import { FinanceEngine } from './services/financeEngine';
import { DEFAULT_TAX_SCALES } from './constants';
import { SmartCurrencyInput } from './components/SmartCurrencyInput';

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
  landArea: number; 
  strategy?: 'SELL' | 'HOLD';
  // Fixed: Removed deprecated siteDNA prop
  site: Site; // V2 Required
  taxScales?: TaxConfiguration;
}

// --- PERF OPTIMIZATION: Debounced Input Component ---
const DebouncedInput = ({ 
  value, 
  onChange, 
  type = "text", 
  className,
  placeholder 
}: { 
  value: string | number; 
  onChange: (val: string | number) => void; 
  type?: string; 
  className?: string;
  placeholder?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(type === 'number' ? parseFloat(localValue.toString()) : localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input 
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
    />
  );
};

// --- SUB-COMPONENT: COST SECTION ---
const CostSection: React.FC<{
  title: string;
  icon: string;
  categories: CostCategory[];
  costs: LineItem[];
  settings: FeasibilitySettings;
  site: Site;
  defaultOpen?: boolean;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: (category: CostCategory) => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
  estimatedRevenue: number;
  landArea: number;
  tooltipTerm?: string;
  taxScales: TaxConfiguration;
  isOperatingLedger?: boolean;
}> = ({ 
  title, icon, categories, costs, settings, site, defaultOpen = false, 
  onUpdate, onAdd, onRemove, constructionTotal, estimatedRevenue, landArea, tooltipTerm, taxScales, isOperatingLedger = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sectionCosts = costs.filter(c => categories.includes(c.category));
  
  const sectionTotal = sectionCosts.reduce((acc, item) => {
    const amount = FinanceEngine.calculateLineItemTotal(item, settings, site, constructionTotal, estimatedRevenue, taxScales);
    return acc + amount;
  }, 0);

  const toggleExpanded = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  // --- Helper: Smart Driver Context ---
  const getSmartContext = (item: LineItem) => {
    if (item.calculationLink && item.calculationLink !== 'NONE') {
        // Use Site V2 Acquisition data
        const state = site.acquisition.stampDutyState;
        let driverLabel = '';
        
        switch (item.calculationLink) {
            case 'AUTO_STAMP_DUTY': driverLabel = `Automated ${state} Duty`; break;
            case 'AUTO_LAND_TAX': driverLabel = `Automated ${state} Land Tax`; break;
            case 'AUTO_COUNCIL_RATES': driverLabel = `Rate on Capital Value`; break;
        }
        
        const calculatedValue = FinanceEngine.calculateLineItemTotal(item, settings, site, constructionTotal, estimatedRevenue, taxScales);
        
        return { showDriver: true, driverLabel, calculatedValue, warning: null, isLinked: true };
    }

    let driverValue = 0;
    let driverLabel = '';
    let isPercentage = false;
    let showDriver = false;
    let warning: string | null = null;

    if (isOperatingLedger) {
        if (item.inputType === InputType.PCT_REVENUE) {
            driverLabel = 'Gross Rental Income';
            isPercentage = true;
            showDriver = true;
            driverValue = estimatedRevenue;
        }
    } else {
        switch (item.inputType) {
            case InputType.PCT_CONSTRUCTION:
                driverValue = constructionTotal; driverLabel = 'Const. Cost'; isPercentage = true; showDriver = true;
                if (driverValue <= 0) warning = 'No Construction Cost';
                break;
            case InputType.PCT_REVENUE:
                driverValue = estimatedRevenue; driverLabel = 'Est. Revenue'; isPercentage = true; showDriver = true;
                break;
            case InputType.RATE_PER_SQM:
                driverValue = landArea; driverLabel = `${(driverValue || 0).toLocaleString()} sqm Site`; showDriver = true;
                if (!driverValue || driverValue <= 0) warning = 'Missing Land Area';
                break;
            case InputType.RATE_PER_UNIT:
                driverValue = settings.totalUnits; driverLabel = `${driverValue} Units`; showDriver = true;
                if (!driverValue || driverValue <= 0) warning = 'No Units Defined';
                break;
        }
    }

    const calculatedValue = isPercentage 
        ? (driverValue * (item.amount / 100)) 
        : (driverValue * item.amount);

    return { showDriver, driverLabel, calculatedValue, warning, isLinked: false };
  };

  const AdvancedConfigSection = ({ item }: { item: LineItem }) => {
    return (
      <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
        <div className="flex flex-col md:flex-row gap-4">
           {!isOperatingLedger && (
               <div className="flex-1 hidden md:block">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Cashflow Distribution</label>
                  <PhasingChart 
                    item={item} 
                    settings={settings} 
                    site={site} // Pass site
                    constructionTotal={constructionTotal} 
                    totalRevenue={estimatedRevenue} 
                  />
               </div>
           )}

           <div className="w-full md:w-64 space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center">
                    Automated Calculation
                    <i className="fa-solid fa-robot ml-1.5 text-indigo-400"></i>
                 </label>
                 <select 
                    value={item.calculationLink || 'NONE'} 
                    onChange={(e) => onUpdate(item.id, 'calculationLink', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded text-xs font-bold py-1.5 text-slate-700"
                 >
                    <option value="NONE">Manual / Standard Input</option>
                    <option value="AUTO_STAMP_DUTY">Stamp Duty (Acquisition)</option>
                    <option value="AUTO_LAND_TAX">Land Tax (State Scale)</option>
                    <option value="AUTO_COUNCIL_RATES">Council Rates (% of Value)</option>
                 </select>
              </div>

              {!isOperatingLedger && (
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center">
                        Timing Link
                        <i className="fa-solid fa-link ml-1.5 text-indigo-400"></i>
                     </label>
                     <select 
                        value={item.linkToMilestone || ''} 
                        onChange={(e) => onUpdate(item.id, 'linkToMilestone', e.target.value || undefined)}
                        className="w-full bg-white border border-slate-200 rounded text-xs font-bold py-1.5 text-slate-700"
                     >
                        <option value="">Manual Start Date</option>
                        <option value={MilestoneLink.ACQUISITION}>Settlement Date</option>
                        <option value={MilestoneLink.CONSTRUCTION_START}>Construction Start</option>
                        <option value={MilestoneLink.CONSTRUCTION_END}>Construction End</option>
                     </select>
                  </div>
              )}

              {!isOperatingLedger && (
                  <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                            {item.linkToMilestone ? 'Offset (Mo)' : 'Start Month'}
                        </label>
                        <input 
                          type="number" 
                          value={item.startDate}
                          onChange={(e) => onUpdate(item.id, 'startDate', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold font-mono"
                          placeholder={item.linkToMilestone ? "+/- Months" : "Month 0"}
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Duration</label>
                        <input 
                          type="number" 
                          value={item.span}
                          onChange={(e) => onUpdate(item.id, 'span', parseFloat(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold"
                        />
                     </div>
                  </div>
              )}
              
              {!isOperatingLedger && (
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Distribution</label>
                     <select 
                        value={item.method} 
                        onChange={(e) => onUpdate(item.id, 'method', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded text-xs font-medium py-1.5"
                     >
                        {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
              )}

              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-slate-500">GST Treatment</label>
                 <select 
                    value={item.gstTreatment || GstTreatment.TAXABLE}
                    onChange={(e) => onUpdate(item.id, 'gstTreatment', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded text-xs font-medium py-1.5"
                 >
                    {Object.values(GstTreatment).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const scaleLabel = settings.inputScale === InputScale.THOUSANDS ? "'000s" : (settings.inputScale === InputScale.MILLIONS ? "'Ms" : "");

  return (
     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        {/* Section Header - Reddish Tint for "Money Out" */}
        <div 
          className="bg-orange-50/50 px-4 py-3 border-b border-orange-100 flex justify-between items-center cursor-pointer hover:bg-orange-100/50 transition-colors sticky top-0 z-10"
          onClick={() => setIsOpen(!isOpen)}
        >
           <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-orange-100 flex items-center justify-center text-orange-500 shadow-sm">
                 <i className={`fa-solid ${icon}`}></i>
              </div>
              <div>
                 <h3 className="text-sm font-bold text-orange-950 flex items-center">
                    {title}
                    {tooltipTerm && <HelpTooltip text={tooltipTerm} />}
                    {scaleLabel && isOpen && (
                        <span className="ml-3 text-[9px] font-bold uppercase bg-white text-orange-700 px-2 py-0.5 rounded border border-orange-200">
                            Figures in {scaleLabel}
                        </span>
                    )}
                 </h3>
                 <p className="text-[10px] text-orange-700/60 font-medium">
                   {sectionCosts.length} Items • Total: ${sectionTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                 </p>
              </div>
           </div>
           <i className={`fa-solid fa-chevron-down text-orange-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>

        {/* Section Body */}
        {isOpen && (
           <div className="divide-y divide-slate-100">
              {sectionCosts.map(item => {
                 const { showDriver, driverLabel, calculatedValue, warning, isLinked } = getSmartContext(item);
                 const isExpanded = expandedRow === item.id;
                 const isPercent = item.inputType.includes('Pct') || item.inputType.includes('%');

                 return (
                    <div key={item.id} className={`bg-white transition-colors group ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`}>
                       
                       {/* DESKTOP: BLOOMBERG GRID (Flex Row mimicking High Density Table) */}
                       <div className="hidden md:flex p-2 items-center gap-4 text-sm">
                          {/* Col 1: Description (Main) */}
                          <div className="flex-1 pl-2">
                             <DebouncedInput 
                                type="text" 
                                value={item.description}
                                onChange={(val) => onUpdate(item.id, 'description', val)}
                                className="w-full bg-transparent border-transparent focus:border-indigo-500 focus:ring-0 px-2 py-1 font-bold text-slate-800 placeholder:text-slate-300 hover:border-slate-200 rounded transition-colors"
                                placeholder="Item Description"
                             />
                          </div>
                          
                          {/* Col 2: Type/Driver */}
                          <div className="w-40">
                             {isLinked ? (
                                <div className="flex items-center space-x-2 px-2 py-1">
                                    <i className="fa-solid fa-robot text-indigo-500 text-[10px]"></i>
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase truncate" title={driverLabel}>{driverLabel}</span>
                                </div>
                             ) : (
                                <select 
                                    value={item.inputType} 
                                    onChange={(e) => onUpdate(item.id, 'inputType', e.target.value)}
                                    className="w-full bg-transparent border-transparent hover:border-slate-200 focus:border-indigo-500 rounded text-xs font-medium text-slate-500 focus:ring-0 px-2 py-1 cursor-pointer"
                                >
                                    {isOperatingLedger ? (
                                        <>
                                            <option value={InputType.FIXED}>Fixed Annual ($)</option>
                                            <option value={InputType.PCT_REVENUE}>% of Gross Rent</option>
                                            <option value={InputType.RATE_PER_UNIT}>Rate per Unit</option>
                                        </>
                                    ) : (
                                        Object.values(InputType).map(t => {
                                            if (item.category === CostCategory.CONSTRUCTION && t === InputType.PCT_CONSTRUCTION) return null;
                                            return <option key={t} value={t}>{t}</option>
                                        })
                                    )}
                                </select>
                             )}
                          </div>

                          {/* Col 3: Amount (Input) */}
                          <div className="w-32 text-right">
                             <div className="flex items-center justify-end group/input relative">
                                {!isLinked && (
                                   isPercent ? (
                                      // Standard Input for Percentages
                                      <DebouncedInput 
                                        type="number" 
                                        value={item.amount}
                                        onChange={(val) => onUpdate(item.id, 'amount', val)}
                                        className="w-full text-right bg-transparent border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 px-2 py-1 font-bold text-slate-800 font-mono rounded"
                                      />
                                   ) : (
                                      // Smart Currency Input for Dollar amounts
                                      <SmartCurrencyInput
                                        value={item.amount}
                                        onChange={(val) => onUpdate(item.id, 'amount', val)}
                                        scale={settings.inputScale}
                                        className="w-full text-right bg-transparent border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 px-2 py-1 font-bold text-slate-800 font-mono rounded"
                                      />
                                   )
                                )}
                                <span className={`text-xs text-slate-400 font-bold ml-1 ${isLinked ? 'opacity-0' : ''}`}>
                                   {isPercent ? '%' : '$'}
                                </span>
                             </div>
                          </div>

                          {/* Col 4: Total (Calculated) */}
                          <div className="w-32 text-right pr-4">
                             <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                                ${calculatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                             </div>
                             {showDriver && !isLinked && (
                                <div className="text-[9px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                   Link: {driverLabel}
                                </div>
                             )}
                          </div>
                          
                          {/* Col 5: Actions */}
                          <div className="w-16 flex justify-end items-center space-x-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={() => toggleExpanded(item.id)} 
                                className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
                             >
                                <i className="fa-solid fa-sliders"></i>
                             </button>
                             <button 
                                onClick={() => onRemove(item.id)} 
                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                             >
                                <i className="fa-solid fa-trash"></i>
                             </button>
                          </div>
                       </div>

                       {/* MOBILE: CARD STACK (Vertical Layout) */}
                       <div className="md:hidden p-4">
                          <div className="flex justify-between items-start mb-2" onClick={() => toggleExpanded(item.id)}>
                             <div className="flex-1 mr-4">
                                <div className="text-sm font-bold text-slate-800 leading-tight mb-1">{item.description}</div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                                        {isLinked ? 'Automated' : (item.inputType === InputType.FIXED ? 'Fixed' : 'Variable')}
                                    </span>
                                    {isLinked && <span className="text-[10px] text-indigo-500 font-bold">{driverLabel}</span>}
                                </div>
                             </div>
                             <div className="text-right">
                                <div className="text-sm font-black text-slate-800 font-mono">
                                    ${calculatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                {!isLinked && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        {item.amount}{isPercent ? '%' : ''}
                                    </div>
                                )}
                             </div>
                          </div>
                          
                          {/* Mobile Edit Drawer */}
                          {isExpanded && (
                             <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 gap-4 animate-in slide-in-from-top-2">
                                <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                                   <input 
                                      type="text" 
                                      value={item.description}
                                      onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                                      className="w-full border-slate-200 rounded text-sm font-bold text-slate-800 py-2"
                                   />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                                        <select 
                                            value={item.inputType} 
                                            onChange={(e) => onUpdate(item.id, 'inputType', e.target.value)}
                                            className="w-full border-slate-200 rounded text-sm text-slate-700 py-2"
                                            disabled={isLinked}
                                        >
                                            {Object.values(InputType).map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Amount</label>
                                        {isPercent ? (
                                            <input 
                                                type="number" 
                                                value={item.amount}
                                                onChange={(e) => onUpdate(item.id, 'amount', parseFloat(e.target.value))}
                                                className="w-full border-slate-200 rounded text-sm font-bold text-slate-800 py-2 font-mono"
                                                disabled={isLinked}
                                            />
                                        ) : (
                                            <SmartCurrencyInput
                                                value={item.amount}
                                                onChange={(val) => onUpdate(item.id, 'amount', val)}
                                                scale={settings.inputScale}
                                                disabled={isLinked}
                                                className="w-full border-slate-200 rounded text-sm font-bold text-slate-800 py-2 font-mono"
                                            />
                                        )}
                                    </div>
                                </div>
                                
                                {/* Re-use Advanced Config for Mobile */}
                                <AdvancedConfigSection item={item} />

                                <button onClick={() => onRemove(item.id)} className="w-full py-2 border border-red-200 text-red-600 rounded font-bold text-xs hover:bg-red-50 mt-2">
                                    Remove Item
                                </button>
                             </div>
                          )}
                       </div>
                       
                       {/* Expanded Panel (Desktop Only, since Mobile inlines it) */}
                       {isExpanded && (
                          <div className="hidden md:block px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 bg-slate-50/50">
                             <AdvancedConfigSection item={item} />
                          </div>
                       )}
                    </div>
                 );
              })}

              {/* Add Button (Desktop) */}
              <div className="hidden md:flex p-2 bg-white hover:bg-slate-50 transition-colors cursor-pointer border-t border-slate-100 justify-center" onClick={() => onAdd(categories[0])}>
                 <div className="flex items-center text-xs font-bold text-indigo-600 py-1">
                    <i className="fa-solid fa-plus mr-2"></i> Add Item
                 </div>
              </div>

              {/* Add Button (Mobile Floating Action Style inside section) */}
              <div className="md:hidden p-4 border-t border-slate-100">
                 <button 
                    onClick={() => onAdd(categories[0])}
                    className="w-full py-3 rounded-lg border border-dashed border-indigo-300 text-indigo-600 bg-indigo-50 font-bold text-sm flex justify-center items-center"
                 >
                    <i className="fa-solid fa-plus mr-2"></i> Add Item
                 </button>
              </div>
           </div>
        )}
     </div>
  );
};

// --- MAIN COMPONENT: FEASIBILITY INPUT GRID ---

export const FeasibilityInputGrid: React.FC<Props> = ({ 
  costs, settings, constructionTotal, estimatedRevenue = 0,
  onUpdate, onAdd, onBulkAdd, onRemove, smartRates, libraryData, landArea, strategy = 'SELL', 
  site,
  taxScales = DEFAULT_TAX_SCALES
}) => {
  const [showLibrary, setShowLibrary] = useState(false);

  const handleLibraryImport = (items: LineItem[]) => {
    onBulkAdd(items);
  };

  return (
    <div className="space-y-6 pb-24">
      
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-14 md:static z-30">
         <div>
            <h3 className="text-sm font-bold text-slate-800">
                {strategy === 'HOLD' ? 'Operating & Holding Costs' : 'Development Costs'}
            </h3>
            <p className="text-[10px] md:text-xs text-slate-500">
                {strategy === 'HOLD' ? 'Manage recurrent expenses (Opex)' : 'Manage budget line items'}
            </p>
         </div>
         <button 
           onClick={() => setShowLibrary(true)}
           className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-white hover:text-indigo-700 transition-all shadow-sm flex items-center"
         >
           <i className="fa-solid fa-boxes-packing mr-2 text-indigo-500"></i> <span className="hidden md:inline">Load Template</span><span className="md:hidden">Import</span>
         </button>
      </div>

      <CostLibraryModal 
         isOpen={showLibrary} 
         onClose={() => setShowLibrary(false)} 
         onImport={handleLibraryImport}
         libraryData={libraryData}
      />

      {strategy === 'SELL' ? (
          <>
            <CostSection 
                title="1. Construction Costs" 
                icon="fa-trowel-bricks"
                categories={[CostCategory.CONSTRUCTION]}
                costs={costs} settings={settings}
                site={site}
                defaultOpen={true}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                taxScales={taxScales}
            />
            <CostSection 
                title="2. Professional Fees" 
                icon="fa-user-tie"
                categories={[CostCategory.CONSULTANTS]}
                costs={costs} settings={settings}
                site={site}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                taxScales={taxScales}
            />
            <CostSection 
                title="3. Statutory & General" 
                icon="fa-scale-balanced"
                categories={[CostCategory.STATUTORY, CostCategory.MISCELLANEOUS]}
                costs={costs} settings={settings}
                site={site}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                tooltipTerm="AUV"
                taxScales={taxScales}
            />
            <CostSection 
                title="4. Selling & Marketing" 
                icon="fa-bullhorn"
                categories={[CostCategory.SELLING]}
                costs={costs} settings={settings}
                site={site}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                taxScales={taxScales}
            />
          </>
      ) : (
          <>
            {/* HOLD STRATEGY SECTIONS */}
            <CostSection 
                title="Operating Expenses (Opex)" 
                icon="fa-file-invoice-dollar"
                categories={[CostCategory.MISCELLANEOUS, CostCategory.SELLING]}
                costs={costs} settings={settings}
                site={site}
                defaultOpen={true}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                tooltipTerm="OPEX"
                taxScales={taxScales}
                isOperatingLedger={true}
            />
            
            <CostSection 
                title="Statutory & Rates" 
                icon="fa-scale-balanced"
                categories={[CostCategory.STATUTORY]}
                costs={costs} settings={settings}
                site={site}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                taxScales={taxScales}
                isOperatingLedger={true}
            />
          </>
      )}

    </div>
  );
};