
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { SiteDNAHub } from './components/SiteDNAHub'; 
import { AcquisitionManager } from './AcquisitionManager';
import { HelpTooltip } from './components/HelpTooltip';
import { GlossaryTerm } from './glossary';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { DEFAULT_TAX_SCALES } from './constants';
import { PdfService } from './services/pdfService';
import { SensitivityService } from './services/sensitivityService';

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

// --- SUB-COMPONENT: KPI HUD (Mini-Header) ---
const StickyKpiHeader = ({ stats, strategy, siteName }: { stats: any, strategy: 'SELL' | 'HOLD', siteName: string }) => (
  <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-2 md:py-3 flex flex-col md:flex-row md:items-center justify-between transition-all">
      
      {/* Mobile Context Line */}
      <div className="md:hidden flex justify-between items-center mb-1 pb-1 border-b border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[200px]">{siteName}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
              stats.devMarginPct > 15 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
              {stats.devMarginPct > 15 ? 'Feasible' : 'Review'}
          </span>
      </div>

      <div className="flex justify-between md:justify-start md:space-x-8 overflow-x-auto no-scrollbar items-end w-full md:w-auto">
          <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Profit</span>
              <span className={`text-sm md:text-lg font-black font-mono leading-none ${stats.netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${(stats.netProfit/1000000).toFixed(2)}m
              </span>
          </div>
          <div className="w-px h-6 bg-slate-100 mx-2 md:mx-0"></div>
          <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                  Margin <span className="hidden md:inline"><HelpTooltip term="MDC" className="ml-1 text-slate-300" /></span>
              </span>
              <span className={`text-sm md:text-lg font-black font-mono leading-none ${stats.devMarginPct > 15 ? 'text-slate-800' : 'text-amber-500'}`}>
                  {stats.devMarginPct.toFixed(2)}%
              </span>
          </div>
          <div className="w-px h-6 bg-slate-100 mx-2 md:mx-0"></div>
          <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                  IRR <span className="hidden md:inline"><HelpTooltip term="IRR" className="ml-1 text-slate-300" /></span>
              </span>
              <span className="text-sm md:text-lg font-black font-mono leading-none text-indigo-600">
                  {stats.equityIRR.toFixed(1)}%
              </span>
          </div>
          {strategy === 'SELL' && (
              <>
                <div className="w-px h-6 bg-slate-100 mx-2 md:mx-0 hidden md:block"></div>
                <div className="flex flex-col hidden md:flex">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Equity</span>
                    <span className="text-lg font-black font-mono leading-none text-slate-700">
                        ${(stats.peakEquity/1000000).toFixed(1)}m
                    </span>
                </div>
              </>
          )}
      </div>
      
      {/* Desktop Badge */}
      <div className="hidden md:flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
              stats.devMarginPct > 15 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
              : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}>
              {stats.devMarginPct > 15 ? 'Feasible' : 'Review'}
          </span>
      </div>
  </div>
);

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Initialize state from the passed scenario prop
  const [settings, setSettings] = useState<FeasibilitySettings>(activeScenario.settings);
  const [costs, setCosts] = useState<LineItem[]>(activeScenario.costs);
  const [revenues, setRevenues] = useState<RevenueItem[]>(activeScenario.revenues);
  
  // --- AUTO-SAVE GUARD ---
  const isInitialized = useRef(false);

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
    updatedAt: new Date().toISOString()
  }), [activeScenario, settings, costs, revenues]);

  // Sync back to parent when local state changes
  useEffect(() => {
    if (!isInitialized.current) {
        // Skip the first run (initialization) to avoid updating 'lastUpdated' just by viewing
        isInitialized.current = true;
        return;
    }
    if (onSaveScenario) {
      onSaveScenario(currentScenarioState);
    }
  }, [settings, costs, revenues]);

  // Update local state if activeScenario changes from outside (e.g. switching scenarios)
  useEffect(() => {
    isInitialized.current = false;
    setSettings(activeScenario.settings);
    setCosts(activeScenario.costs);
    setRevenues(activeScenario.revenues);
    setActiveTab(site.status === 'Acquired' ? 'summary' : (activeScenario.strategy === 'HOLD' ? 'strategy' : 'deal'));
  }, [activeScenario.id]);

  const cashflow = useMemo(() => 
    FinanceEngine.calculateMonthlyCashflow(currentScenarioState, site.dna, linkedScenario, taxScales), 
    [currentScenarioState, site.dna, linkedScenario, taxScales]
  );

  const stats = useMemo(() => {
    const metrics = FinanceEngine.calculateProjectMetrics(cashflow, settings);
    return {
        ...metrics,
        profit: metrics.netProfit,
        margin: metrics.devMarginPct,
        irr: metrics.equityIRR,
        peakEquity: metrics.peakEquity,
        totalOut: metrics.totalDevelopmentCost,
        totalIn: metrics.grossRevenue + (metrics.netRevenue - metrics.grossRevenue),
        ltc: (metrics.peakDebtAmount / metrics.totalDevelopmentCost) * 100,
        constructionTotal: costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a,b)=>a+b.amount,0),
        interestTotal: metrics.totalFinanceCost
    };
  }, [cashflow, costs, settings, linkedScenario, isHoldStrategy]);

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

  const handleReportNavigation = (targetTab: string, section?: string) => {
      setActiveTab(targetTab);
  };

  const handleExportPdf = async () => {
      setIsGeneratingPdf(true);
      
      // Allow UI update
      setTimeout(async () => {
        try {
            // 1. Generate Matrix (Async with Worker option if supported)
            const steps = [-15, -10, -5, 0, 5, 10, 15];
            const sensitivityMatrix = await SensitivityService.generateMatrix(
                settings,
                costs,
                revenues,
                'revenue', // Default X
                'cost',    // Default Y
                steps,
                steps,
                site.dna,
                { runInWorker: true }
            );

            // 2. Generate detailed 1D Risk Tables (Sync for now as they are fast individual runs)
            const riskTables = {
                land: SensitivityService.generateSensitivityTable('land', settings, costs, revenues, site.dna),
                cost: SensitivityService.generateSensitivityTable('cost', settings, costs, revenues, site.dna),
                revenue: SensitivityService.generateSensitivityTable('revenue', settings, costs, revenues, site.dna),
                duration: SensitivityService.generateSensitivityTable('duration', settings, costs, revenues, site.dna),
                interest: SensitivityService.generateSensitivityTable('interest', settings, costs, revenues, site.dna)
            };

            // 3. Generate PDF
            await PdfService.generateBoardReport(
                site,
                currentScenarioState,
                stats,
                cashflow,
                site.dna,
                sensitivityMatrix,
                riskTables
            );
        } catch (e) {
            console.error("PDF Generation Error", e);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            setIsGeneratingPdf(false);
        }
      }, 100);
  };

  // Define Tabs based on Strategy
  const navTabs = isHoldStrategy ? [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot', desc: 'Site DNA' },
      { id: 'strategy', label: 'Hold Strategy', icon: 'fa-chess-rook', desc: 'Refinance & Exit' },
      { id: 'rent', label: 'Rental Revenue', icon: 'fa-house-user', desc: 'Income Assumptions' },
      { id: 'inputs', label: 'Hold Costs', icon: 'fa-file-invoice-dollar', desc: 'Opex & Capex' },
      { id: 'summary', label: 'Dashboard', icon: 'fa-chart-pie', desc: 'Performance' },
      { id: 'reports', label: 'Reports', icon: 'fa-file-pdf', desc: 'Export' }
  ] : [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot', desc: 'Site DNA' },
      { id: 'deal', label: 'Acquisition', icon: 'fa-handshake', desc: 'Land & Duty' },
      { id: 'inputs', label: 'Project Costs', icon: 'fa-file-invoice', desc: 'Construction & Fees' }, 
      { id: 'sales', label: 'Sales Revenue', icon: 'fa-tags', desc: 'Product Mix' },
      { id: 'summary', label: 'Dashboard', icon: 'fa-chart-pie', desc: 'Performance' },
      { id: 'reports', label: 'Reports', icon: 'fa-file-pdf', desc: 'Export' }
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      
      {/* 1. SECONDARY SIDEBAR (Desktop Navigation & Site Context) */}
      <aside className="hidden lg:flex w-64 bg-slate-50 border-r border-slate-200 flex-col shrink-0 overflow-y-auto z-30">
        <div className="p-6">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Model Navigation</h3>
           <nav className="space-y-1">
             {navTabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`w-full flex items-center text-left px-3 py-3 rounded-lg transition-all group ${
                   activeTab === tab.id 
                   ? 'bg-white shadow-sm border border-slate-200 ring-1 ring-slate-200' 
                   : 'hover:bg-white hover:shadow-sm'
                 }`}
               >
                 <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 transition-colors ${
                    activeTab === tab.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-500'
                 }`}>
                    <i className={`fa-solid ${tab.icon} text-sm`}></i>
                 </div>
                 <div>
                    <span className={`block text-xs font-bold ${activeTab === tab.id ? 'text-indigo-900' : 'text-slate-600 group-hover:text-slate-800'}`}>{tab.label}</span>
                    <span className="block text-[10px] text-slate-400 font-medium">{tab.desc}</span>
                 </div>
               </button>
             ))}
           </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-200">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              Site DNA 
              {onRequestEditSite && (
                  <button onClick={onRequestEditSite} className="text-indigo-600 hover:text-indigo-800"><i className="fa-solid fa-pen"></i></button>
              )}
           </h3>
           <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500">Land Area</span>
                 <span className="font-bold text-slate-700">{site.dna.landArea.toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500">Zoning</span>
                 <span className="font-bold text-slate-700">{site.dna.zoning || 'Pending'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500">Yield</span>
                 <span className="font-bold text-slate-700">{settings.totalUnits} Units</span>
              </div>
           </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50/30">
        
        {/* Mobile Navigation (Horizontal Scroll) */}
        <div className="lg:hidden bg-white border-b border-slate-200 overflow-x-auto no-scrollbar">
           <div className="flex px-4 py-2 space-x-2">
              {navTabs.map(tab => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
                   className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      activeTab === tab.id 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-white text-slate-600 border-slate-200'
                   }`}
                 >
                    {tab.label}
                 </button>
              ))}
           </div>
        </div>

        {/* Sticky KPI Header (Desktop & Mobile) */}
        <StickyKpiHeader stats={stats} strategy={activeScenario.strategy} siteName={site.name} />

        <div className="flex-1 overflow-y-auto p-3 lg:p-8">
          <div className="max-w-6xl mx-auto pb-24 md:pb-20">
            
            {/* TAB: SITE CONTEXT (Now Using DNA Hub in Read-Only Mode) */}
            {activeTab === 'site' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full min-h-[600px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-blue-50 border-b border-blue-100 p-3 flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-blue-700">
                        <i className="fa-solid fa-lock text-xs"></i>
                        <span className="text-xs font-bold uppercase tracking-wide">Read-Only View</span>
                    </div>
                    {onRequestEditSite && (
                        <button onClick={onRequestEditSite} className="text-xs font-bold text-blue-600 hover:underline">
                            Edit Global Settings
                        </button>
                    )}
                </div>
                <SiteDNAHub 
                  site={site} 
                  onUpdate={() => {}} // No-op in read-only mode
                  readOnly={true}
                />
              </div>
            )}

            {/* TAB: DEAL (Acquisition) - SELL Only */}
            {activeTab === 'deal' && !isHoldStrategy && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <AcquisitionManager 
                  settings={settings} 
                  onUpdate={setSettings} 
                  costs={costs}
                  revenues={revenues}
                  siteDNA={site.dna}
                  taxScales={taxScales}
                />
              </div>
            )}

            {/* TAB: STRATEGY (Refi) - HOLD Only */}
            {activeTab === 'strategy' && isHoldStrategy && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  
                  {linkedScenario && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                          <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                                  <i className="fa-solid fa-link"></i>
                              </div>
                              <div>
                                  <h3 className="text-sm font-bold text-indigo-900">Linked to Development Model</h3>
                                  <p className="text-xs text-indigo-700">Inheriting costs & timeline from: <strong>{linkedScenario.name}</strong></p>
                              </div>
                          </div>
                          <span className="text-[10px] font-bold bg-white text-indigo-600 px-3 py-1 rounded shadow-sm border border-indigo-100">Read Only Costs</span>
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
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 h-[320px] lg:h-[360px] shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Project Cashflow & Capital Stack</h3>
                      <div className="flex space-x-4 text-[10px] font-bold">
                        <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-slate-800 mr-2"></div>Senior Debt</span>
                        <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div>Mezzanine</span>
                        <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>Equity</span>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Performance Covenants</h3>
                      <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                             <span className="text-xs font-bold text-slate-600">Peak Equity Required</span>
                             <span className="text-sm font-black text-slate-900">${(stats.peakEquity/1e6).toFixed(2)}M</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                             <span className="text-xs font-bold text-slate-600">Margin on Equity (MoE)</span>
                             <span className={`text-sm font-black ${stats.marginOnEquity > 80 ? 'text-emerald-600' : 'text-slate-800'}`}>{stats.marginOnEquity.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                             <span className="text-xs font-bold text-slate-600">Peak Debt Exposure</span>
                             <div className="text-right">
                                <span className="block text-sm font-black text-red-600">${(stats.peakDebtAmount/1e6).toFixed(2)}M</span>
                                <span className="text-[9px] text-slate-400">{stats.peakDebtDate}</span>
                             </div>
                          </div>
                      </div>
                    </div>
                    <SensitivityMatrix settings={settings} costs={costs} revenues={revenues} siteDNA={site.dna} />
                </div>
                
              </div>
            )}

            {/* TAB: INPUTS (Construction/Costs OR Operating Costs) */}
            {activeTab === 'inputs' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Construction Total</p>
                                <p className="font-mono font-bold text-slate-800">${(stats.constructionTotal/1e6).toFixed(2)}m</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Completion Date</p>
                                <p className="font-mono font-bold text-slate-800">Month {linkedScenario.settings.durationMonths}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Land Basis</p>
                                <p className="font-mono font-bold text-slate-800">${(linkedScenario.settings.acquisition.purchasePrice/1e6).toFixed(2)}m</p>
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
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <RevenueInputGrid 
                    revenues={revenues} 
                    setRevenues={setRevenues} 
                    projectDuration={settings.durationMonths}
                    strategy={isHoldStrategy ? 'Hold' : 'Sell'}
                    inputScale={settings.inputScale}
                  />
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-6 no-print bg-slate-50/95 backdrop-blur sticky top-0 z-30 pt-2 px-1">
                    <div className="w-1/3 hidden md:block"></div>
                    <nav className="flex space-x-4">
                      <button onClick={() => setReportSubTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'pnl' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Profit & Loss</button>
                      <button onClick={() => setReportSubTab('cashflow')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'cashflow' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Detailed Cashflow</button>
                    </nav>
                    <div className="w-1/3 flex justify-end">
                       <button 
                         onClick={handleExportPdf}
                         disabled={isGeneratingPdf}
                         className={`flex items-center text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50 ${isGeneratingPdf ? 'w-48 justify-center' : ''}`}
                       >
                         {isGeneratingPdf ? (
                             <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Generating Board Pack...</>
                         ) : (
                             <><i className="fa-solid fa-file-invoice mr-2"></i> Export Board Pack (PDF)</>
                         )}
                       </button>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {reportSubTab === 'pnl' && (
                      <FeasibilityReport 
                          scenario={currentScenarioState} 
                          siteDNA={site.dna}
                          site={site}
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
    </div>
  );
};
