
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
            // Assuming pricePerUnit is Annual Rent if mode is QUANTITY_RATE, or Lump Sum if not.
            // Wait, we need to clarify input. For Hold, usually it's $ per annum or $ per week.
            // Let's assume pricePerUnit is ANNUAL in this grid for clarity.
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
    <div className="bg-slate-50 md:bg-white md:rounded-xl md:shadow-sm md:border border-slate-200 overflow-hidden mb-8 relative flex flex-col h-full">
      
      {/* HEADER */}
      <div className="hidden md:flex bg-slate-50 px-6 py-4 border-b border-slate-200 justify-between items-center shrink-0">
        <div>
          <h3 className="font-bold text-slate-800">{isHold ? 'Rental Mix & Valuation' : 'Sales Mix & Absorption'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{isHold ? 'Define rent roll, lease-up and capitalisation parameters' : 'Define unit pricing, quantity and sales rate (units/mo)'}</p>
        </div>
        <button onClick={addRevenue} className="flex items-center text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors shadow-sm">
            <i className="fa-solid fa-plus mr-1.5"></i> Add Row
        </button>
      </div>

      {/* TABLE */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold sticky top-0 z-10 backdrop-blur-sm">
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
          <tbody className="divide-y divide-slate-100">
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
                     className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${isQtyMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
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
                                className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-blue-500 text-xs font-bold rounded py-1"
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
                           className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-blue-500 text-xs font-bold rounded py-1"
                           placeholder="1"
                         />
                      </td>

                      {/* Offset */}
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.offsetFromCompletion}
                           onChange={(e) => updateRevenue(item.id, 'offsetFromCompletion', parseFloat(e.target.value))}
                           className="w-16 bg-slate-50 text-center border-slate-200 focus:ring-blue-500 text-xs font-bold rounded py-1"
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

      {/* FOOTER: LIVE VALUATION */}
      <div className="bg-slate-900 text-white p-4 shrink-0">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center ${isHold ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                    <i className={`fa-solid ${isHold ? 'fa-building' : 'fa-tags'}`}></i>
                </div>
                <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{isHold ? 'Investment Value' : 'Gross Realisation'}</h4>
                    <p className="text-lg font-black font-mono">
                        ${isHold ? (totals.valuation/1000000).toFixed(2) : (totals.gross/1000000).toFixed(2)}m
                    </p>
                </div>
            </div>

            <div className="flex space-x-8 text-xs">
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

      {/* MOBILE LIST (Fallback) */}
      <div className="md:hidden p-4 space-y-4 pb-24">
         {revenues.filter(r => r.strategy === strategy).map(item => (
             <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                 <div className="flex justify-between items-start mb-2">
                     <input 
                       className="font-bold text-slate-800 border-none p-0 focus:ring-0 w-2/3" 
                       value={item.description} 
                       onChange={e => updateRevenue(item.id, 'description', e.target.value)}
                     />
                     <span className="text-xs font-mono font-bold text-slate-500">
                        ${(item.calcMode === 'QUANTITY_RATE' ? item.units * item.pricePerUnit : item.pricePerUnit).toLocaleString()}
                     </span>
                 </div>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                     <div>
                        <label className="text-slate-400 font-bold uppercase text-[10px]">Amount</label>
                        <input type="number" className="w-full border-slate-200 rounded py-1 px-2" value={item.pricePerUnit} onChange={e => updateRevenue(item.id, 'pricePerUnit', parseFloat(e.target.value))} />
                     </div>
                     {item.calcMode === 'QUANTITY_RATE' && (
                         <div>
                            <label className="text-slate-400 font-bold uppercase text-[10px]">Qty</label>
                            <input type="number" className="w-full border-slate-200 rounded py-1 px-2" value={item.units} onChange={e => updateRevenue(item.id, 'units', parseFloat(e.target.value))} />
                         </div>
                     )}
                 </div>
             </div>
         ))}
         <button onClick={addRevenue} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md">Add Item</button>
      </div>

    </div>
  );
};
