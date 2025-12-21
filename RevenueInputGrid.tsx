
import React, { useState } from 'react';
import { RevenueItem, RevenueStrategy } from './types';

interface Props {
  revenues: RevenueItem[];
  setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
  projectDuration: number;
}

export const RevenueInputGrid: React.FC<Props> = ({ revenues, setRevenues, projectDuration }) => {
  const [globalStrategy, setGlobalStrategy] = useState<RevenueStrategy>('Sell');

  const addRevenue = () => {
    const newItem: RevenueItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: 'New Unit Type',
      units: 1,
      strategy: globalStrategy,
      pricePerUnit: 0,
      exchangeDate: 0,
      settlementDate: projectDuration, // Default to end
      commissionRate: 2.0,
      isTaxable: true,
      
      // Hold Defaults
      weeklyRent: 500,
      opexRate: 25,
      capRate: 5.0,
      leaseUpDuration: 6
    };
    setRevenues([...revenues, newItem]);
  };

  const updateRevenue = (id: string, field: keyof RevenueItem, value: any) => {
    setRevenues(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRevenue = (id: string) => {
    setRevenues(prev => prev.filter(r => r.id !== id));
  };

  // Helper to estimate End Value for Hold items
  const getEndValue = (item: RevenueItem) => {
    if (item.strategy === 'Sell') return item.units * item.pricePerUnit;
    
    // Hold: Net Annual Rent / Cap Rate
    const grossAnnual = (item.weeklyRent || 0) * 52 * item.units;
    const netAnnual = grossAnnual * (1 - (item.opexRate || 0) / 100);
    const capRate = (item.capRate || 5) / 100;
    return capRate > 0 ? netAnnual / capRate : 0;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800">Revenue & Investment Strategy</h3>
          <p className="text-xs text-slate-500 mt-0.5">Define sales income or rental yields</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
           <button 
             onClick={() => setGlobalStrategy('Sell')}
             className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${globalStrategy === 'Sell' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
           >
             Develop to Sell
           </button>
           <button 
             onClick={() => setGlobalStrategy('Hold')}
             className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${globalStrategy === 'Hold' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
           >
             Build to Rent (Hold)
           </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
              <th className="px-4 py-3 w-48">Description</th>
              <th className="px-4 py-3 w-20 text-center">Units</th>
              <th className="px-4 py-3 w-28">Strategy</th>
              
              {/* Dynamic Columns based on Global Toggle (Mainly for headers, rows will switch individually) */}
              {globalStrategy === 'Sell' ? (
                 <>
                    <th className="px-4 py-3 text-right">Sale Price / Unit</th>
                    <th className="px-4 py-3 text-right">Total Gross</th>
                    <th className="px-4 py-3 text-center">Agent Fee %</th>
                    <th className="px-4 py-3 text-center">Settlement Mo.</th>
                 </>
              ) : (
                 <>
                    <th className="px-4 py-3 text-right">Weekly Rent</th>
                    <th className="px-4 py-3 text-center">Opex %</th>
                    <th className="px-4 py-3 text-center">Cap Rate %</th>
                    <th className="px-4 py-3 text-right">Deemed End Value</th>
                 </>
              )}
              
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {revenues.map((item) => (
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

                {/* Conditional Inputs based on Item Strategy */}
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
                           value={item.commissionRate}
                           onChange={(e) => updateRevenue(item.id, 'commissionRate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs"
                         />
                      </td>
                      <td className="px-4 py-2 text-center">
                         <input 
                           type="number" 
                           value={item.settlementDate}
                           onChange={(e) => updateRevenue(item.id, 'settlementDate', parseFloat(e.target.value))}
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs font-bold text-blue-600"
                         />
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
                           className="w-12 bg-transparent text-center border-none focus:ring-0 text-xs"
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
                   </>
                )}

                <td className="px-4 py-2 text-center">
                  <button 
                    onClick={() => removeRevenue(item.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </td>
              </tr>
            ))}
            
            {/* Add Button Row */}
            <tr>
               <td colSpan={8} className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <button 
                    onClick={addRevenue}
                    className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                     <i className="fa-solid fa-plus-circle mr-2"></i> Add Revenue Item
                  </button>
               </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
