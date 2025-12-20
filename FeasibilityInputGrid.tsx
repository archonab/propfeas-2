
import React from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings } from './types';

interface Props {
  costs: LineItem[];
  settings: FeasibilitySettings;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
}

export const FeasibilityInputGrid: React.FC<Props> = ({ costs, settings, onUpdate, onAdd, onRemove, constructionTotal }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800">Assumption Worksheet</h3>
          <p className="text-xs text-slate-500 mt-0.5">Define cost centers and distribution profiles</p>
        </div>
        <button 
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
        >
          <i className="fa-solid fa-plus mr-2"></i>Add Line Item
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
              <th className="px-4 py-3 w-20">Code</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Input Type</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-center">Start Mo.</th>
              <th className="px-4 py-3 text-center">Duration</th>
              <th className="px-4 py-3">Distribution</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costs.map((item) => {
              const isOverProject = (item.startDate + item.span) > settings.durationMonths;
              const isCalculated = item.inputType === InputType.PCT_CONSTRUCTION || item.inputType === InputType.PCT_REVENUE;

              return (
                <tr key={item.id} className={`group transition-colors ${isOverProject ? 'bg-red-50/50' : 'hover:bg-blue-50/30'}`}>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      value={item.code} 
                      onChange={e => onUpdate(item.id, 'code', e.target.value)}
                      className="w-full bg-transparent mono text-xs border-none focus:ring-0 text-slate-400"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      value={item.category}
                      onChange={e => onUpdate(item.id, 'category', e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs font-semibold text-slate-700 w-full cursor-pointer"
                    >
                      {Object.values(CostCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      value={item.description} 
                      onChange={e => onUpdate(item.id, 'description', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-800"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      value={item.inputType}
                      onChange={e => onUpdate(item.id, 'inputType', e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs text-blue-600 font-medium cursor-pointer"
                    >
                      {Object.values(InputType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end">
                      <input 
                        type="number" 
                        value={item.amount} 
                        onChange={e => onUpdate(item.id, 'amount', parseFloat(e.target.value))}
                        className={`w-24 bg-transparent text-right mono text-xs font-bold border-none focus:ring-0 ${isCalculated ? 'text-indigo-600' : 'text-slate-900'}`}
                      />
                      {item.inputType === InputType.PCT_CONSTRUCTION && (
                        <span className="text-[9px] text-slate-400">Yield: ${(constructionTotal * (item.amount/100)).toLocaleString()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input 
                      type="number" 
                      value={item.startDate} 
                      onChange={e => onUpdate(item.id, 'startDate', parseInt(e.target.value))}
                      className={`w-12 bg-transparent text-center mono text-xs border-none focus:ring-0 ${isOverProject ? 'text-red-600 font-bold' : ''}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input 
                      type="number" 
                      value={item.span} 
                      onChange={e => onUpdate(item.id, 'span', parseInt(e.target.value))}
                      className={`w-12 bg-transparent text-center mono text-xs border-none focus:ring-0 ${isOverProject ? 'text-red-600 font-bold' : ''}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      value={item.method}
                      onChange={e => onUpdate(item.id, 'method', e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      {Object.values(DistributionMethod).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button 
                      onClick={() => onRemove(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {costs.some(i => (i.startDate + i.span) > settings.durationMonths) && (
        <div className="bg-red-50 px-6 py-2 border-t border-red-100 flex items-center space-x-2">
          <i className="fa-solid fa-circle-exclamation text-red-500 text-xs"></i>
          <span className="text-[10px] text-red-600 font-bold uppercase tracking-tight">Validation Error: Some items exceed Project Duration ({settings.durationMonths} months)</span>
        </div>
      )}
    </div>
  );
};
