import React, { useState, useMemo, useEffect } from 'react';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus, GstTreatment, Site, SmartRates, FeasibilityScenario, TaxConfiguration } from './types';
import { FinanceEngine } from './services/financeEngine';
import { SolverService } from './services/solverService';
import { SensitivityMatrix } from './SensitivityMatrix';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { RevenueInputGrid } from './RevenueInputGrid';
import { HoldStrategySettings } from './components/HoldStrategySettings';
import { InvestmentSettings } from './components/InvestmentSettings';
import { FeasibilityReport } from './FeasibilityReport';
import { ConsolidatedCashflowReport } from './ConsolidatedCashflowReport';
import { FinanceSettings } from './FinanceSettings';
import { SiteContext } from './components/SiteContext'; 
import { AcquisitionManager } from './AcquisitionManager';
import { HelpTooltip } from './components/HelpTooltip';
import { GlossaryTerm } from './glossary';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { DEFAULT_TAX_SCALES } from './constants';

// Local Components
const KPITile = ({ label, val, color, term }: { label: string, val: string, color: string, term?: GlossaryTerm }) => (
  <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-20 md:h-24 relative overflow-visible">
     <p className={`text-lg md:text-2xl font-black ${color} tracking-tight`}>{val}</p>
     <div className="flex items-center">
        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        {term && <HelpTooltip term={term} />}
     </div>
  </div>
);

const ControlItem = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center mb-2 last:mb-0">
    <span className="text-xs text-slate-500 font-bold">{label}</span>
    <span className="text-xs font-bold text-slate-800 font-mono">{val}</span>
  </div>
);

interface Props {
  site: Site; 
  activeScenario: FeasibilityScenario;
  isEditable?: boolean;
  onPromote?: () => void;
  onSaveScenario?: (updatedScenario: FeasibilityScenario) => void;
  onRequestEditSite?: () => void; 
  smartRates?: SmartRates;
  libraryData?: LineItem[];
  taxScales?: TaxConfiguration;
}

