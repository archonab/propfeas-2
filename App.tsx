
import React, { useState, useMemo } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus } from './types';
import { FinanceEngine } from './services/financeEngine';
import { BudgetService } from './services/budgetService';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { FeasibilityReport } from './FeasibilityReport';
import { VictorianInputs } from './VictorianInputs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string }> = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-6 py-3 border-b-2 transition-all duration-200 ${
      active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`}
  >
    <i className={`${String(icon || '')} mr-2`}></i>
    <span className="font-semibold">{String(label || '')}</span>
  </button>
);

const KPICard: React.FC<{ title: string; value: string; subValue?: string; color: string; icon?: string }> = ({ title, value, subValue, color, icon }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
    {icon && <i className={`${String(icon || '')} absolute -right-2 -bottom-2 text-4xl opacity-5 group-hover:opacity-10 transition-opacity`}></i>}
    <span className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-widest">{String(title || '')}</span>
    <span className={`text-2xl font-bold ${String(color || '')}`}>{String(value || '')}</span>
    {subValue && <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{String(subValue || '')}</span>}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [settings, setSettings] = useState<FeasibilitySettings>(INITIAL_SETTINGS);
  const [costs, setCosts] = useState<LineItem[]>(INITIAL_COSTS);
  const [revenues, setRevenues] = useState<RevenueItem[]>(INITIAL_REVENUE);
  const [isPromoting, setIsPromoting] = useState(false);

  const isLocked = settings.status === ScenarioStatus.LOCKED || settings.status === ScenarioStatus.PROMOTED;

  const cashflow = useMemo(() => FinanceEngine.calculateMonthlyCashflow(settings, costs, revenues), [settings, costs, revenues]);

  const stats = useMemo(() => {
    const netFlows = cashflow.map(f => f.net);
    const totalOut = cashflow.reduce((acc, curr) => acc + curr.outflow, 0);
    const totalIn = cashflow.reduce((acc, curr) => acc + curr.inflow, 0);
    const peakDebt = Math.max(...cashflow.map(f => f.debtBalance));
    const totalEquity = cashflow.reduce((acc, curr) => acc + curr.equityOutflow, 0);
    const profit = totalIn - totalOut;
    const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
    const irr = FinanceEngine.calculateIRR(netFlows);
    const npv = FinanceEngine.calculateNPV(netFlows, settings.discountRate);
    const interestTotal = cashflow.reduce((acc, curr) => acc + curr.interest, 0);

    const constructionTotal = costs
      .filter(c => c.category === CostCategory.CONSTRUCTION)
      .reduce((acc, c) => acc + c.amount, 0);

    const landTotal = costs
      .filter(c => c.category === CostCategory.LAND)
      .reduce((acc, c) => acc + c.amount, 0);

    return { profit, margin, irr, npv, totalOut, totalIn, constructionTotal, landTotal, interestTotal, peakDebt, totalEquity };
  }, [cashflow, costs, settings.discountRate]);

  const handleUpdateCost = (id: string, field: keyof LineItem, value: any) => {
    if (isLocked) return;
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSyncStatutory = (statItems: LineItem[]) => {
    if (isLocked) return;
    setCosts(prev => {
      const filtered = prev.filter(c => !String(c.id).startsWith('VIC-'));
      return [...filtered, ...statItems];
    });
  };

  const handleAddCost = () => {
    if (isLocked) return;
    const newItem: LineItem = {
      id: Date.now().toString(),
      code: `C${(costs.length + 1).toString().padStart(3, '0')}`,
      category: CostCategory.CONSTRUCTION,
      description: 'New Cost Item',
      inputType: InputType.FIXED,
      amount: 0,
      startDate: 0,
      span: 12,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      isTaxable: true
    };
    setCosts([...costs, newItem]);
  };

  const handleRemoveCost = (id: string) => {
    if (isLocked) return;
    setCosts(costs.filter(c => c.id !== id));
  };

  const onPromoteToLive = async () => {
    if (confirm("Promoting this scenario will lock all assumptions as a Baseline. Proceed?")) {
      setIsPromoting(true);
      try {
        await BudgetService.promoteFeasibilityToBudget(
          "SCENARIO-001",
          settings,
          costs,
          stats.constructionTotal,
          stats.totalIn
        );
        setSettings({ ...settings, status: ScenarioStatus.PROMOTED });
        alert("Scenario Promoted!");
      } catch (e) {
        alert("Promotion failed.");
      } finally {
        setIsPromoting(false);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl transition-colors ${isLocked ? 'bg-slate-700' : 'bg-blue-600'}`}>
              <i className={`fa-solid ${isLocked ? 'fa-lock' : 'fa-building-columns'}`}></i>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-800 leading-none tracking-tight">DevFeas Pro</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isLocked ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
                  {String(settings.status || '')}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Advanced DCF Engine • {String(settings.projectName || 'Unnamed Project')}</p>
            </div>
          </div>
          <div className="flex space-x-3">
             <div className="px-4 py-2 bg-slate-100 rounded-lg flex flex-col justify-center border border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Project IRR</span>
                <span className="text-sm font-bold text-blue-600 mono">{Number(stats.irr || 0).toFixed(2)}%</span>
             </div>
             {!isLocked ? (
               <button 
                onClick={onPromoteToLive}
                disabled={isPromoting}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all shadow-md flex items-center disabled:opacity-50"
               >
                  {isPromoting ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-bolt mr-2"></i>}
                  Promote to Live
               </button>
             ) : (
               <button className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-lg flex items-center">
                  <i className="fa-solid fa-file-invoice-dollar mr-2"></i>View Project Budget
               </button>
             )}
          </div>
        </div>
        
        <nav className="max-w-[1600px] mx-auto px-6 flex overflow-x-auto no-print">
          <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Dashboard" icon="fa-solid fa-chart-line" />
          <TabButton active={activeTab === 'inputs'} onClick={() => setActiveTab('inputs')} label="Inputs & Finance" icon="fa-solid fa-calculator" />
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')} label="Cash Flow" icon="fa-solid fa-table-columns" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} label="Reports" icon="fa-solid fa-file-pdf" />
        </nav>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto px-6 py-8 w-full print:p-0 print:max-w-none">
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-in fade-in duration-500 no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <KPICard title="Net Profit" value={`$${Number(stats.profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="After Finance & GST" color="text-emerald-600" icon="fa-solid fa-sack-dollar" />
              <KPICard title="Peak Debt" value={`$${Number(stats.peakDebt || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="Max Bank Exposure" color="text-red-600" icon="fa-solid fa-building-circle-arrow-right" />
              <KPICard title="Equity Invested" value={`$${Number(stats.totalEquity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="Capital Required" color="text-indigo-600" icon="fa-solid fa-piggy-bank" />
              <KPICard title="Project IRR" value={`${Number(stats.irr || 0).toFixed(2)}%`} subValue="Internal Rate of Return" color="text-blue-600" icon="fa-solid fa-percent" />
              <KPICard title="Land Residual" value={`$${Number(stats.npv * 0.95 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="Net Present Value" color="text-slate-900" icon="fa-solid fa-map-location-dot" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Funding Profile: Debt vs Equity Exposure</h3>
                  <div className="flex space-x-4 text-[10px] font-bold uppercase">
                    <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span> Debt</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-indigo-500 rounded-full mr-1"></span> Equity Outflow</div>
                  </div>
                </div>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashflow}>
                      <defs>
                        <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(Number(v)/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="debtBalance" stroke="#ef4444" fillOpacity={1} fill="url(#colorDebt)" strokeWidth={2} />
                      <Line type="monotone" dataKey="equityOutflow" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Advanced Parameters</h3>
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-600">GST Margin Scheme</span>
                        <button 
                          onClick={() => !isLocked && setSettings({...settings, useMarginScheme: !settings.useMarginScheme})}
                          className={`w-10 h-5 rounded-full transition-colors relative ${settings.useMarginScheme ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.useMarginScheme ? 'left-6' : 'left-1'}`}></div>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">GST calculated on Margin (Sell - Buy) rather than full value.</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-600 block mb-3">Land Acquisition Funding</span>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="range" min="0" max="100" 
                          value={Number(settings.landLVR || 0)} 
                          onChange={e => !isLocked && setSettings({...settings, landLVR: parseInt(e.target.value)})}
                          className="flex-1 accent-blue-600"
                        />
                        <span className="mono text-xs font-bold w-12 text-blue-600">{Number(settings.landLVR || 0)}% LVR</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                       <div className="flex justify-between text-xs font-bold mb-2">
                          <span className="text-slate-600">Peak Debt Interest</span>
                          <span className="text-red-600 mono">${Number(stats.interestTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                       </div>
                       <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${stats.profit !== 0 ? (Number(stats.interestTotal || 0) / Math.abs(Number(stats.profit || 1)) * 100) : 0}%` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300 no-print">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-6">
                   <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Project Duration</label>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            disabled={isLocked}
                            value={Number(settings.durationMonths || 0)}
                            onChange={e => setSettings({...settings, durationMonths: parseInt(e.target.value)})}
                            className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-16 disabled:text-slate-500"
                          />
                          <span className="text-xs text-slate-400 font-bold uppercase">Months</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Finance Rate</label>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" step="0.1"
                            disabled={isLocked}
                            value={Number(settings.interestRate || 0)}
                            onChange={e => setSettings({...settings, interestRate: parseFloat(e.target.value)})}
                            className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-16 disabled:text-slate-500"
                          />
                          <span className="text-xs text-slate-400 font-bold uppercase">% p.a.</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Land LVR</label>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number"
                            disabled={isLocked}
                            value={Number(settings.landLVR || 0)}
                            onChange={e => setSettings({...settings, landLVR: parseInt(e.target.value)})}
                            className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-16 disabled:text-slate-500"
                          />
                          <span className="text-xs text-slate-400 font-bold uppercase">% Funding</span>
                        </div>
                      </div>
                   </div>
                   
                   <FeasibilityInputGrid 
                     costs={costs} 
                     settings={settings}
                     constructionTotal={stats.constructionTotal}
                     onUpdate={handleUpdateCost}
                     onAdd={handleAddCost}
                     onRemove={handleRemoveCost}
                   />
                </div>
                <div className="lg:col-span-1">
                   <VictorianInputs 
                     landValue={stats.landTotal}
                     developmentCost={stats.constructionTotal}
                     onSync={handleSyncStatutory}
                     isLocked={isLocked}
                   />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 no-print">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white text-sm uppercase tracking-widest">Monthly Cashflow Forecast (Debt/Equity Bifurcation)</h3>
              <div className="text-[10px] font-bold text-blue-400 uppercase">Capitalised Monthly Compound Mode</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 w-40 border-r border-slate-200">Month</th>
                    {cashflow.map(f => <th key={String(f.month || 0)} className="px-4 py-3 min-w-[90px] text-center">{String(f.label || '')}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 sticky left-0 bg-white font-bold z-10 border-r border-slate-200 group-hover:bg-slate-50">Total Outflow ($)</td>
                    {cashflow.map(f => <td key={String(f.month || 0)} className="px-4 py-3 text-right text-slate-600">{f.outflow > 0 ? f.outflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 sticky left-0 bg-white font-bold z-10 border-r border-slate-200 group-hover:bg-slate-50">Equity Spend ($)</td>
                    {cashflow.map(f => <td key={String(f.month || 0)} className="px-4 py-3 text-right text-indigo-500">{f.equityOutflow > 0 ? f.equityOutflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="bg-slate-50/50 group">
                    <td className="px-4 py-3 sticky left-0 bg-slate-50 font-bold z-10 border-r border-slate-200">Interest Accrued ($)</td>
                    {cashflow.map(f => <td key={String(f.month || 0)} className="px-4 py-3 text-right text-red-500 italic">{f.interest > 0 ? f.interest.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="bg-slate-100 group">
                    <td className="px-4 py-3 sticky left-0 bg-slate-100 font-bold z-10 border-r border-slate-200">Outstanding Debt ($)</td>
                    {cashflow.map(f => <td key={String(f.month || 0)} className="px-4 py-3 text-right font-bold text-red-700">{f.debtBalance > 0 ? f.debtBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="bg-slate-900 text-white font-bold border-t border-slate-700">
                    <td className="px-4 py-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-700 text-[10px]">Net Cash Post-Debt ($)</td>
                    {cashflow.map(f => <td key={String(f.month || 0)} className={`px-4 py-4 text-right ${f.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(f.net || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm no-print">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Financial Feasibility Report</h3>
                <p className="text-sm text-slate-500">Standard DCF Basis for Funding Approval</p>
              </div>
              <button 
                onClick={handlePrint}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center shadow-lg shadow-blue-200"
              >
                <i className="fa-solid fa-print mr-2"></i> Print / Save as PDF
              </button>
            </div>
            
            <div className="pb-20">
              <FeasibilityReport 
                settings={settings} 
                costs={costs} 
                revenues={revenues} 
                stats={stats} 
              />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-white px-8 py-4 sticky bottom-0 z-50 flex justify-between items-center shadow-2xl border-t border-slate-800 no-print">
        <div className="flex space-x-10">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Peak Debt Fac.</span>
            <span className="text-sm font-bold mono text-red-400">${Number(stats.peakDebt || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Margin Scheme</span>
            <span className="text-sm font-bold mono text-blue-400">{settings.useMarginScheme ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Net Profit</span>
            <span className="text-sm font-bold text-emerald-400 mono">${Number(stats.profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-500 uppercase leading-none">Interest Cap.</p>
            <p className="text-xs font-bold text-slate-300">Monthly Compound</p>
          </div>
          <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-tighter ${stats.profit > 0 ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500'}`}>
            {stats.profit > 0 ? 'Project Viable' : 'Sub-Hurdle Profit'}
          </div>
        </div>
      </footer>
    </div>
  );
}
