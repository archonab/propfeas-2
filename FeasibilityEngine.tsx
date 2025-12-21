
import React, { useState, useMemo } from 'react';
import { INITIAL_COSTS, INITIAL_REVENUE, INITIAL_SETTINGS } from './constants';
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType, ScenarioStatus } from './types';
import { FinanceEngine } from './services/financeEngine';
import { FeasibilityInputGrid } from './FeasibilityInputGrid';
import { FeasibilityReport } from './FeasibilityReport';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line } from 'recharts';

interface Props {
  projectName: string;
  isEditable?: boolean;
  onPromote?: () => void;
}

export const FeasibilityEngine: React.FC<Props> = ({ projectName, isEditable = true, onPromote }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [settings, setSettings] = useState<FeasibilitySettings>({ ...INITIAL_SETTINGS, projectName });
  const [costs, setCosts] = useState<LineItem[]>(INITIAL_COSTS);
  const [revenues, setRevenues] = useState<RevenueItem[]>(INITIAL_REVENUE);

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

    return { profit, margin, irr, npv, totalOut, totalIn, constructionTotal, interestTotal, peakDebt, totalEquity };
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
      isTaxable: true
    };
    setCosts([...costs, newItem]);
  };

  const handleRemoveCost = (id: string) => {
    if (!isEditable) return;
    setCosts(costs.filter(c => c.id !== id));
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center no-print">
        <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          {['summary', 'inputs', 'reports'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
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
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
               <div className="grid grid-cols-4 gap-4">
                  <KPITile label="Profit" val={`$${(stats.profit/1e6).toFixed(1)}M`} color="text-emerald-600" />
                  <KPITile label="Margin" val={`${stats.margin.toFixed(1)}%`} color="text-blue-600" />
                  <KPITile label="IRR" val={`${stats.irr.toFixed(1)}%`} color="text-indigo-600" />
                  <KPITile label="Residual" val={`$${(stats.npv/1e6).toFixed(1)}M`} color="text-slate-900" />
               </div>
               <div className="bg-white p-6 rounded-xl border border-slate-200 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashflow}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${(v/1e3).toFixed(0)}k`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="debtBalance" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Model Controls</h3>
               <div className="space-y-4">
                  <ControlItem label="Project Duration" val={`${settings.durationMonths} Mo.`} />
                  <ControlItem label="Interest Rate" val={`${settings.interestRate}%`} />
                  <ControlItem label="Land LVR" val={`${settings.landLVR}%`} />
                  {isEditable && (
                    <p className="text-[10px] text-slate-400 italic">Adjust settings in the 'Inputs' tab to update the DCF model.</p>
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <FeasibilityInputGrid 
            costs={costs} 
            settings={settings} 
            constructionTotal={stats.constructionTotal} 
            onUpdate={handleUpdateCost} 
            onAdd={handleAddCost} 
            onRemove={handleRemoveCost} 
          />
        )}

        {activeTab === 'reports' && (
          <FeasibilityReport settings={settings} costs={costs} revenues={revenues} stats={stats} />
        )}
      </div>
    </div>
  );
};

const KPITile = ({ label, val, color }: { label: string, val: string, color: string }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200">
    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</span>
    <span className={`text-xl font-black ${color}`}>{val}</span>
  </div>
);

const ControlItem = ({ label, val }: { label: string, val: string }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="font-bold text-slate-900 mono">{val}</span>
  </div>
);
