
import React, { useState, useMemo } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus } from './types';
import { FinanceEngine } from './services/financeEngine';
import { BudgetService } from './services/budgetService';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { FeasibilityReport } from './FeasibilityReport';
import { VictorianInputs } from './VictorianInputs';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line } from 'recharts';

interface Props {
  projectName: string;
}

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

export const FeasibilityModule: React.FC<Props> = ({ projectName }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [settings, setSettings] = useState<FeasibilitySettings>({ ...INITIAL_SETTINGS, projectName });
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
    const constructionTotal = costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((acc, c) => acc + c.amount, 0);
    const landTotal = costs.filter(c => c.category === CostCategory.LAND).reduce((acc, c) => acc + c.amount, 0);

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
        await BudgetService.promoteFeasibilityToBudget("SCENARIO-001", settings, costs, stats.constructionTotal, stats.totalIn);
        setSettings({ ...settings, status: ScenarioStatus.PROMOTED });
        alert("Scenario Promoted!");
      } catch (e) { alert("Promotion failed."); } finally { setIsPromoting(false); }
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6 no-print">
        <nav className="flex overflow-x-auto space-x-1">
          <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Dashboard" icon="fa-solid fa-chart-line" />
          <TabButton active={activeTab === 'inputs'} onClick={() => setActiveTab('inputs')} label="Inputs & Finance" icon="fa-solid fa-calculator" />
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')} label="Cash Flow" icon="fa-solid fa-table-columns" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} label="Reports" icon="fa-solid fa-file-pdf" />
        </nav>
        <div className="flex space-x-2">
           {!isLocked && (
             <button onClick={onPromoteToLive} disabled={isPromoting} className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all shadow-md flex items-center disabled:opacity-50">
                {isPromoting ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-bolt mr-2"></i>} Promote to Live
             </button>
           )}
        </div>
      </div>

      <div className="flex-1">
        {activeTab === 'summary' && (
          <div className="space-y-8 no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard title="Net Profit" value={`$${Number(stats.profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-emerald-600" icon="fa-solid fa-sack-dollar" />
              <KPICard title="Peak Debt" value={`$${Number(stats.peakDebt || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-red-600" icon="fa-solid fa-building-circle-arrow-right" />
              <KPICard title="Equity" value={`$${Number(stats.totalEquity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-indigo-600" icon="fa-solid fa-piggy-bank" />
              <KPICard title="IRR" value={`${Number(stats.irr || 0).toFixed(2)}%`} color="text-blue-600" icon="fa-solid fa-percent" />
              <KPICard title="Land Residual" value={`$${Number(stats.npv * 0.95 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-slate-900" icon="fa-solid fa-map-location-dot" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-6">Funding Profile</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashflow}>
                    <defs>
                      <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-6">Parametric Overrides</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-600">GST Margin Scheme</span>
                      <button onClick={() => !isLocked && setSettings({...settings, useMarginScheme: !settings.useMarginScheme})} className={`w-8 h-4 rounded-full transition-colors relative ${settings.useMarginScheme ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.useMarginScheme ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-600 block mb-3">Land LVR</span>
                    <input type="range" min="0" max="100" value={Number(settings.landLVR || 0)} onChange={e => !isLocked && setSettings({...settings, landLVR: parseInt(e.target.value)})} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1 uppercase"><span>0%</span><span>{settings.landLVR}%</span><span>100%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div className="space-y-6 no-print">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200"><label className="text-[10px] font-bold text-slate-400 uppercase block">Duration</label><input type="number" disabled={isLocked} value={settings.durationMonths} onChange={e => setSettings({...settings, durationMonths: parseInt(e.target.value)})} className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-full" /></div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200"><label className="text-[10px] font-bold text-slate-400 uppercase block">Interest Rate</label><input type="number" step="0.1" disabled={isLocked} value={settings.interestRate} onChange={e => setSettings({...settings, interestRate: parseFloat(e.target.value)})} className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-full" /></div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200"><label className="text-[10px] font-bold text-slate-400 uppercase block">Discount Rate</label><input type="number" step="0.1" disabled={isLocked} value={settings.discountRate} onChange={e => setSettings({...settings, discountRate: parseFloat(e.target.value)})} className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-full" /></div>
                </div>
                <FeasibilityInputGrid costs={costs} settings={settings} constructionTotal={stats.constructionTotal} onUpdate={handleUpdateCost} onAdd={handleAddCost} onRemove={handleRemoveCost} />
              </div>
              <div className="lg:col-span-1">
                <VictorianInputs landValue={stats.landTotal} developmentCost={stats.constructionTotal} onSync={handleSyncStatutory} isLocked={isLocked} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden no-print">
             <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] mono">
                <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold"><th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 w-40 border-r">Month</th>{cashflow.map(f => <th key={f.month} className="px-4 py-3 text-center">{f.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 group"><td className="px-4 py-3 sticky left-0 bg-white font-bold z-10 border-r">Outflow ($)</td>{cashflow.map(f => <td key={f.month} className="px-4 py-3 text-right">{f.outflow.toLocaleString()}</td>)}</tr>
                  <tr className="bg-slate-100 group"><td className="px-4 py-3 sticky left-0 bg-slate-100 font-bold z-10 border-r">Debt ($)</td>{cashflow.map(f => <td key={f.month} className="px-4 py-3 text-right text-red-700">{f.debtBalance.toLocaleString()}</td>)}</tr>
                  <tr className="bg-slate-900 text-white font-bold"><td className="px-4 py-4 sticky left-0 bg-slate-900 z-10 border-r">Net ($)</td>{cashflow.map(f => <td key={f.month} className={`px-4 py-4 text-right ${f.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{f.net.toLocaleString()}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex flex-col space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 no-print">
              <div><h3 className="text-lg font-bold text-slate-800">Bank Feasibility Report</h3><p className="text-sm text-slate-500">Standard DCF Basis</p></div>
              <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg"><i className="fa-solid fa-print mr-2"></i> Print / Save as PDF</button>
            </div>
            <FeasibilityReport settings={settings} costs={costs} revenues={revenues} stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
};
