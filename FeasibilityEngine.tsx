
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus, GstTreatment } from './types';
import { FinanceEngine } from './services/financeEngine';
import { SolverService } from './services/solverService';
import { SensitivityMatrix } from './SensitivityMatrix';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { FeasibilityReport } from './FeasibilityReport';
import { FinanceSettings } from './FinanceSettings';
import { SiteSetup } from './SiteSetup';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';

// Missing components definitions
const KPITile = ({ label, val, color }: { label: string, val: string, color: string }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
     <p className={`text-2xl font-black ${color} tracking-tight`}>{val}</p>
     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

const ControlItem = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center text-xs mb-2 last:mb-0">
     <span className="text-slate-500 font-medium">{label}</span>
     <span className="font-bold text-slate-700">{val}</span>
  </div>
);

interface Props {
  projectName: string;
  isEditable?: boolean;
  onPromote?: () => void;
  onChange?: (settings: FeasibilitySettings) => void;
}

export const FeasibilityEngine: React.FC<Props> = ({ projectName, isEditable = true, onPromote, onChange }) => {
  // Default to 'site' tab for Site-First workflow
  const [activeTab, setActiveTab] = useState('site');
  const [settings, setSettings] = useState<FeasibilitySettings>({ ...INITIAL_SETTINGS, projectName });
  const [costs, setCosts] = useState<LineItem[]>(INITIAL_COSTS);
  const [revenues, setRevenues] = useState<RevenueItem[]>(INITIAL_REVENUE);
  
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
    // Inflow = RepayEquity, Outflow = DrawDownEquity
    const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
    const irr = FinanceEngine.calculateIRR(equityFlows);
    const npv = FinanceEngine.calculateNPV(equityFlows, settings.discountRate);

    // 3. Peak Debt & Covenants
    const peakSenior = Math.max(...cashflow.map(f => f.balanceSenior));
    const peakMezz = Math.max(...cashflow.map(f => f.balanceMezz));
    const peakTotalDebt = Math.max(...cashflow.map(f => f.balanceSenior + f.balanceMezz));
    const peakEquity = Math.max(...cashflow.map(f => f.balanceEquity));
    
    // LTC = Peak Debt / Total Development Cost
    const ltc = totalOut > 0 ? (peakTotalDebt / totalOut) * 100 : 0;
    
    // LVR = Peak Debt / Gross Realisation (Total Revenue)
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

  const handleAddCost = () => {
    if (!isEditable) return;
    const newItem: LineItem = {
      id: Date.now().toString(),
      code: `C${(costs.length + 1).toString().padStart(3, '0')}`,
      category: CostCategory.CONSTRUCTION,
      description: 'New Cost Center',
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

  const handleRemoveCost = (id: string) => {
    if (!isEditable) return;
    setCosts(costs.filter(c => c.id !== id));
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
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center no-print">
        <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 ${
                activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        {isEditable && onPromote && (
          <button 
            onClick={onPromote}
            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-lg flex items-center"
          >
            <i className="fa-solid fa-rocket mr-2"></i> Promote to Portfolio
          </button>
        )}
      </div>

      <div className="flex-1">
        {/* Replaced Project Name header with Site Address display logic in tabs or handled by SiteSetup */}
        
        {activeTab === 'site' && (
           <SiteSetup settings={settings} onUpdate={setSettings} />
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header displaying canonical Address */}
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-4 mb-4">
               <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{settings.site.address || "New Site Feasibility"}</h2>
                  <p className="text-sm text-slate-500 font-bold">{settings.site.zoning || "No Zoning"} • {settings.site.lga || "No Council"} • {settings.site.landArea} sqm</p>
               </div>
               <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${stats.margin > 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                     {stats.margin.toFixed(2)}% Margin
                  </span>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 <div className="grid grid-cols-4 gap-4">
                    <KPITile label="Net Profit" val={`$${(stats.profit/1e6).toFixed(1)}M`} color="text-emerald-600" />
                    <KPITile label="Equity IRR" val={`${stats.irr.toFixed(1)}%`} color="text-indigo-600" />
                    <KPITile label="LTC" val={`${stats.ltc.toFixed(1)}%`} color={stats.ltc > 85 ? "text-red-600" : "text-slate-700"} />
                    <KPITile label="Peak LVR" val={`${stats.lvr.toFixed(1)}%`} color={stats.lvr > 65 ? "text-amber-600" : "text-slate-700"} />
                 </div>
                 
                 {/* Capital Stack Visualization */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 h-[320px]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Capital Stack Utilisation</h3>
                      <div className="flex space-x-3 text-[10px] font-bold">
                         <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-slate-800 mr-1"></div>Senior Debt</span>
                         <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-1"></div>Mezzanine</span>
                         <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>Equity</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashflow} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(v/1e6).toFixed(1)}m`} />
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

              <div className="space-y-6">
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
                            <div className="h-full bg-slate-800" style={{ width: `${(stats.peakSenior / stats.peakTotalDebt) * 100}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Peak Mezz Debt</span>
                            <span className="font-bold">${(stats.peakMezz/1e6).toFixed(2)}M</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${(stats.peakMezz / stats.peakTotalDebt) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>

                {/* RLV Solver Panel */}
                {isEditable && (
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
                      <p className="text-[9px] text-indigo-300 text-center italic">
                        Iteratively solves for max Land Price accounting for Stamp Duty & Finance.
                      </p>
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
             <FeasibilityInputGrid 
               costs={costs} 
               settings={settings} 
               constructionTotal={stats.constructionTotal} 
               onUpdate={handleUpdateCost} 
               onAdd={handleAddCost} 
               onRemove={handleRemoveCost} 
             />
          </div>
        )}

        {activeTab === 'reports' && (
          <FeasibilityReport settings={settings} costs={costs} revenues={revenues} stats={stats} />
        )}
      </div>
    </div>
  );
};
