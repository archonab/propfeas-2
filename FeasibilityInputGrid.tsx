
import React, { useState } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem, FeasibilitySettings, GstTreatment } from './types';
import { PhasingChart } from './PhasingChart';

interface Props {
  costs: LineItem[];
  settings: FeasibilitySettings;
  onUpdate: (id: string, field: keyof LineItem, value: any) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  constructionTotal: number;
}

export const FeasibilityInputGrid: React.FC<Props> = ({ costs, settings, onUpdate, onAdd, onRemove, constructionTotal }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Approximate total revenue from settings (needed for chart scaling if % Rev used)
  const estimatedRevenue = 10000000; 

  const toggleExpanded = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleMilestoneChange = (id: string, value: string) => {
    // Parse format: "1:10, 6:40, 12:50" -> {1: 10, 6: 40, 12: 50}
    try {
      const milestoneMap: Record<number, number> = {};
      const parts = value.split(',');
      parts.forEach(part => {
        const [mo, pct] = part.split(':').map(s => parseFloat(s.trim()));
        if (!isNaN(mo) && !isNaN(pct)) {
          milestoneMap[mo] = pct;
        }
      });
      onUpdate(id, 'milestones', milestoneMap);
    } catch (e) {
      // Ignore parse errors while typing
    }
  };

  const getMilestoneString = (milestones?: Record<number, number>) => {
    if (!milestones) return '';
    return Object.entries(milestones)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  };

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
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 w-20">Code</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Input Type</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-center">Start Mo.</th>
              <th className="px-4 py-3 text-center">Duration</th>
              <th className="px-4 py-3">GST Code</th>
              <th className="px-4 py-3">Distribution</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costs.map((item) => {
              const isOverProject = (item.startDate + item.span) > settings.durationMonths;
              const isCalculated = item.inputType === InputType.PCT_CONSTRUCTION || item.inputType === InputType.PCT_REVENUE || item.inputType === InputType.RATE_PER_SQM;
              
              return (
                <React.Fragment key={item.id}>
                  <tr className={`group transition-colors ${isOverProject ? 'bg-red-50/50' : 'hover:bg-blue-50/30'} ${expandedRow === item.id ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-2 text-center">
                      <button 
                        onClick={() => toggleExpanded(item.id)}
                        className={`text-slate-400 hover:text-blue-600 transition-colors ${expandedRow === item.id ? 'text-blue-600 rotate-90' : ''}`}
                      >
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                      </button>
                    </td>
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
                        {/* Dynamic Yield Badges */}
                        {item.inputType === InputType.PCT_CONSTRUCTION && (
                          <span className="text-[9px] text-slate-400">Yield: ${(constructionTotal * (item.amount/100)).toLocaleString()}</span>
                        )}
                        {item.inputType === InputType.RATE_PER_SQM && (
                          <span className="text-[9px] text-blue-500 bg-blue-50 px-1.5 rounded font-bold">Based on {settings.site.landArea.toLocaleString()} sqm</span>
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
                        <div className="relative">
                            <select 
                                value={item.gstTreatment}
                                onChange={e => onUpdate(item.id, 'gstTreatment', e.target.value)}
                                className={`
                                    bg-transparent border-none focus:ring-0 text-[10px] font-bold cursor-pointer w-full pr-4 uppercase tracking-tighter
                                    ${item.gstTreatment === GstTreatment.TAXABLE ? 'text-blue-600' : ''}
                                    ${item.gstTreatment === GstTreatment.GST_FREE ? 'text-emerald-600' : ''}
                                    ${item.gstTreatment === GstTreatment.INPUT_TAXED ? 'text-amber-600' : ''}
                                    ${item.gstTreatment === GstTreatment.MARGIN_SCHEME ? 'text-purple-600' : ''}
                                `}
                            >
                                <option value={GstTreatment.TAXABLE}>Taxable (10%)</option>
                                <option value={GstTreatment.GST_FREE}>GST Free (0%)</option>
                                <option value={GstTreatment.INPUT_TAXED}>Input Taxed</option>
                                <option value={GstTreatment.MARGIN_SCHEME}>Margin Scheme</option>
                            </select>
                            {/* Visual Indicator Overlay */}
                            {item.gstTreatment === GstTreatment.MARGIN_SCHEME && (
                                <span className="absolute -top-3 -right-2 bg-purple-100 text-purple-700 px-1 rounded text-[8px] font-black border border-purple-200">MS</span>
                            )}
                        </div>
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
                  
                  {/* Advanced Configuration & Chart Row */}
                  {expandedRow === item.id && (
                     <tr className="bg-slate-50 border-b border-slate-100 shadow-inner">
                        <td colSpan={11} className="px-4 py-4">
                           <div className="flex gap-8 animate-in slide-in-from-top-2 duration-200">
                              
                              {/* Left: Settings Controls */}
                              <div className="flex-1 space-y-6">
                                  <div className="flex items-center space-x-2">
                                     <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                       <i className="fa-solid fa-sliders"></i>
                                     </div>
                                     <h4 className="text-xs font-bold text-slate-700 uppercase">Advanced Distribution</h4>
                                  </div>

                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-bold uppercase text-slate-500">Compounding Escalation</label>
                                       <div className="flex items-center bg-white border border-slate-200 rounded px-2 w-32 shadow-sm">
                                          <input 
                                             type="number" 
                                             value={item.escalationRate || 0}
                                             onChange={(e) => onUpdate(item.id, 'escalationRate', parseFloat(e.target.value))}
                                             className="w-full text-xs font-bold border-none focus:ring-0 p-1.5"
                                          />
                                          <span className="text-xs text-slate-400 font-bold px-1">%</span>
                                       </div>
                                       <p className="text-[9px] text-slate-400">Applies annually, compounded monthly.</p>
                                    </div>
                                    
                                    {item.method === DistributionMethod.S_CURVE && (
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-bold uppercase text-slate-500">S-Curve Steepness (k)</label>
                                          <div className="flex items-center space-x-3">
                                            <input 
                                               type="range" 
                                               min="5" max="20" step="1"
                                               value={item.sCurveSteepness || 10}
                                               onChange={(e) => onUpdate(item.id, 'sCurveSteepness', parseFloat(e.target.value))}
                                               className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <span className="text-xs font-bold w-6 text-right text-slate-700">{item.sCurveSteepness || 10}</span>
                                          </div>
                                       </div>
                                    )}

                                    {item.method === DistributionMethod.MILESTONE && (
                                       <div className="col-span-2 space-y-2">
                                          <label className="text-[10px] font-bold uppercase text-slate-500">Milestone Profile</label>
                                          <input 
                                             type="text" 
                                             placeholder="Format: Mo:%, Mo:% (e.g., 1:10, 6:40, 12:50)"
                                             defaultValue={getMilestoneString(item.milestones)}
                                             onBlur={(e) => handleMilestoneChange(item.id, e.target.value)}
                                             className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs mono focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm"
                                          />
                                          <p className="text-[9px] text-slate-400">Comma-separated Month:Percent pairs. Month is relative to start.</p>
                                       </div>
                                    )}
                                  </div>
                              </div>

                              {/* Right: Phasing Chart */}
                              <div className="w-[400px]">
                                 <PhasingChart 
                                    item={item} 
                                    settings={settings} 
                                    constructionTotal={constructionTotal} 
                                    totalRevenue={estimatedRevenue}
                                 />
                              </div>

                           </div>
                        </td>
                     </tr>
                  )}
                </React.Fragment>
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
