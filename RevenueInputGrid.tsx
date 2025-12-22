
import React, { useMemo, useState } from 'react';
import { RevenueItem, RevenueStrategy, RevenueCalcMode } from './types';
import { HelpTooltip } from './components/HelpTooltip';

interface Props {
  revenues: RevenueItem[];
  setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
  projectDuration: number;
  strategy: RevenueStrategy;
}

export const RevenueInputGrid: React.FC<Props> = ({ revenues, setRevenues, projectDuration, strategy }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const addRevenue = () => {
    const newItem: RevenueItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: strategy === 'Sell' ? 'New Unit Type' : 'New Tenancy',
      strategy: strategy,
      calcMode: 'QUANTITY_RATE',
      
      // Common
      units: 1,
      pricePerUnit: 0,
      offsetFromCompletion: 1,
      settlementSpan: 6, // Legacy prop
      
      // Sell Defaults
      absorptionRate: 1,
      commissionRate: 2.0,
      isTaxable: true,
      
      // Hold Defaults
      weeklyRent: 0, // Legacy support, using pricePerUnit for Annual/Weekly
      opexRate: 25,
      vacancyFactorPct: 5.0,
      leaseUpMonths: 3,
      isCapitalised: true,
      capRate: 5.0
    };
    setRevenues([...revenues, newItem]);
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

  // --- Live Valuation Logic ---
  const totals = useMemo(() => {
    const relevant = revenues.filter(r => r.strategy === strategy);
    
    if (strategy === 'Sell') {
        const gross = relevant.reduce((acc, r) => acc + (r.units * r.pricePerUnit), 0);
        const units = relevant.reduce((acc, r) => acc + r.units, 0);
        const avg = units > 0 ? gross / units : 0;
        return { gross, units, avg };
    } else {
        // Hold Valuation (ISP)
        let potentialGross = 0;
        let effectiveNet = 0;
        let valuation = 0;

        relevant.forEach(r => {
            const multiplier = r.calcMode === 'QUANTITY_RATE' ? r.units : 1;
            const grossItem = r.pricePerUnit * multiplier;
            const netItem = grossItem * (1 - (r.opexRate || 0)/100) * (1 - (r.vacancyFactorPct || 0)/100);
            
            potentialGross += grossItem;
            effectiveNet += netItem;

            if (r.isCapitalised) {
                const cap = r.capRate || 5;
                if (cap > 0) valuation += netItem / (cap/100);
            }
        });
        return { potentialGross, effectiveNet, valuation };
    }
  }, [revenues, strategy]);

  const isHold = strategy === 'Hold';

  return (
    <div className="bg-white md:rounded-xl md:shadow-sm md:border border-slate-200 overflow-hidden mb-8 relative flex flex-col h-full">
      
      {/* HEADER */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 sticky top-14 md:static z-20">
        <div>
          <h3 className="font-bold text-slate-800 text-sm md:text-base">{isHold ? 'Rental Mix & Valuation' : 'Sales Mix & Absorption'}</h3>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">{isHold ? 'Define rent roll, lease-up and capitalisation parameters' : 'Define unit pricing, quantity and sales rate'}</p>
        </div>
        <button onClick={addRevenue} className="flex items-center text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm">
            <i className="fa-solid fa-plus mr-1.5"></i> Add Row
        </button>
      </div>

      {/* TABLE (Desktop) - Hidden on Mobile */}
      <div className="hidden md:block flex-1 overflow-x-auto shadow-inner rounded-xl border border-slate-100 m-4">
        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold sticky top-0 z-10">
              <th className="px-4 py-3 w-48 bg-slate-50">Description</th>
              <th className="px-4 py-3 w-20 text-center bg-slate-50">Mode</th>
              
              {!isHold ? (
                 <>
                    <th className="px-4 py-3 text-center w-20 bg-slate-50">Qty</th>
                    <th className="px-4 py-3 text-right bg-slate-50">Avg Price</th>
                    <th className="px-4 py-3 text-center w-24 bg-slate-50">Rate (U/Mo)</th>
                    <th className="px-4 py-3 text-center w-24 bg-slate-50">Offset (Mo)</th>
                    <th className="px-4 py-3 text-right bg-slate-50">Total Revenue</th>
                 </>
              ) : (
                 <>
                    <th className="px-4 py-3 text-center w-20 bg-slate-50">Units</th>
                    <th className="px-4 py-3 text-right bg-slate-50">Rent (Pa)</th>
                    <th className="px-4 py-3 text-center w-16 bg-slate-50">Opex % <HelpTooltip term="OPEX"/></th>
                    <th className="px-4 py-3 text-center w-16 bg-slate-50">Vac %</th>
                    <th className="px-4 py-3 text-center w-20 bg-slate-50">Lease Up</th>
                    <th className="px-4 py-3 text-center w-16 bg-slate-50">Cap % <HelpTooltip term="CAP_RATE"/></th>
                    <th className="px-4 py-3 text-center w-10 bg-slate-50" title="Capitalised?">Cap?</th>
                 </>
              )}
              <th className="px-4 py-3 w-10 bg-slate-50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {revenues.filter(r => r.strategy === strategy).map((item) => {
              const isQtyMode = item.calcMode === 'QUANTITY_RATE';
              const grossTotal = isQtyMode ? item.units * item.pricePerUnit : item.pricePerUnit;

              return (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                {/* Description */}
                <td className="px-4 py-2">
                  <input 
                    type="text" 
                    value={item.description}
                    onChange={(e) => updateRevenue(item.id, 'description', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 placeholder:text-slate-300"
                    placeholder="Item Name"
                  />
                </td>
                
                {/* Mode Toggle */}
                <td className="px-4 py-2 text-center">
                   <button 
                     onClick={() => updateRevenue(item.id, 'calcMode', isQtyMode ? 'LUMP_SUM' : 'QUANTITY_RATE')}
                     className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${isQtyMode ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                   >
                      {isQtyMode ? 'Rate' : 'Sum'}
                   </button>
                </td>

                {!isHold ? (
                   <>
                      {/* QTY */}
                      <td className="px-4 py-2 text-center">
                        {isQtyMode ? (
                            <input 
                                type="number" 
                                value={item.units}
                                onChange={(e) => updateRevenue(item.id, 'units', parseFloat(e.target.value))}
                                className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-indigo-500 text-xs font-bold rounded py-1"
                            />
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      
                      {/* Price */}
                      <td className="px-4 py-2 text-right">
                         <input 
                           type="number" 
                           value={item.pricePerUnit}
                           onChange={(e) => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))}
                           className="w-24 bg-transparent text-right border-none focus:ring-0 text-xs font-mono font-bold text-slate-700"
                         />
                      </td>

                      {/* Absorption Rate */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.absorptionRate}
                           onChange={(e) => updateRevenue(item.id, 'absorptionRate', parseFloat(e.target.value))}
                           className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-indigo-500 text-xs font-bold rounded py-1"
                           placeholder="1"
                         />
                      </td>

                      {/* Offset */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.offsetFromCompletion}
                           onChange={(e) => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))}
                           className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-indigo-500 text-xs font-bold rounded py-1"
                         />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-2 text-right">
                         <span className="text-xs font-mono font-bold text-slate-800">
                            ${grossTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}
                         </span>
                      </td>
                   </>
                ) : (
                   <>
                      {/* Units */}
                      <td className="px-4 py-2 text-center">
                         {isQtyMode ? (
                            <input 
                                type="number" 
                                value={item.units}
                                onChange={(e) => updateRevenue(item.id, 'units', parseFloat(e.target.value))}
                                className="w-14 bg-slate-50 text-center border-slate-200 focus:ring-indigo-500 text-xs font-bold rounded py-1"
                            />
                         ) : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Rent (Annual) */}
                      <td className="px-4 py-2 text-right">
                         <input 
                           type="number" 
                           value={item.pricePerUnit}
                           onChange={(e) => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))}
                           className="w-24 bg-transparent text-right border-none focus:ring-0 text-xs font-mono font-bold text-slate-700"
                         />
                      </td>

                      {/* Opex */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.opexRate}
                           onChange={(e) => updateRevenue(item.id, 'opexRate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-500"
                         />
                      </td>

                      {/* Vacancy */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.vacancyFactorPct}
                           onChange={(e) => updateRevenue(item.id, 'vacancyFactorPct', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-slate-500"
                         />
                      </td>

                      {/* Lease Up */}
                      <td className="px-4 py-2 text-center">
                         <div className="flex items-center justify-center space-x-1">
                            <input 
                                type="number" 
                                value={item.leaseUpMonths}
                                onChange={(e) => updateRevenue(item.id, 'leaseUpMonths', parseFloat(e.target.value))}
                                className="w-10 bg-slate-50 text-center border-slate-200 text-xs font-bold rounded py-1"
                            />
                            <span className="text-[9px] text-slate-400">mo</span>
                         </div>
                      </td>

                      {/* Cap Rate */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" step="0.1"
                           value={item.capRate}
                           onChange={(e) => updateRevenue(item.id, 'capRate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-indigo-600"
                         />
                      </td>

                      {/* Is Cap? */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="checkbox" 
                           checked={item.isCapitalised}
                           onChange={(e) => updateRevenue(item.id, 'isCapitalised', e.target.checked)}
                           className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
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
          </tbody>
        </table>
      </div>

      {/* MOBILE: CARD STACK (Visible only on <768px) */}
      <div className="md:hidden p-4 space-y-4 pb-24">
         {revenues.filter(r => r.strategy === strategy).map(item => {
             const isQtyMode = item.calcMode === 'QUANTITY_RATE';
             const grossTotal = isQtyMode ? item.units * item.pricePerUnit : item.pricePerUnit;
             const isExpanded = expandedRow === item.id;

             return (
             <div key={item.id} className={`bg-white border transition-all rounded-xl p-4 shadow-sm relative overflow-hidden ${isExpanded ? 'border-indigo-200 ring-1 ring-indigo-50' : 'border-slate-200'}`}>
                 <div className="flex justify-between items-start mb-3" onClick={() => toggleExpanded(item.id)}>
                     <div className="flex-1">
                        <div className="font-bold text-slate-800 text-sm mb-1">{item.description}</div>
                        <p className="text-[10px] text-slate-400 font-medium">
                           {item.calcMode === 'QUANTITY_RATE' ? `${item.units} Units @ $${item.pricePerUnit.toLocaleString()}` : 'Lump Sum Amount'}
                        </p>
                     </div>
                     <div className="text-right">
                        <span className="block text-sm font-mono font-black text-slate-700">
                           ${grossTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </span>
                     </div>
                 </div>
                 
                 {/* Expand/Collapse Toggle */}
                 <button 
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full text-center py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors flex justify-center items-center"
                 >
                    {isExpanded ? 'Hide Details' : 'Edit Details'} 
                    <i className={`fa-solid fa-chevron-down ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                 </button>

                 {/* Collapsible Edit Form */}
                 {isExpanded && (
                    <div className="pt-4 mt-2 border-t border-slate-100 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="col-span-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                           <input 
                              type="text" 
                              value={item.description}
                              onChange={(e) => updateRevenue(item.id, 'description', e.target.value)}
                              className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1"
                           />
                        </div>

                        <div className="col-span-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Calculation Mode</label>
                           <div className="flex bg-slate-100 p-1 rounded mt-1">
                              <button onClick={() => updateRevenue(item.id, 'calcMode', 'QUANTITY_RATE')} className={`flex-1 py-1 rounded text-[10px] font-bold ${item.calcMode === 'QUANTITY_RATE' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Rate x Qty</button>
                              <button onClick={() => updateRevenue(item.id, 'calcMode', 'LUMP_SUM')} className={`flex-1 py-1 rounded text-[10px] font-bold ${item.calcMode === 'LUMP_SUM' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Fixed Sum</button>
                           </div>
                        </div>
                        
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                           <input type="number" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.pricePerUnit} onChange={e => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))} />
                        </div>
                        
                        {item.calcMode === 'QUANTITY_RATE' && (
                            <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase">Quantity</label>
                               <input type="number" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.units} onChange={e => updateRevenue(item.id, 'units', parseFloat(e.target.value))} />
                            </div>
                        )}

                        {!isHold ? (
                           <>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Absorp. Rate</label>
                                 <input type="number" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.absorptionRate} onChange={e => updateRevenue(item.id, 'absorptionRate', parseFloat(e.target.value))} />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Offset (Mo)</label>
                                 <input type="number" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.offsetFromCompletion} onChange={e => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))} />
                              </div>
                           </>
                        ) : (
                           <>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Opex %</label>
                                 <input type="number" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.opexRate} onChange={e => updateRevenue(item.id, 'opexRate', parseFloat(e.target.value))} />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Cap Rate %</label>
                                 <input type="number" step="0.1" className="w-full border-slate-200 rounded py-1.5 px-2 text-sm font-bold mt-1" value={item.capRate} onChange={e => updateRevenue(item.id, 'capRate', parseFloat(e.target.value))} />
                              </div>
                           </>
                        )}

                        <div className="col-span-2 pt-2">
                           <button onClick={() => removeRevenue(item.id)} className="w-full py-2 border border-red-200 text-red-600 rounded font-bold text-xs hover:bg-red-50">
                              Remove Item
                           </button>
                        </div>
                    </div>
                 )}
             </div>
         )})}
      </div>

      {/* FOOTER: LIVE VALUATION */}
      <div className="bg-slate-900 text-white p-4 shrink-0 fixed bottom-14 md:bottom-0 left-0 w-full md:relative z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3 w-full md:w-auto">
                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isHold ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                    <i className={`fa-solid ${isHold ? 'fa-building' : 'fa-tags'}`}></i>
                </div>
                <div className="flex justify-between w-full md:block">
                    <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isHold ? 'Investment Value' : 'Gross Realisation'}</h4>
                        <p className="text-lg font-black font-mono leading-none">
                            ${isHold ? (totals.valuation/1000000).toFixed(2) : (totals.gross/1000000).toFixed(2)}m
                        </p>
                    </div>
                    {/* Mobile Summary Metric */}
                    <div className="md:hidden text-right">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{isHold ? 'NOI' : 'Avg Price'}</div>
                        <div className="text-sm font-mono font-bold">
                            {isHold ? `$${(totals.effectiveNet/1000).toFixed(0)}k` : `$${Math.round(totals.avg/1000)}k`}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Desktop Metrics */}
            <div className="hidden md:flex space-x-8 text-xs">
                {!isHold ? (
                    <>
                        <div className="text-right">
                            <span className="block text-slate-500 font-bold uppercase text-[10px]">Total Units</span>
                            <span className="font-mono font-bold text-slate-200">{totals.units}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-slate-500 font-bold uppercase text-[10px]">Avg Price</span>
                            <span className="font-mono font-bold text-slate-200">${Math.round(totals.avg).toLocaleString()}</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-right">
                            <span className="block text-slate-500 font-bold uppercase text-[10px]">Potential Gross Income</span>
                            <span className="font-mono font-bold text-slate-200">${(totals.potentialGross/1000).toFixed(0)}k</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-slate-500 font-bold uppercase text-[10px]">Net Operating Income</span>
                            <span className="font-mono font-bold text-emerald-400">${(totals.effectiveNet/1000).toFixed(0)}k</span>
                        </div>
                    </>
                )}
            </div>
         </div>
      </div>

    </div>
  );
};
