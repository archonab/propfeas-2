
import React, { useState, useMemo, useEffect } from 'react';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus, GstTreatment, Site, SmartRates, FeasibilityScenario } from './types';
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
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';

// Local Components
const KPITile = ({ label, val, color }: { label: string, val: string, color: string }) => (
  <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-20 md:h-24">
     <p className={`text-lg md:text-2xl font-black ${color} tracking-tight`}>{val}</p>
     <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

const ControlItem = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center text-xs mb-2 last:mb-0">
     <span className="text-slate-500 font-medium">{label}</span>
     <span className="font-bold text-slate-700">{val}</span>
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
}

export const FeasibilityEngine: React.FC<Props> = ({ 
  site, 
  activeScenario, 
  isEditable = true, 
  onPromote, 
  onSaveScenario, 
  onRequestEditSite,
  smartRates, 
  libraryData 
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
  
  const [solveTarget, setSolveTarget] = useState<number>(20);
  const [solveType, setSolveType] = useState<'margin' | 'irr'>('margin');
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
    FinanceEngine.calculateMonthlyCashflow(currentScenarioState, site.dna, linkedScenario), 
    [currentScenarioState, site.dna, linkedScenario]
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

    const constructionTotal = costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((acc, c) => acc + c.amount, 0);
    const interestTotal = cashflow.reduce((acc, curr) => acc + curr.interestSenior + curr.interestMezz, 0);

    return { 
      profit, margin, irr, npv, totalOut, totalIn, 
      constructionTotal, interestTotal, 
      peakSenior, peakMezz, peakTotalDebt, peakEquity,
      ltc, lvr
    };
  }, [cashflow, costs, settings.discountRate]);

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

  const handleExecuteAcquisition = () => {
    if (window.confirm("EXECUTE ACQUISITION?\n\nThis will lock the current Feasibility Scenario as the Project Baseline and change status to 'Acquired'.\n\nThis action cannot be undone.")) {
      if (onPromote) onPromote();
      setTimeout(() => {
        alert("✅ SITE ACQUIRED\n\nFeasibility Baseline Locked.\n\nACTION REQUIRED: Please link Vendor Solicitor details in the Contracts Module.");
      }, 500);
    }
  };

  const handleSolveRLV = () => {
    if (!isEditable) return;
    setIsSolving(true);
    
    setTimeout(() => {
      try {
        const result = SolverService.solveForResidualLandValue(
          solveTarget,
          solveType,
          settings,
          costs,
          revenues,
          site.dna
        );
        setSettings(prev => ({
           ...prev,
           acquisition: {
              ...prev.acquisition,
              purchasePrice: result.landValue
           }
        }));
        alert(`Solver Successful!\n\nResidual Land Value: $${(result.landValue/1e6).toFixed(2)}M`);
      } catch (e: any) {
        alert("Solver Error: " + e.message);
      } finally {
        setIsSolving(false);
      }
    }, 100);
  };

  // Define Tabs based on Strategy
  const navTabs = isHoldStrategy ? [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot' },
      { id: 'strategy', label: 'Hold Strategy', icon: 'fa-chess-rook' },
      { id: 'rent', label: 'Rental Revenue', icon: 'fa-house-user' },
      { id: 'inputs', label: 'Operating Costs', icon: 'fa-file-invoice-dollar' },
      { id: 'summary', label: 'Dashboard', icon: 'fa-chart-simple' },
      { id: 'reports', label: 'Reports', icon: 'fa-file-pdf' }
  ] : [
      { id: 'site', label: 'Context', icon: 'fa-map-location-dot' },
      { id: 'deal', label: 'Acquisition', icon: 'fa-handshake' },
      { id: 'inputs', label: 'Construction Costs', icon: 'fa-trowel-bricks' },
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
                 <label className="text-[10px] font-bold uppercase text-slate-400">Land Area</label>
                 <div className="text-lg font-black text-slate-800">{site.dna.landArea.toLocaleString()} <span className="text-xs text-slate-400 font-bold">sqm</span></div>
               </div>
               
               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Zoning</label>
                 <div className="text-sm font-bold text-slate-800 leading-tight">{site.dna.zoning || "Pending"}</div>
               </div>

               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Council (LGA)</label>
                 <div className="text-sm font-bold text-slate-800 leading-tight">{site.dna.lga || "Pending"}</div>
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

             {site.status === 'Due Diligence' && isEditable && !isHoldStrategy && (
               <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                  <button 
                    onClick={handleExecuteAcquisition}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] transition-all group"
                  >
                    <div className="text-xs font-black uppercase tracking-widest mb-0.5">Execute Acquisition</div>
                    <div className="text-[9px] font-medium opacity-90 group-hover:opacity-100">Lock Baseline & Proceed</div>
                  </button>
               </div>
             )}
             
             {site.status === 'Acquired' && (
               <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center hidden lg:block">
                  <i className="fa-solid fa-lock text-slate-400 mb-1"></i>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Baseline Locked</div>
                  <div className="text-[9px] text-slate-400">{new Date().toLocaleDateString()}</div>
               </div>
             )}
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
                      <KPITile label="Equity IRR" val={`${stats.irr.toFixed(1)}%`} color="text-indigo-600" />
                      <KPITile label="LTC" val={`${stats.ltc.toFixed(1)}%`} color={stats.ltc > 85 ? "text-red-600" : "text-slate-700"} />
                      <KPITile label="Peak LVR" val={`${stats.lvr.toFixed(1)}%`} color={stats.lvr > 65 ? "text-amber-600" : "text-slate-700"} />
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

                  {isEditable && site.status !== 'Acquired' && !isHoldStrategy && (
                    <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg border border-indigo-800 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <i className="fa-solid fa-wand-magic-sparkles text-6xl"></i>
                      </div>
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4 relative z-10">Residual Land Value Solver</h3>
                      
                      <div className="space-y-4 relative z-10">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-indigo-200 block mb-1">Target Metric</label>
                          <div className="flex bg-indigo-800/50 p-1 rounded-lg">
                              <button onClick={() => setSolveType('margin')} className={`flex-1 py-1 text-xs font-bold rounded ${solveType === 'margin' ? 'bg-white text-indigo-900' : 'text-indigo-300 hover:text-white'}`}>Margin %</button>
                              <button onClick={() => setSolveType('irr')} className={`flex-1 py-1 text-xs font-bold rounded ${solveType === 'irr' ? 'bg-white text-indigo-900' : 'text-indigo-300 hover:text-white'}`}>IRR %</button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-indigo-200 block mb-1">Target Return (%)</label>
                          <div className="relative">
                            <input type="number" value={solveTarget} onChange={(e) => setSolveTarget(parseFloat(e.target.value))} className="w-full bg-indigo-950 border border-indigo-700 rounded-lg py-2 px-3 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                            <span className="absolute right-3 top-2 text-indigo-500 font-bold">%</span>
                          </div>
                        </div>

                        <button onClick={handleSolveRLV} disabled={isSolving} className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider shadow-lg flex justify-center items-center transition-all">
                          {isSolving ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Solving...</> : <><i className="fa-solid fa-calculator mr-2"></i> Solve for Land Value</>}
                        </button>
                      </div>
                    </div>
                  )}
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
               <div className="flex justify-center border-b border-slate-200 pb-1">
                  <nav className="flex space-x-4">
                     <button onClick={() => setReportSubTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'pnl' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Profit & Loss</button>
                     <button onClick={() => setReportSubTab('cashflow')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'cashflow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Detailed Cashflow</button>
                  </nav>
               </div>

               <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {reportSubTab === 'pnl' && <FeasibilityReport scenario={currentScenarioState} siteDNA={site.dna} stats={stats} />}
                  {reportSubTab === 'cashflow' && <ConsolidatedCashflowReport cashflow={cashflow} settings={settings} />}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
