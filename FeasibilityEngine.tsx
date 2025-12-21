
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus, GstTreatment, SiteLead } from './types';
import { FinanceEngine } from './services/financeEngine';
import { SolverService } from './services/solverService';
import { SensitivityMatrix } from './SensitivityMatrix';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { RevenueInputGrid } from './RevenueInputGrid';
import { FeasibilityReport } from './FeasibilityReport';
import { ConsolidatedCashflowReport } from './ConsolidatedCashflowReport';
import { FinanceSettings } from './FinanceSettings';
import { SiteSetup } from './SiteSetup';
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
  site: SiteLead; // Now accepts full site object for DNA Sidebar
  isEditable?: boolean;
  onPromote?: () => void;
  onChange?: (settings: FeasibilitySettings) => void;
}

export const FeasibilityEngine: React.FC<Props> = ({ site, isEditable = true, onPromote, onChange }) => {
  // Default to 'summary' if acquired, otherwise 'site'
  const [activeTab, setActiveTab] = useState(site.status === 'Acquired' ? 'summary' : 'site');
  const [reportSubTab, setReportSubTab] = useState<'pnl' | 'cashflow'>('pnl');

  const [settings, setSettings] = useState<FeasibilitySettings>({ 
    ...INITIAL_SETTINGS, 
    projectName: site.name,
    site: site.dna // Sync DNA from parent site
  });
  const [costs, setCosts] = useState<LineItem[]>(INITIAL_COSTS);
  const [revenues, setRevenues] = useState<RevenueItem[]>(INITIAL_REVENUE);
  
  // Mobile UI State
  const [showMobileDNA, setShowMobileDNA] = useState(false);
  
  // Solver State
  const [solveTarget, setSolveTarget] = useState<number>(20);
  const [solveType, setSolveType] = useState<'margin' | 'irr'>('margin');
  const [isSolving, setIsSolving] = useState(false);

  // Sync internal state changes to parent (if onChange provided)
  useEffect(() => {
    if (onChange) {
      onChange(settings);
    }
  }, [settings, onChange]);

  const cashflow = useMemo(() => FinanceEngine.calculateMonthlyCashflow(settings, costs, revenues), [settings, costs, revenues]);

  const stats = useMemo(() => {
    // 1. Basic Profit Metrics
    const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
    const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue + curr.lendingInterestIncome, 0);
    const profit = totalIn - totalOut;
    const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
    
    // 2. IRR on Equity (Net Cashflow relative to developer)
    const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
    const irr = FinanceEngine.calculateIRR(equityFlows);
    const npv = FinanceEngine.calculateNPV(equityFlows, settings.discountRate);

    // 3. Peak Debt & Covenants
    const peakSenior = Math.max(...cashflow.map(f => f.balanceSenior));
    const peakMezz = Math.max(...cashflow.map(f => f.balanceMezz));
    const peakTotalDebt = Math.max(...cashflow.map(f => f.balanceSenior + f.balanceMezz));
    const peakEquity = Math.max(...cashflow.map(f => f.balanceEquity));
    
    // LTC & LVR
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

  // Calculate Total Land Cost for SiteSetup display
  const totalLandCost = useMemo(() => {
    return costs
      .filter(c => c.category === CostCategory.LAND)
      .reduce((acc, c) => acc + c.amount, 0);
  }, [costs]);

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
      // 1. Lock Settings
      setSettings(prev => ({ ...prev, status: ScenarioStatus.LOCKED }));
      
      // 2. Trigger Parent Promotion (Changes Site Status in App)
      if (onPromote) onPromote();

      // 3. Prompt for Next Action
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
          revenues
        );
        
        let newCosts = costs.map(c => {
          if (c.category === CostCategory.LAND) {
            return { ...c, amount: result.landValue };
          }
          return c;
        });

        const dutyIndex = newCosts.findIndex(c => 
          c.category === CostCategory.STATUTORY && 
          (c.description.toLowerCase().includes('duty') || c.description.toLowerCase().includes('stamp'))
        );

        if (dutyIndex !== -1) {
          newCosts[dutyIndex] = { ...newCosts[dutyIndex], amount: result.stampDuty };
        }

        setCosts(newCosts);
        alert(`Solver Successful!\n\nResidual Land Value: $${(result.landValue/1e6).toFixed(2)}M\nStamp Duty Adjusted: $${(result.stampDuty/1e3).toFixed(0)}k`);
      } catch (e: any) {
        alert("Solver Error: " + e.message);
      } finally {
        setIsSolving(false);
      }
    }, 100);
  };

  const navTabs = [
    { id: 'site', label: 'Site Context', icon: 'fa-map-location-dot' },
    { id: 'summary', label: 'Dashboard', icon: 'fa-chart-simple' },
    { id: 'inputs', label: 'Inputs & Assumptions', icon: 'fa-sliders' },
    { id: 'reports', label: 'Formal Reports', icon: 'fa-file-pdf' }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      
      {/* LEFT: Persistent Site DNA Sidebar */}
      {/* Mobile: Collapsible Accordion, Desktop: Sticky Sidebar */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 lg:sticky lg:top-4 overflow-hidden">
           
           {/* Mobile Header Toggle */}
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

           {/* Content */}
           <div className={`px-5 pb-5 space-y-4 lg:space-y-6 lg:block ${showMobileDNA ? 'block' : 'hidden'}`}>
             <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Land Area</label>
                 <div className="text-lg font-black text-slate-800">{settings.site.landArea.toLocaleString()} <span className="text-xs text-slate-400 font-bold">sqm</span></div>
               </div>
               
               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Zoning</label>
                 <div className="text-sm font-bold text-slate-800 leading-tight">{settings.site.zoning || "Pending"}</div>
               </div>

               <div>
                 <label className="text-[10px] font-bold uppercase text-slate-400">Council (LGA)</label>
                 <div className="text-sm font-bold text-slate-800 leading-tight">{settings.site.lga || "Pending"}</div>
               </div>

               <div className="pt-4 border-t border-slate-100 col-span-2 lg:col-span-1">
                 <label className="text-[10px] font-bold uppercase text-slate-400">Feasibility Yield</label>
                 <div className="flex items-center justify-between mt-1">
                   <span className="text-sm font-bold text-slate-700">{settings.totalUnits} Units</span>
                   <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono font-bold text-slate-600">
                     {(settings.site.landArea / (settings.totalUnits || 1)).toFixed(0)}m²/u
                   </span>
                 </div>
               </div>
             </div>

             {/* Acquisition Action Area */}
             {site.status === 'Due Diligence' && isEditable && (
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
          <nav className="grid grid-cols-2 gap-1 sm:flex sm:space-x-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            {navTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 sm:px-4 py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center sm:justify-start space-x-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          
          {/* Status Badge */}
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
          {activeTab === 'site' && (
            <SiteSetup 
              settings={settings} 
              onUpdate={setSettings} 
              landCost={totalLandCost} // Pass derived total land cost
            />
          )}

          {activeTab === 'summary' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header displaying canonical Address */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-200 pb-4 mb-4 gap-2">
                <div>
                    <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight leading-tight">{settings.site.address || "New Site Feasibility"}</h2>
                    <p className="text-sm text-slate-500 font-bold">Scenario: {settings.projectName}</p>
                </div>
                <div className="text-left sm:text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${stats.margin > 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {stats.margin.toFixed(2)}% Margin
                    </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* KPI Grid: 2 cols on mobile, 4 on desktop */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <KPITile label="Net Profit" val={`$${(stats.profit/1e6).toFixed(1)}M`} color="text-emerald-600" />
                      <KPITile label="Equity IRR" val={`${stats.irr.toFixed(1)}%`} color="text-indigo-600" />
                      <KPITile label="LTC" val={`${stats.ltc.toFixed(1)}%`} color={stats.ltc > 85 ? "text-red-600" : "text-slate-700"} />
                      <KPITile label="Peak LVR" val={`${stats.lvr.toFixed(1)}%`} color={stats.lvr > 65 ? "text-amber-600" : "text-slate-700"} />
                  </div>
                  
                  {/* Capital Stack Visualization */}
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

                  {/* RLV Solver Panel */}
                  {isEditable && site.status !== 'Acquired' && (
                    <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg border border-indigo-800 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <i className="fa-solid fa-wand-magic-sparkles text-6xl"></i>
                      </div>
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4 relative z-10">Residual Land Value Solver</h3>
                      
                      <div className="space-y-4 relative z-10">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-indigo-200 block mb-1">Target Metric</label>
                          <div className="flex bg-indigo-800/50 p-1 rounded-lg">
                              <button 
                                onClick={() => setSolveType('margin')}
                                className={`flex-1 py-1 text-xs font-bold rounded ${solveType === 'margin' ? 'bg-white text-indigo-900' : 'text-indigo-300 hover:text-white'}`}
                              >
                                Margin %
                              </button>
                              <button 
                                onClick={() => setSolveType('irr')}
                                className={`flex-1 py-1 text-xs font-bold rounded ${solveType === 'irr' ? 'bg-white text-indigo-900' : 'text-indigo-300 hover:text-white'}`}
                              >
                                IRR %
                              </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-indigo-200 block mb-1">Target Return (%)</label>
                          <div className="relative">
                            <input 
                                type="number" 
                                value={solveTarget}
                                onChange={(e) => setSolveTarget(parseFloat(e.target.value))}
                                className="w-full bg-indigo-950 border border-indigo-700 rounded-lg py-2 px-3 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                            <span className="absolute right-3 top-2 text-indigo-500 font-bold">%</span>
                          </div>
                        </div>

                        <button 
                          onClick={handleSolveRLV}
                          disabled={isSolving}
                          className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider shadow-lg flex justify-center items-center transition-all"
                        >
                          {isSolving ? (
                            <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Solving...</>
                          ) : (
                            <><i className="fa-solid fa-calculator mr-2"></i> Solve for Land Value</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sensitivity Matrix */}
              <SensitivityMatrix settings={settings} costs={costs} revenues={revenues} />
            </div>
          )}

          {activeTab === 'inputs' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <FinanceSettings settings={settings} onUpdate={setSettings} peakEquityRequired={stats.peakEquity} />
              
              {/* Added Revenue Grid above Cost Grid */}
              <RevenueInputGrid 
                revenues={revenues} 
                setRevenues={setRevenues} 
                projectDuration={settings.durationMonths}
              />

              <FeasibilityInputGrid 
                costs={costs} 
                settings={settings} 
                constructionTotal={stats.constructionTotal} 
                onUpdate={handleUpdateCost} 
                onAdd={handleAddCost} 
                onBulkAdd={handleBulkAddCosts}
                onRemove={handleRemoveCost} 
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
               <div className="flex justify-center border-b border-slate-200 pb-1">
                  <nav className="flex space-x-4">
                     <button 
                       onClick={() => setReportSubTab('pnl')}
                       className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'pnl' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                     >
                       Profit & Loss
                     </button>
                     <button 
                       onClick={() => setReportSubTab('cashflow')}
                       className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'cashflow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                     >
                       Detailed Cashflow
                     </button>
                  </nav>
               </div>

               <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {reportSubTab === 'pnl' && (
                    <FeasibilityReport settings={settings} costs={costs} revenues={revenues} stats={stats} />
                  )}
                  {reportSubTab === 'cashflow' && (
                    <ConsolidatedCashflowReport cashflow={cashflow} settings={settings} />
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
