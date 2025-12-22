
import React, { useState, useEffect, useRef } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings, LineItemTag, MilestoneLink, SiteDNA, TaxConfiguration, CalculationLink, GstTreatment } from './types';
import { PhasingChart } from './PhasingChart';
import { CostLibraryModal } from './CostLibraryModal';
import { HelpTooltip } from './components/HelpTooltip';
import { FinanceEngine } from './services/financeEngine';
import { DEFAULT_TAX_SCALES } from './constants';

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
  siteDNA?: SiteDNA;
  taxScales?: TaxConfiguration;
}

// --- PERF OPTIMIZATION: Debounced Input Component ---
// Prevents recalculating the entire 10-year cashflow on every keystroke
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
  const initialRender = useRef(true);

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
  defaultOpen?: boolean;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: (category: CostCategory) => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
  estimatedRevenue: number;
  landArea: number;
  tooltipTerm?: string;
  siteDNA: SiteDNA;
  taxScales: TaxConfiguration;
  isOperatingLedger?: boolean;
}> = ({ 
  title, icon, categories, costs, settings, defaultOpen = false, 
  onUpdate, onAdd, onRemove, constructionTotal, estimatedRevenue, landArea, tooltipTerm, siteDNA, taxScales, isOperatingLedger = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sectionCosts = costs.filter(c => categories.includes(c.category));
  
  const sectionTotal = sectionCosts.reduce((acc, item) => {
    // We use the same engine calculation to display accurate totals in the header
    const amount = FinanceEngine.calculateLineItemTotal(item, settings, siteDNA, constructionTotal, estimatedRevenue, taxScales);
    return acc + amount;
  }, 0);

  const toggleExpanded = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  // --- Helper: Smart Driver Context ---
  const getSmartContext = (item: LineItem) => {
    // If we have an automated statutory link, we show that source instead
    if (item.calculationLink && item.calculationLink !== 'NONE') {
        const state = settings.acquisition.stampDutyState;
        let driverLabel = '';
        
        switch (item.calculationLink) {
            case 'AUTO_STAMP_DUTY':
                driverLabel = `Automated ${state} Duty`;
                break;
            case 'AUTO_LAND_TAX':
                driverLabel = `Automated ${state} Land Tax`;
                break;
            case 'AUTO_COUNCIL_RATES':
                driverLabel = `Rate on Capital Value`;
                break;
        }
        
        // Calculate the effective value on the fly for display
        const calculatedValue = FinanceEngine.calculateLineItemTotal(item, settings, siteDNA, constructionTotal, estimatedRevenue, taxScales);
        
        return { 
            showDriver: true, 
            driverLabel, 
            calculatedValue, 
            warning: null, 
            isLinked: true 
        };
    }

    // Normal Input Logic
    let driverValue = 0;
    let driverLabel = '';
    let isPercentage = false;
    let showDriver = false;
    let warning: string | null = null;

    if (isOperatingLedger) {
        // Special context for Operating Ledger
        if (item.inputType === InputType.PCT_REVENUE) {
            driverLabel = 'Gross Rental Income';
            isPercentage = true;
            showDriver = true;
            driverValue = estimatedRevenue; // Annual Gross Rent passed in
        } else if (item.inputType === InputType.FIXED) {
            // Treat as Annual Amount
            // No driver calculation needed, it's just a fixed annual sum
        }
    } else {
        // Standard Development Costs
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
                driverValue = landArea;
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
    }

    const calculatedValue = isPercentage 
        ? (driverValue * (item.amount / 100)) 
        : (driverValue * item.amount);

    return { showDriver, driverLabel, calculatedValue, warning, isLinked: false };
  };

  // --- Shared Advanced Config Form ---
  const AdvancedConfigSection = ({ item }: { item: LineItem }) => {
    return (
      <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
        <div className="flex flex-col md:flex-row gap-4">
           {/* Left: Phasing Chart (Hidden for Operating Ledger usually, as it's recurring) */}
           {!isOperatingLedger && (
               <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Cashflow Distribution</label>
                  <PhasingChart item={item} settings={settings} constructionTotal={constructionTotal} totalRevenue={estimatedRevenue} />
               </div>
           )}

           {/* Right: Controls */}
           <div className="w-full md:w-64 space-y-4">
              
              {/* Automation Link Control */}
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
                 {item.calculationLink && item.calculationLink !== 'NONE' && (
                     <p className="text-[9px] text-slate-400 italic leading-tight mt-1">
                         Overrides 'Amount' with auto-calculated value based on project metrics.
                     </p>
                 )}
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

              {/* GST Override */}
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

  return (
     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
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
                 <h3 className="text-sm font-bold text-slate-800 flex items-center">
                    {title}
                    {tooltipTerm && <HelpTooltip text={tooltipTerm} />}
                 </h3>
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
                 const { showDriver, driverLabel, calculatedValue, warning, isLinked } = getSmartContext(item);
                 const isExpanded = expandedRow === item.id;

                 return (
                    <div key={item.id} className={`bg-white transition-colors ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`}>
                       <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                          {/* Row Inputs */}
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                             <div className="md:col-span-4">
                                <DebouncedInput 
                                   type="text" 
                                   value={item.description}
                                   onChange={(val) => onUpdate(item.id, 'description', val)}
                                   className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 px-0 py-1 text-sm font-bold text-slate-800"
                                   placeholder="Item Description"
                                />
                             </div>
                             
                             <div className="md:col-span-3">
                                {isLinked ? (
                                    <div className="flex items-center space-x-2 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">
                                        <i className="fa-solid fa-robot text-indigo-500 text-[10px]"></i>
                                        <span className="text-[10px] font-bold text-indigo-700 uppercase">{driverLabel}</span>
                                    </div>
                                ) : (
                                    <select 
                                        value={item.inputType} 
                                        onChange={(e) => onUpdate(item.id, 'inputType', e.target.value)}
                                        className="w-full bg-transparent border-none text-xs font-medium text-slate-500 focus:ring-0 px-0 py-1"
                                    >
                                        {isOperatingLedger ? (
                                            <>
                                                <option value={InputType.FIXED}>Fixed Annual ($)</option>
                                                <option value={InputType.PCT_REVENUE}>% of Gross Rent</option>
                                                <option value={InputType.RATE_PER_UNIT}>Rate per Unit</option>
                                            </>
                                        ) : (
                                            Object.values(InputType).map(t => {
                                                // Prevent Circular Logic: Construction items cannot be % of Construction
                                                if (item.category === CostCategory.CONSTRUCTION && t === InputType.PCT_CONSTRUCTION) {
                                                    return null;
                                                }
                                                return <option key={t} value={t}>{t}</option>
                                            })
                                        )}
                                    </select>
                                )}
                                
                                {showDriver && !isLinked && (
                                   <div className="text-[9px] text-indigo-600 font-medium truncate" title={driverLabel}>
                                      Linked to {driverLabel}
                                   </div>
                                )}
                             </div>

                             <div className="md:col-span-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                   {isLinked ? (
                                       <div className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded cursor-not-allowed border border-slate-200 min-w-[80px] text-center" title="Value calculated automatically. Edit via Advanced Settings.">
                                           {calculatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                       </div>
                                   ) : (
                                       <DebouncedInput 
                                          type="number" 
                                          value={item.amount}
                                          onChange={(val) => onUpdate(item.id, 'amount', val)}
                                          className="w-24 text-right bg-transparent border-b border-slate-200 focus:border-indigo-500 focus:ring-0 px-1 py-1 text-sm font-bold text-slate-800"
                                       />
                                   )}
                                   <span className="text-xs text-slate-400 font-bold">
                                      {item.inputType.includes('Pct') || item.inputType.includes('%') ? '%' : '$'}
                                   </span>
                                </div>
                                {showDriver && !isLinked && (
                                   <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      = ${calculatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                   </div>
                                )}
                                {warning && <div className="text-[9px] text-red-500 font-bold">{warning}</div>}
                             </div>
                             
                             <div className="md:col-span-2 flex justify-end items-center space-x-2">
                                {item.linkToMilestone && (
                                    <div className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded font-bold uppercase tracking-wider" title="Linked to Project Milestone">
                                        Linked
                                    </div>
                                )}
                                <button 
                                   onClick={() => toggleExpanded(item.id)} 
                                   className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
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
                 <div className="flex justify-center items-center text-xs font-bold text-indigo-600">
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
  onUpdate, onAdd, onBulkAdd, onRemove, smartRates, libraryData, landArea, strategy = 'SELL', 
  siteDNA = { address: '', state: 'VIC', landArea: 0, lga: '', zoning: '', overlays: [], agent: {name:'', company:''}, vendor: {name:''}, milestones: {}}, 
  taxScales = DEFAULT_TAX_SCALES
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
            <h3 className="text-sm font-bold text-slate-800">
                {strategy === 'HOLD' ? 'Operating & Holding Costs' : 'Development Costs'}
            </h3>
            <p className="text-xs text-slate-500">
                {strategy === 'HOLD' ? 'Manage recurrent expenses (Opex) and statutory outgoings' : 'Manage budget line items'}
            </p>
         </div>
         <button 
           onClick={() => setShowLibrary(true)}
           className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 hover:text-indigo-700 transition-all shadow-sm flex items-center"
         >
           <i className="fa-solid fa-boxes-packing mr-2 text-indigo-500"></i> Load from Template
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
                defaultOpen={true}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                siteDNA={siteDNA}
                taxScales={taxScales}
            />
            <CostSection 
                title="2. Professional Fees" 
                icon="fa-user-tie"
                categories={[CostCategory.CONSULTANTS]}
                costs={costs} settings={settings}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                siteDNA={siteDNA}
                taxScales={taxScales}
            />
            <CostSection 
                title="3. Statutory & General" 
                icon="fa-scale-balanced"
                categories={[CostCategory.STATUTORY, CostCategory.MISCELLANEOUS]}
                costs={costs} settings={settings}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                tooltipTerm="AUV"
                siteDNA={siteDNA}
                taxScales={taxScales}
            />
            <CostSection 
                title="4. Selling & Marketing" 
                icon="fa-bullhorn"
                categories={[CostCategory.SELLING]}
                costs={costs} settings={settings}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                siteDNA={siteDNA}
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
                defaultOpen={true}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                tooltipTerm="OPEX"
                siteDNA={siteDNA}
                taxScales={taxScales}
                isOperatingLedger={true}
            />
            
            <CostSection 
                title="Statutory & Rates" 
                icon="fa-scale-balanced"
                categories={[CostCategory.STATUTORY]}
                costs={costs} settings={settings}
                onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove}
                constructionTotal={constructionTotal} estimatedRevenue={estimatedRevenue}
                landArea={landArea}
                siteDNA={siteDNA}
                taxScales={taxScales}
                isOperatingLedger={true}
            />
          </>
      )}

    </div>
  );
};