export const FeasibilityEngine: React.FC<Props> = ({ 
  site, 
  activeScenario, 
  isEditable = true, 
  onPromote, 
  onSaveScenario, 
  onRequestEditSite,
  smartRates, 
  libraryData,
  taxScales = DEFAULT_TAX_SCALES
}) => {
  const isHoldStrategy = activeScenario.strategy === 'HOLD';
  const defaultTab = site.status === 'Acquired' ? 'summary' : (isHoldStrategy ? 'strategy' : 'deal');
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [reportSubTab, setReportSubTab] = useState<'pnl' | 'cashflow'>('pnl');

  // Initialize state from the passed scenario prop
  const [settings, setSettings] = useState<FeasibilitySettings>(activeScenario.settings);
  const [costs, setCosts] = useState<LineItem[]>(activeScenario.costs);
  const [revenues, setRevenues] = useState<RevenueItem[]>(activeScenario.revenues);
  
  const [showMobileDNA, setShowMobileDNA] = useState(false);
  const [isSolving, setIsSolving] = useState(false);

  // Find Linked Scenario if applicable
  const linkedScenario = useMemo(() => {
      if (activeScenario.strategy === 'HOLD' && activeScenario.linkedSellScenarioId) {
          return site.scenarios.find(s => s.id === activeScenario.linkedSellScenarioId);
      }
      return undefined;
  }, [activeScenario, site.scenarios]);

  // Helper: Construct Current State as Scenario Object
  const currentScenarioState: FeasibilityScenario = useMemo(() => ({
    ...activeScenario,
    settings,
    costs,
    revenues,
    lastModified: new Date().toISOString()
  }), [activeScenario, settings, costs, revenues]);

  // Sync back to parent when local state changes
  useEffect(() => {
    if (onSaveScenario) {
      onSaveScenario(currentScenarioState);
    }
  }, [settings, costs, revenues]);

  // Update local state if activeScenario changes from outside (e.g. switching scenarios)
  useEffect(() => {
    setSettings(activeScenario.settings);
    setCosts(activeScenario.costs);
    setRevenues(activeScenario.revenues);
    // Reset tab on scenario switch to avoid blank states
    setActiveTab(site.status === 'Acquired' ? 'summary' : (activeScenario.strategy === 'HOLD' ? 'strategy' : 'deal'));
  }, [activeScenario.id]);

  const cashflow = useMemo(() => 
    FinanceEngine.calculateMonthlyCashflow(currentScenarioState, site.dna, linkedScenario, taxScales), 
    [currentScenarioState, site.dna, linkedScenario, taxScales]
  );

  const stats = useMemo(() => {
    const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
    const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue + curr.lendingInterestIncome, 0);
    const profit = totalIn - totalOut;
    const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
    
    const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
    const irr = FinanceEngine.calculateIRR(equityFlows);
    const npv = FinanceEngine.calculateNPV(equityFlows, settings.discountRate);

    const peakSenior = Math.max(...cashflow.map(f => f.balanceSenior));
    const peakMezz = Math.max(...cashflow.map(f => f.balanceMezz));
    const peakTotalDebt = Math.max(...cashflow.map(f => f.balanceSenior + f.balanceMezz));
    const peakEquity = Math.max(...cashflow.map(f => f.balanceEquity));
    
    const ltc = totalOut > 0 ? (peakTotalDebt / totalOut) * 100 : 0;
    const lvr = totalIn > 0 ? (peakTotalDebt / totalIn) * 100 : 0;

    // Determine Construction Total based on linkage
    let constructionTotal = 0;
    if (isHoldStrategy && linkedScenario) {
        // Use the linked scenario's costs
        constructionTotal = linkedScenario.costs
            .filter(c => c.category === CostCategory.CONSTRUCTION)
            .reduce((acc, c) => acc + c.amount, 0);
    } else {
        constructionTotal = costs
            .filter(c => c.category === CostCategory.CONSTRUCTION)
            .reduce((acc, c) => acc + c.amount, 0);
    }

    const interestTotal = cashflow.reduce((acc, curr) => acc + curr.interestSenior + curr.interestMezz, 0);

    return { 
      profit, margin, irr, npv, totalOut, totalIn, 
      constructionTotal, interestTotal, 
      peakSenior, peakMezz, peakTotalDebt, peakEquity,
      ltc, lvr
    };
  }, [cashflow, costs, settings.discountRate, linkedScenario, isHoldStrategy]);

  const handleUpdateCost = (id: string, field: keyof LineItem, value: any) => {
    if (!isEditable) return;
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddCost = (category: CostCategory = CostCategory.CONSTRUCTION) => {
    if (!isEditable) return;
    const newItem: LineItem = {
      id: Date.now().toString(),
      code: `C${(costs.length + 1).toString().padStart(3, '0')}`,
      category: category,
      description: 'New Cost Item',
      inputType: InputType.FIXED,
      amount: 0,
      startDate: 0,
      span: 12,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE
    };
    setCosts([...costs, newItem]);
  };

  const handleBulkAddCosts = (newItems: LineItem[]) => {
    if (!isEditable) return;
    setCosts(prev => [...prev, ...newItems]);
  };

  const handleRemoveCost = (id: string) => {
    if (!isEditable) return;
    setCosts(costs.filter(c => c.id !== id));
  };

  // --- REPORT NAVIGATION HANDLER ---
  const handleReportNavigation = (targetTab: string, section?: string) => {
      setActiveTab(targetTab);
      // In a real app, we could also use `section` to scroll to the specific element
      // e.g. document.getElementById(section).scrollIntoView()
  };

  // Define Tabs based on Strategy
  const navTabs = isHoldStrategy ? [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot' },
      { id: 'strategy', label: 'Hold Strategy', icon: 'fa-chess-rook' },
      { id: 'rent', label: 'Rental Revenue', icon: 'fa-house-user' },
      { id: 'inputs', label: 'Hold Costs', icon: 'fa-file-invoice-dollar' },
      { id: 'summary', label: 'Dashboard', icon: 'fa-chart-simple' },
      { id: 'reports', label: 'Reports', icon: 'fa-file-pdf' }
  ] : [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot' },
      { id: 'deal', label: 'Acquisition', icon: 'fa-handshake' },
      { id: 'inputs', label: 'Project Costs', icon: 'fa-file-invoice' }, 
      { id: 'sales', label: 'Sales Revenue', icon: 'fa-tags' },
      { id: 'summary', label: 'Dashboard', icon: 'fa-chart-simple' },
      { id: 'reports', label: 'Reports', icon: 'fa-file-pdf' }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      
      {/* LEFT: Persistent Site DNA Sidebar */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 lg:sticky lg:top-4 overflow-hidden">
           
           <div 
             className="p-4 lg:p-5 flex justify-between items-center cursor-pointer lg:cursor-default hover:bg-slate-50 lg:hover:bg-white transition-colors"
             onClick={() => setShowMobileDNA(!showMobileDNA)}
           >
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
               <i className="fa-solid fa-dna mr-2 text-blue-500"></i> Site DNA
             </h3>
             <div className="lg:hidden text-slate-400">
                <i className={`fa-solid fa-chevron-${showMobileDNA ? 'up' : 'down'}`}></i>
             </div>
           </div>

           <div className={`px-5 pb-5 space-y-4 lg:space-y-6 lg:block ${showMobileDNA ? 'block' : 'hidden'}`}>
             <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center">
                    Land Area <HelpTooltip text="Total site area used for rate per sqm calculations." />
                 </label>
                 <div className="text-lg font-black text-slate-800">{site.dna.landArea.toLocaleString()} <span className="text-xs text-slate-400 font-bold">sqm</span></div>
               </div>
               
               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Zoning</label>
                 <div className="text-sm font-bold text-slate-800 leading-tight">{site.dna.zoning || "Pending"}</div>
               </div>

               <div className="pt-4 border-t border-slate-100 col-span-2 lg:col-span-1">
                 <label className="text-[10px] font-bold uppercase text-slate-400">Feasibility Yield</label>
                 <div className="flex items-center justify-between mt-1">
                   <span className="text-sm font-bold text-slate-700">{settings.totalUnits} Units</span>
                   <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono font-bold text-slate-600">
                     {(site.dna.landArea / (settings.totalUnits || 1)).toFixed(0)}m²/u
                   </span>
                 </div>
               </div>
             </div>
           </div>

        </div>
      </aside>

      {/* RIGHT: Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center no-print gap-4 sm:gap-0">
          <nav className="grid grid-cols-5 gap-1 sm:flex sm:space-x-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
            {navTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-1 sm:px-4 py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className={`fa-solid ${tab.icon} sm:mr-1`}></i>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
          
          <div className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center self-end sm:self-auto ${
            site.status === 'Acquired' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
            site.status === 'Due Diligence' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
             <div className={`w-2 h-2 rounded-full mr-2 ${
               site.status === 'Acquired' ? 'bg-emerald-500' : 
               site.status === 'Due Diligence' ? 'bg-purple-500' : 'bg-slate-400'
             }`}></div>
             {site.status}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          
          {/* TAB: SITE CONTEXT */}
          {activeTab === 'site' && (
            <SiteContext 
              site={site} 
              onRequestEdit={onRequestEditSite || (() => {})}
            />
          )}

          {/* TAB: DEAL (Acquisition) - SELL Only */}
          {activeTab === 'deal' && !isHoldStrategy && (
            <AcquisitionManager 
              settings={settings} 
              onUpdate={setSettings} 
              costs={costs}
              revenues={revenues}
              siteDNA={site.dna}
              taxScales={taxScales}
            />
          )}

          {/* TAB: STRATEGY (Refi) - HOLD Only */}
          {activeTab === 'strategy' && isHoldStrategy && (
             <div className="space-y-8 animate-in fade-in duration-300">
                
                {linkedScenario && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                                <i className="fa-solid fa-link"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-indigo-900">Linked to Development Model</h3>
                                <p className="text-xs text-indigo-700">Inheriting costs & timeline from: <strong>{linkedScenario.name}</strong></p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold bg-white text-indigo-600 px-3 py-1 rounded shadow-sm">Read Only Costs</span>
                    </div>
                )}

                <FinanceSettings 
                    settings={settings} 
                    onUpdate={setSettings} 
                    peakEquityRequired={stats.peakEquity}
                    projectLocation={site.dna.address}
                />
                
                <HoldStrategySettings 
                  settings={settings} 
                  revenues={revenues} 
                  cashflow={cashflow}
                  onUpdate={setSettings} 
                />
                
                <InvestmentSettings 
                  settings={settings} 
                  revenues={revenues} 
                  constructionTotal={stats.constructionTotal}
                  onUpdate={setSettings} 
                />
             </div>
          )}

          {/* TAB: SUMMARY (Dashboard) */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-200 pb-4 mb-4 gap-2">
                <div>
                    <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight leading-tight">{site.dna.address || "New Site Feasibility"}</h2>
                    <p className="text-sm text-slate-500 font-bold">Scenario: {activeScenario.name}</p>
                </div>
                <div className="text-left sm:text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${stats.margin > 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {stats.margin.toFixed(2)}% Margin
                    </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <KPITile label="Net Profit" val={`$${(stats.profit/1e6).toFixed(1)}M`} color="text-emerald-600" />
                      <KPITile label="Equity IRR" val={`${stats.irr.toFixed(1)}%`} color="text-indigo-600" term="IRR" />
                      <KPITile label="LTC" val={`${stats.ltc.toFixed(1)}%`} color={stats.ltc > 85 ? "text-red-600" : "text-slate-700"} term="LTC" />
                      <KPITile label="MDC" val={`${stats.margin.toFixed(1)}%`} color={stats.margin > 15 ? "text-emerald-600" : "text-amber-600"} term="MDC" />
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-slate-200 h-[320px] lg:h-[320px]">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Capital Stack Utilisation</h3>
                        <div className="flex space-x-3 text-[10px] font-bold">
                          <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-slate-800 mr-1"></div>Senior Debt</span>
                          <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-1"></div>Mezz</span>
                          <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>Equity</span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={cashflow} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickMargin={10} minTickGap={30} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(v/1e6).toFixed(0)}m`} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                            formatter={(val: number) => [`$${(val/1e6).toFixed(2)}M`, '']}
                          />
                          <Area type="monotone" stackId="1" dataKey="balanceSenior" stroke="#1e293b" fill="#1e293b" />
                          <Area type="monotone" stackId="1" dataKey="balanceMezz" stroke="#6366f1" fill="#6366f1" />
                          <Area type="monotone" stackId="1" dataKey="balanceEquity" stroke="#10b981" fill="#10b981" />
                        </AreaChart>
                      </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Finance Covenants</h3>
                    <div className="space-y-4">
                        <div className="pb-4 border-b border-slate-200">
                          <ControlItem label="Peak Equity" val={`$${(stats.peakEquity/1e6).toFixed(1)}M`} />
                          <ControlItem label="Senior Rate" val={`${settings.capitalStack.senior.interestRate}%`} />
                          <ControlItem label="Mezzanine Rate" val={`${settings.capitalStack.mezzanine.interestRate}%`} />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Peak Senior Debt</span>
                              <span className="font-bold">${(stats.peakSenior/1e6).toFixed(2)}M</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-800" style={{ width: `${(stats.peakSenior / (stats.peakTotalDebt || 1)) * 100}%` }}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Peak Mezz Debt</span>
                              <span className="font-bold">${(stats.peakMezz/1e6).toFixed(2)}M</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${(stats.peakMezz / (stats.peakTotalDebt || 1)) * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <SensitivityMatrix settings={settings} costs={costs} revenues={revenues} siteDNA={site.dna} />
            </div>
          )}

          {/* TAB: INPUTS (Construction/Costs OR Operating Costs) */}
          {activeTab === 'inputs' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {!isHoldStrategy && (
                <FinanceSettings 
                  settings={settings} 
                  onUpdate={setSettings} 
                  peakEquityRequired={stats.peakEquity}
                  projectLocation={site.dna.address} 
                />
              )}
              
              {isHoldStrategy && linkedScenario && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-800 flex items-center">
                              <i className="fa-solid fa-link mr-2 text-indigo-500"></i>
                              Linked Development Basis
                          </h3>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                              Source: {linkedScenario.name}
                          </span>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                              <p className="text-slate-500 text-xs">Total Construction Cost</p>
                              <p className="font-bold text-slate-800">${(stats.constructionTotal/1e6).toFixed(2)}m</p>
                          </div>
                          <div>
                              <p className="text-slate-500 text-xs">Completion Date</p>
                              <p className="font-bold text-slate-800">Month {linkedScenario.settings.durationMonths}</p>
                          </div>
                          <div>
                              <p className="text-slate-500 text-xs">Land Value (Basis)</p>
                              <p className="font-bold text-slate-800">${(linkedScenario.settings.acquisition.purchasePrice/1e6).toFixed(2)}m</p>
                          </div>
                      </div>
                  </div>
              )}

              <FeasibilityInputGrid 
                costs={costs} 
                settings={settings} 
                constructionTotal={stats.constructionTotal}
                estimatedRevenue={stats.totalIn}
                onUpdate={handleUpdateCost} 
                onAdd={handleAddCost} 
                onBulkAdd={handleBulkAddCosts}
                onRemove={handleRemoveCost} 
                smartRates={smartRates}
                libraryData={libraryData}
                landArea={site.dna.landArea} 
                strategy={isHoldStrategy ? 'HOLD' : 'SELL'}
              />
            </div>
          )}

          {/* TAB: SALES or RENTAL REVENUE */}
          {((activeTab === 'sales' && !isHoldStrategy) || (activeTab === 'rent' && isHoldStrategy)) && (
             <div className="space-y-8 animate-in fade-in duration-300">
                <RevenueInputGrid 
                  revenues={revenues} 
                  setRevenues={setRevenues} 
                  projectDuration={settings.durationMonths}
                  strategy={isHoldStrategy ? 'Hold' : 'Sell'}
                />
             </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
               <div className="flex justify-center border-b border-slate-200 pb-1 no-print">
                  <nav className="flex space-x-4">
                     <button onClick={() => setReportSubTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'pnl' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Profit & Loss</button>
                     <button onClick={() => setReportSubTab('cashflow')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'cashflow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Detailed Cashflow</button>
                  </nav>
               </div>

               <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {reportSubTab === 'pnl' && (
                    <FeasibilityReport 
                        scenario={currentScenarioState} 
                        siteDNA={site.dna} 
                        stats={stats} 
                        onNavigate={handleReportNavigation}
                    />
                  )}
                  {reportSubTab === 'cashflow' && <ConsolidatedCashflowReport cashflow={cashflow} settings={settings} />}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};