
import React, { useState, useMemo } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus } from './types';
import { FinanceEngine } from './services/financeEngine';
import { BudgetService } from './services/budgetService';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { FeasibilityReportPDF } from './FeasibilityReportPDF';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string }> = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-6 py-3 border-b-2 transition-all duration-200 ${
      active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`}
  >
    <i className={`${icon} mr-2`}></i>
    <span className="font-semibold">{label}</span>
  </button>
);

const KPICard: React.FC<{ title: string; value: string; subValue?: string; color: string }> = ({ title, value, subValue, color }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
    <span className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</span>
    <span className={`text-2xl font-bold ${color}`}>{value}</span>
    {subValue && <span className="text-xs text-slate-400 mt-1">{subValue}</span>}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [settings, setSettings] = useState<FeasibilitySettings>({ ...INITIAL_SETTINGS, status: ScenarioStatus.DRAFT });
  const [costs, setCosts] = useState<LineItem[]>(INITIAL_COSTS);
  const [revenues, setRevenues] = useState<RevenueItem[]>(INITIAL_REVENUE);
  const [isPromoting, setIsPromoting] = useState(false);

  const isLocked = settings.status === ScenarioStatus.LOCKED || settings.status === ScenarioStatus.PROMOTED;

  const cashflow = useMemo(() => FinanceEngine.calculateMonthlyCashflow(settings, costs, revenues), [settings, costs, revenues]);

  const stats = useMemo(() => {
    const netFlows = cashflow.map(f => f.net);
    const totalOut = cashflow.reduce((acc, curr) => acc + curr.outflow, 0);
    const totalIn = cashflow.reduce((acc, curr) => acc + curr.inflow, 0);
    const profit = totalIn - totalOut;
    const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
    const irr = FinanceEngine.calculateIRR(netFlows);
    const npv = FinanceEngine.calculateNPV(netFlows, settings.discountRate);
    const interestTotal = cashflow.reduce((acc, curr) => acc + curr.interest, 0);

    const constructionTotal = costs
      .filter(c => c.category === CostCategory.CONSTRUCTION)
      .reduce((acc, c) => acc + c.amount, 0);

    return { profit, margin, irr, npv, totalOut, totalIn, constructionTotal, interestTotal };
  }, [cashflow, costs, settings.discountRate]);

  const handleUpdateCost = (id: string, field: keyof LineItem, value: any) => {
    if (isLocked) return;
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
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
        const budget = await BudgetService.promoteFeasibilityToBudget(
          "SCENARIO-001",
          settings,
          costs,
          stats.constructionTotal,
          stats.totalIn
        );
        console.log("Budget Created Successfully:", budget);
        setSettings({ ...settings, status: ScenarioStatus.PROMOTED });
        alert("Scenario Promoted! Project Budget is now active and assumptions are locked.");
      } catch (e) {
        alert("Promotion failed. Check console for details.");
      } finally {
        setIsPromoting(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl transition-colors ${isLocked ? 'bg-slate-700' : 'bg-blue-600'}`}>
              <i className={`fa-solid ${isLocked ? 'fa-lock' : 'fa-building-columns'}`}></i>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-800 leading-none tracking-tight">DevFeas Pro</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isLocked ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
                  {settings.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Argus Engine v2.5 • {settings.projectName}</p>
            </div>
          </div>
          <div className="flex space-x-3">
             <div className="px-4 py-2 bg-slate-100 rounded-lg flex flex-col justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Project IRR</span>
                <span className="text-sm font-bold text-blue-600 mono">{stats.irr.toFixed(2)}%</span>
             </div>
             {!isLocked ? (
               <button 
                onClick={onPromoteToLive}
                disabled={isPromoting}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all shadow-md flex items-center disabled:opacity-50"
               >
                  {isPromoting ? (
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fa-solid fa-bolt mr-2"></i>
                  )}
                  Promote to Live
               </button>
             ) : (
               <button className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-lg flex items-center">
                  <i className="fa-solid fa-file-invoice-dollar mr-2"></i>View Project Budget
               </button>
             )}
          </div>
        </div>
        
        <nav className="max-w-[1600px] mx-auto px-6 flex overflow-x-auto">
          <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Summary" icon="fa-solid fa-chart-pie" />
          <TabButton active={activeTab === 'inputs'} onClick={() => setActiveTab('inputs')} label="Cost Worksheet" icon="fa-solid fa-list-check" />
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')} label="Cash Flow" icon="fa-solid fa-money-bill-transfer" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} label="Reports" icon="fa-solid fa-file-pdf" />
        </nav>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto px-6 py-8 w-full">
        {isLocked && activeTab === 'inputs' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center text-amber-800 space-x-3">
            <i className="fa-solid fa-circle-info text-xl"></i>
            <div>
              <p className="font-bold text-sm">Baseline Locked</p>
              <p className="text-xs">This feasibility has been promoted to a live budget. Assumptions are now read-only to maintain the audit trail.</p>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard title="Project Profit" value={`$${stats.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="Net of All Costs" color="text-emerald-600" />
              <KPICard title="Development Margin" value={`${stats.margin.toFixed(2)}%`} subValue="Return on Cost" color="text-blue-600" />
              <KPICard title="Target Yield" value={`${stats.irr.toFixed(2)}%`} subValue="Project IRR" color="text-indigo-600" />
              <KPICard title="Residual Value" value={`$${(stats.npv * 0.95).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue="Land Value Projection" color="text-slate-900" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Cumulative Debt vs Equity</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashflow}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Line type="stepAfter" dataKey="cumulative" stroke={isLocked ? "#475569" : "#2563eb"} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Cost Breakdown</h3>
                 <div className="space-y-4">
                    {Object.values(CostCategory).map(cat => {
                      const amount = costs.filter(c => c.category === cat).reduce((acc, curr) => acc + FinanceEngine.calculateLineItemTotal(curr, settings, stats.constructionTotal, stats.totalIn), 0);
                      if (amount === 0) return null;
                      const pct = (amount / stats.totalOut) * 100;
                      return (
                        <div key={cat} className="group cursor-default">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold text-slate-600">{cat}</span>
                            <span className="mono font-bold">${amount.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${isLocked ? 'bg-slate-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
             <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Global Duration</label>
                   <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      disabled={isLocked}
                      value={settings.durationMonths}
                      onChange={e => setSettings({...settings, durationMonths: parseInt(e.target.value)})}
                      className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-16 disabled:text-slate-500"
                    />
                    <span className="text-xs text-slate-400 font-bold uppercase">Months</span>
                   </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Finance Int. Rate</label>
                   <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      step="0.1"
                      disabled={isLocked}
                      value={settings.interestRate}
                      onChange={e => setSettings({...settings, interestRate: parseFloat(e.target.value)})}
                      className="text-lg font-bold mono bg-transparent border-none focus:ring-0 p-0 w-16 disabled:text-slate-500"
                    />
                    <span className="text-xs text-slate-400 font-bold uppercase">% p.a.</span>
                   </div>
                </div>
             </div>
             
             <div className={isLocked ? 'opacity-80 pointer-events-none' : ''}>
               <FeasibilityInputGrid 
                 costs={costs} 
                 settings={settings}
                 constructionTotal={stats.constructionTotal}
                 onUpdate={handleUpdateCost}
                 onAdd={handleAddCost}
                 onRemove={handleRemoveCost}
               />
             </div>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-white text-sm uppercase tracking-widest">Monthly Cashflow Forecast</h3>
              <div className="text-[10px] font-bold text-blue-400 uppercase">Precise DCF Calculation Mode</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 w-40 border-r border-slate-200">Month</th>
                    {cashflow.map(f => <th key={f.month} className="px-4 py-3 min-w-[90px] text-center">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 sticky left-0 bg-white font-bold z-10 border-r border-slate-200 group-hover:bg-slate-50">Outflow ($)</td>
                    {cashflow.map(f => <td key={f.month} className="px-4 py-3 text-right text-red-500">{f.outflow > 0 ? f.outflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 sticky left-0 bg-white font-bold z-10 border-r border-slate-200 group-hover:bg-slate-50">Inflow ($)</td>
                    {cashflow.map(f => <td key={f.month} className="px-4 py-3 text-right text-emerald-600">{f.inflow > 0 ? f.inflow.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                    <td className="px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Finance Int. ($)</td>
                    {cashflow.map(f => <td key={f.month} className="px-4 py-3 text-right text-indigo-500 italic">{f.interest > 0 ? f.interest.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>)}
                  </tr>
                  <tr className="bg-slate-900 text-white font-bold border-t border-slate-700">
                    <td className="px-4 py-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-700">Project Net ($)</td>
                    {cashflow.map(f => <td key={f.month} className={`px-4 py-4 text-right ${f.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{f.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex flex-col space-y-6 h-full min-h-[600px] animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Standard Feasibility Report</h3>
                <p className="text-sm text-slate-500">Categorised Profit & Loss Baseline Summary</p>
              </div>
              <PDFDownloadLink 
                document={<FeasibilityReportPDF settings={settings} costs={costs} revenues={revenues} stats={stats} />} 
                fileName={`${settings.projectName.replace(/\s+/g, '_')}_Report.pdf`}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center shadow-lg shadow-blue-200"
              >
                {({ loading }) => (
                  <>
                    <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`}></i>
                    {loading ? 'Compiling PDF...' : 'Download PDF Report'}
                  </>
                )}
              </PDFDownloadLink>
            </div>
            
            <div className="flex-1 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-inner h-[800px]">
              <PDFViewer width="100%" height="100%" showToolbar={false} className="border-none">
                <FeasibilityReportPDF settings={settings} costs={costs} revenues={revenues} stats={stats} />
              </PDFViewer>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-white px-8 py-4 sticky bottom-0 z-50 flex justify-between items-center shadow-2xl border-t border-slate-800">
        <div className="flex space-x-10">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Gross Realisation</span>
            <span className="text-sm font-bold mono text-emerald-400">${stats.totalIn.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Dev. Margin (TDC)</span>
            <span className="text-sm font-bold mono text-blue-400">{stats.margin.toFixed(2)}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 mb-0.5 tracking-widest">Residual Land Value</span>
            <span className="text-sm font-bold text-indigo-300 mono">${(stats.npv * 0.9).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-500 uppercase leading-none">Monthly Interest Compounding</p>
            <p className="text-xs font-bold text-slate-300">Enabled (7.5% Base)</p>
          </div>
          <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-tighter ${stats.profit > 0 ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500'}`}>
            {isLocked ? 'Baseline Frozen' : (stats.profit > 0 ? 'Project Viable' : 'Margin Below Hurdle')}
          </div>
        </div>
      </footer>
    </div>
  );
}
