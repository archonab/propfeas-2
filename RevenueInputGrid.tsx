
import React, { useState } from 'react';
import { RevenueItem, RevenueStrategy } from './types';

interface Props {
  revenues: RevenueItem[];
  setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
  projectDuration: number;
}

export const RevenueInputGrid: React.FC<Props> = ({ revenues, setRevenues, projectDuration }) => {
  const [globalStrategy, setGlobalStrategy] = useState<RevenueStrategy>('Sell');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const addRevenue = () => {
    const newItem: RevenueItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: 'New Unit Type',
      units: 1,
      strategy: globalStrategy,
      pricePerUnit: 0,
      offsetFromCompletion: 1,
      settlementSpan: 1,
      commissionRate: 2.0,
      isTaxable: true,
      
      // Hold Defaults
      weeklyRent: 500,
      opexRate: 25,
      capRate: 5.0,
      leaseUpDuration: 6
    };
    setRevenues([...revenues, newItem]);
    // Auto-expand on mobile
    if (window.innerWidth < 768) {
        setExpandedRow(newItem.id);
    }
  };

  const updateRevenue = (id: string, field: keyof RevenueItem, value: any) => {
    setRevenues(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRevenue = (id: string) => {
    setRevenues(prev => prev.filter(r => r.id !== id));
  };

  const getEndValue = (item: RevenueItem) => {
    if (item.strategy === 'Sell') return item.units * item.pricePerUnit;
    const grossAnnual = (item.weeklyRent || 0) * 52 * item.units;
    const netAnnual = grossAnnual * (1 - (item.opexRate || 0) / 100);
    const capRate = (item.capRate || 5) / 100;
    return capRate > 0 ? netAnnual / capRate : 0;
  };

  const TimingSparkline = ({ offset, span }: { offset: number, span: number }) => {
    const totalScale = Math.max(offset + span + 2, 12); 
    const offsetPct = (offset / totalScale) * 100;
    const spanPct = (span / totalScale) * 100;

    return (
      <div className="w-16 h-4 bg-slate-100 rounded-sm relative overflow-hidden border border-slate-200" title={`Waits ${offset}mo, then settles over ${span}mo`}>
         <div className="absolute top-1/2 left-0 w-full h-px bg-slate-300"></div>
         <div 
            className="absolute top-1 bottom-1 bg-emerald-400 rounded-sm opacity-90 border-l border-emerald-500"
            style={{ left: `${offsetPct}%`, width: `${Math.max(spanPct, 5)}%` }}
         ></div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 md:bg-white md:rounded-xl md:shadow-sm md:border border-slate-200 overflow-hidden mb-8 relative">
      
      {/* DESKTOP HEADER */}
      <div className="hidden md:flex bg-slate-50 px-6 py-4 border-b border-slate-200 justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800">Revenue & Investment Strategy</h3>
          <p className="text-xs text-slate-500 mt-0.5">Define sales income or rental yields</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
           <button onClick={() => setGlobalStrategy('Sell')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${globalStrategy === 'Sell' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Develop to Sell</button>
           <button onClick={() => setGlobalStrategy('Hold')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${globalStrategy === 'Hold' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Build to Rent (Hold)</button>
        </div>
      </div>

      {/* MOBILE HEADER */}
      <div className="md:hidden px-1 pb-4 flex justify-between items-end">
         <h3 className="font-bold text-slate-800 text-lg">Revenue Assumptions</h3>
         <div className="flex items-center space-x-2">
            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{revenues.length} Items</span>
         </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
              <th className="px-4 py-3 w-48">Description</th>
              <th className="px-4 py-3 w-20 text-center">Units</th>
              <th className="px-4 py-3 w-28">Strategy</th>
              
              {globalStrategy === 'Sell' ? (
                 <>
                    <th className="px-4 py-3 text-right">Price / Unit</th>
                    <th className="px-4 py-3 text-right">Gross Total</th>
                    <th className="px-4 py-3 text-center w-24">Offset (Mo)</th>
                    <th className="px-4 py-3 text-center w-24">Span (Mo)</th>
                    <th className="px-4 py-3 text-center w-20">Exit Rate</th>
                    <th className="px-4 py-3 text-center w-20">Timing</th>
                 </>
              ) : (
                 <>
                    <th className="px-4 py-3 text-right">Weekly Rent</th>
                    <th className="px-4 py-3 text-center">Opex %</th>
                    <th className="px-4 py-3 text-center">Cap Rate %</th>
                    <th className="px-4 py-3 text-right">End Value</th>
                    <th className="px-4 py-3 text-center w-24">Wait (Mo)</th>
                    <th className="px-4 py-3 text-center w-24">Lease Up</th>
                 </>
              )}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {revenues.map((item) => {
              const exitRate = item.settlementSpan > 0 ? (item.units / item.settlementSpan).toFixed(1) : '-';
              
              return (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-2">
                  <input 
                    type="text" 
                    value={item.description}
                    onChange={(e) => updateRevenue(item.id, 'description', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-800"
                    placeholder="e.g. 2 Bed Apartment"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input 
                    type="number" 
                    value={item.units}
                    onChange={(e) => updateRevenue(item.id, 'units', parseFloat(e.target.value))}
                    className="w-16 bg-transparent text-center border-none focus:ring-0 text-xs font-bold bg-slate-100 rounded"
                  />
                </td>
                <td className="px-4 py-2">
                   <select 
                     value={item.strategy}
                     onChange={(e) => updateRevenue(item.id, 'strategy', e.target.value)}
                     className={`w-full text-[10px] font-bold uppercase border-none rounded py-1 pl-2 pr-6 cursor-pointer focus:ring-0 ${item.strategy === 'Sell' ? 'text-blue-600 bg-blue-50' : 'text-indigo-600 bg-indigo-50'}`}
                   >
                      <option value="Sell">Sell</option>
                      <option value="Hold">Hold</option>
                   </select>
                </td>

                {item.strategy === 'Sell' ? (
                   <>
                      <td className="px-4 py-2 text-right">
                         <div className="relative">
                            <span className="absolute left-0 top-1 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={item.pricePerUnit}
                              onChange={(e) => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))}
                              className="w-24 bg-transparent text-right border-none focus:ring-0 text-xs font-mono font-bold"
                            />
                         </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                         <span className="text-xs font-mono font-bold text-slate-500">
                            ${(item.units * item.pricePerUnit).toLocaleString()}
                         </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.offsetFromCompletion}
                           onChange={(e) => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))}
                           className="w-16 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-700 bg-slate-50 rounded"
                           placeholder="0"
                         />
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.settlementSpan}
                           onChange={(e) => updateRevenue(item.id, 'settlementSpan', parseFloat(e.target.value))}
                           className="w-16 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-blue-600 bg-blue-50 rounded"
                           placeholder="1"
                         />
                      </td>
                      <td className="px-4 py-2 text-center">
                         <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{exitRate}/mo</span>
                      </td>
                      <td className="px-4 py-2 text-center flex justify-center">
                         <TimingSparkline offset={item.offsetFromCompletion || 0} span={item.settlementSpan || 1} />
                      </td>
                   </>
                ) : (
                   <>
                      <td className="px-4 py-2 text-right">
                         <div className="relative">
                            <span className="absolute left-0 top-1 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={item.weeklyRent}
                              onChange={(e) => updateRevenue(item.id, 'weeklyRent', parseFloat(e.target.value))}
                              className="w-20 bg-transparent text-right border-none focus:ring-0 text-xs font-mono font-bold"
                            />
                            <span className="text-[9px] text-slate-400 ml-1">/wk</span>
                         </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.opexRate}
                           onChange={(e) => updateRevenue(item.id, 'opexRate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-600"
                         />
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           step="0.1"
                           value={item.capRate}
                           onChange={(e) => updateRevenue(item.id, 'capRate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-indigo-600"
                         />
                      </td>
                      <td className="px-4 py-2 text-right">
                         <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            ${getEndValue(item).toLocaleString(undefined, {maximumFractionDigits: 0})}
                         </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.offsetFromCompletion}
                           onChange={(e) => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-700"
                         />
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.leaseUpDuration}
                           onChange={(e) => updateRevenue(item.id, 'leaseUpDuration', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-700"
                         />
                      </td>
                   </>
                )}

                <td className="px-4 py-2 text-center">
                  <button onClick={() => removeRevenue(item.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <i className="fa-solid fa-times"></i>
                  </button>
                </td>
              </tr>
            )})}
            
            <tr>
               <td colSpan={10} className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <button onClick={addRevenue} className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-700">
                     <i className="fa-solid fa-plus-circle mr-2"></i> Add Revenue Item
                  </button>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-3 pb-24">
        {revenues.map((item) => {
           const isHold = item.strategy === 'Hold';
           const borderColor = isHold ? 'border-indigo-200' : 'border-blue-200';
           
           return (
            <div key={item.id} className={`bg-white rounded-xl shadow-sm border ${borderColor} overflow-hidden`}>
              <div 
                className="p-4 flex flex-col gap-3"
                onClick={(e) => {
                   if ((e.target as HTMLElement).tagName === 'INPUT') return;
                   toggleExpanded(item.id);
                }}
              >
                 <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                        <input 
                           type="text" 
                           value={item.description}
                           onChange={(e) => updateRevenue(item.id, 'description', e.target.value)}
                           className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-base font-bold text-slate-800 placeholder:text-slate-300"
                           placeholder="Description..."
                        />
                        <div className="flex items-center mt-2">
                           <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${isHold ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                              {item.strategy}
                           </span>
                           <span className="text-[10px] text-slate-400 font-bold ml-2 flex items-center">
                              <span className="mr-1">Qty:</span>
                              <input 
                                 type="number" 
                                 value={item.units}
                                 onChange={(e) => updateRevenue(item.id, 'units', parseFloat(e.target.value))}
                                 className="w-10 bg-slate-100 rounded px-1 py-0.5 text-center text-slate-800 border-none focus:ring-1 focus:ring-blue-500"
                              />
                           </span>
                        </div>
                    </div>
                    <div className="text-right">
                       <div className="flex flex-col items-end">
                          <span className="text-base font-black text-slate-800 font-mono">
                             {isHold ? `$${(item.weeklyRent || 0).toLocaleString()}` : `$${((item.pricePerUnit * item.units)/1e6).toFixed(2)}m`}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                             {isHold ? '/ week' : 'Gross Sales'}
                          </span>
                       </div>
                       <button onClick={() => toggleExpanded(item.id)} className="text-slate-400 p-1 mt-1">
                          <i className={`fa-solid fa-chevron-down transition-transform ${expandedRow === item.id ? 'rotate-180 text-blue-500' : ''}`}></i>
                       </button>
                    </div>
                 </div>
              </div>

              {expandedRow === item.id && (
                 <div className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="border-t border-slate-100 pt-4 grid grid-cols-1 gap-4">
                       <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Strategy</label>
                          <div className="flex mt-1">
                             <button onClick={() => updateRevenue(item.id, 'strategy', 'Sell')} className={`flex-1 py-2 text-xs font-bold rounded-l-lg border border-r-0 ${!isHold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>Sell</button>
                             <button onClick={() => updateRevenue(item.id, 'strategy', 'Hold')} className={`flex-1 py-2 text-xs font-bold rounded-r-lg border border-l-0 ${isHold ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Hold</button>
                          </div>
                       </div>

                       {!isHold ? (
                          <>
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase">Price / Unit ($)</label>
                                   <input type="number" value={item.pricePerUnit} onChange={(e) => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" />
                                </div>
                                <div>
                                   <label className="text-[10px] font-bold text-slate-400 uppercase">Agent Fee (%)</label>
                                   <input type="number" value={item.commissionRate} onChange={(e) => updateRevenue(item.id, 'commissionRate', parseFloat(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" />
                                </div>
                             </div>
                             
                             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center">
                                   <i className="fa-solid fa-clock mr-2"></i> Timing & Absorption
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                                           <span>First Settlement</span>
                                           <span className="text-slate-300">(Offset)</span>
                                        </label>
                                        <div className="flex items-center">
                                           <span className="bg-white border border-r-0 border-slate-200 px-3 py-2 rounded-l text-xs font-bold text-slate-500">Wait</span>
                                           <input type="number" value={item.offsetFromCompletion} onChange={(e) => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))} className="w-full border-slate-200 rounded-r text-sm font-bold text-slate-800 py-2 focus:ring-blue-500 focus:border-blue-500" />
                                           <span className="ml-2 text-xs font-bold text-slate-400">mths</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                                           <span>Inventory Clear</span>
                                           <span className="text-slate-300">(Span)</span>
                                        </label>
                                        <div className="flex items-center">
                                           <span className="bg-white border border-r-0 border-slate-200 px-3 py-2 rounded-l text-xs font-bold text-blue-600">Span</span>
                                           <input type="number" value={item.settlementSpan} onChange={(e) => updateRevenue(item.id, 'settlementSpan', parseFloat(e.target.value))} className="w-full border-slate-200 rounded-r text-sm font-bold text-blue-600 py-2 focus:ring-blue-500 focus:border-blue-500" />
                                           <span className="ml-2 text-xs font-bold text-slate-400">mths</span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                          </>
                       ) : (
                          <>
                             <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Weekly Rent ($)</label><input type="number" value={item.weeklyRent} onChange={(e) => updateRevenue(item.id, 'weeklyRent', parseFloat(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Opex Rate (%)</label><input type="number" value={item.opexRate} onChange={(e) => updateRevenue(item.id, 'opexRate', parseFloat(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-slate-800 py-2" /></div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Cap Rate (%)</label><input type="number" step="0.1" value={item.capRate} onChange={(e) => updateRevenue(item.id, 'capRate', parseFloat(e.target.value))} className="w-full mt-1 bg-white border-slate-200 rounded text-base font-bold text-indigo-600 py-2" /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase">End Value (Est)</label><div className="w-full mt-1 bg-indigo-50 border border-indigo-100 rounded flex items-center px-3 py-2 text-sm font-bold text-indigo-700">${(getEndValue(item)/1e6).toFixed(2)}m</div></div>
                             </div>
                          </>
                       )}
                       <button onClick={() => removeRevenue(item.id)} className="w-full py-3 mt-2 bg-red-50 text-red-600 font-bold rounded-lg text-sm flex items-center justify-center hover:bg-red-100 transition-colors"><i className="fa-solid fa-trash-can mr-2"></i> Remove Item</button>
                    </div>
                 </div>
              )}
            </div>
           );
        })}
      </div>

       {/* MOBILE STICKY ADD */}
       <div className="md:hidden fixed bottom-6 right-6 z-50">
         <button onClick={addRevenue} className="w-14 h-14 bg-blue-600 rounded-full shadow-xl shadow-blue-600/30 text-white flex items-center justify-center active:scale-90 transition-transform">
            <i className="fa-solid fa-plus text-xl"></i>
         </button>
      </div>
    </div>
  );
};
