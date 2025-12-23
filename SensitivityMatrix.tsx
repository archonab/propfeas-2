
import React, { useMemo, useState, useEffect } from 'react';
import { LineItem, RevenueItem, SensitivityVariable } from './types';
import { Site, FeasibilitySettings } from './types-v2';
import { SensitivityService, SensitivityCell } from './services/sensitivityService';

interface Props {
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
  site: Site;
}

export const SensitivityMatrix: React.FC<Props> = ({ settings, costs, revenues, site }) => {
  const [metric, setMetric] = useState<'margin' | 'profit'>('margin');
  
  // Flexible Axes
  const [xAxis, setXAxis] = useState<SensitivityVariable>('revenue');
  const [yAxis, setYAxis] = useState<SensitivityVariable>('cost');
  
  // Data State
  const [matrix, setMatrix] = useState<SensitivityCell[][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Determine Steps based on variable type
  const getSteps = (type: SensitivityVariable) => {
    switch (type) {
        case 'revenue':
        case 'cost':
            return [-15, -10, -5, 0, 5, 10, 15]; // Percentages
        case 'duration':
            return [0, 3, 6, 9, 12, 18, 24]; // Months Delay
        case 'interest':
            return [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]; // Absolute Increase %
        default:
            return [-10, -5, 0, 5, 10];
    }
  };

  const stepsX = useMemo(() => getSteps(xAxis), [xAxis]);
  const stepsY = useMemo(() => getSteps(yAxis), [yAxis]);

  // Async Calculation Effect
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // Debounce slightly to prevent rapid flickering on quick inputs
    const timer = setTimeout(() => {
        SensitivityService.generateMatrix(
            settings, 
            costs, 
            revenues, 
            xAxis, 
            yAxis, 
            stepsX, 
            stepsY, 
            site,
            { runInWorker: true } // Offload to worker
        ).then(result => {
            if (isMounted) {
                setMatrix(result);
                setIsLoading(false);
            }
        });
    }, 300);

    return () => {
        isMounted = false;
        clearTimeout(timer);
    };
  }, [settings, costs, revenues, xAxis, yAxis, site, stepsX, stepsY]);

  // Helper for Heatmap Colors
  const getCellColor = (val: number) => {
    if (metric === 'margin') {
      if (val < 0) return 'bg-red-100 text-red-800 border-red-200';
      if (val < 10) return 'bg-amber-100 text-amber-800 border-amber-200';
      if (val < 15) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      if (val < 20) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      return 'bg-emerald-200 text-emerald-900 border-emerald-300';
    } else {
      if (val < 0) return 'bg-red-100 text-red-800 border-red-200';
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const formatValue = (cell: SensitivityCell) => {
    if (metric === 'margin') {
      return `${cell.margin.toFixed(1)}%`;
    }
    return `$${(cell.profit / 1000000).toFixed(1)}m`;
  };

  const formatHeader = (val: number, type: SensitivityVariable) => {
    if (type === 'duration') return val === 0 ? 'Base' : `+${val}m`;
    if (type === 'interest') return val === 0 ? 'Base' : `+${val.toFixed(1)}%`;
    return val > 0 ? `+${val}%` : `${val}%`;
  };

  const getAxisLabel = (type: SensitivityVariable) => {
      switch(type) {
          case 'revenue': return 'Gross Revenue Variance';
          case 'cost': return 'Construction Cost Variance';
          case 'duration': return 'Project Delay (Months)';
          case 'interest': return 'Interest Rate Increase';
      }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
      
      {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="bg-white border border-slate-200 shadow-xl rounded-lg px-4 py-2 flex items-center text-xs font-bold text-slate-600">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-600"></i> Calculating...
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sensitivity Analysis</h3>
          <p className="text-xs text-slate-500">Multi-variable stress testing & risk matrix.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            {/* View Metric Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setMetric('margin')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${metric === 'margin' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
              >
                Margin %
              </button>
              <button
                onClick={() => setMetric('profit')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${metric === 'profit' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
              >
                Profit $
              </button>
            </div>
        </div>
      </div>

      {/* Scenario Configuration Bar */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
         <div className="flex-1">
             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">X-Axis Variable</label>
             <select 
               value={xAxis}
               onChange={(e) => setXAxis(e.target.value as SensitivityVariable)}
               className="w-full text-xs font-bold text-slate-700 border-slate-300 rounded-md focus:ring-blue-500"
             >
                 <option value="revenue">Sales Revenue (Price)</option>
                 <option value="cost">Construction Cost</option>
                 <option value="duration">Project Duration</option>
                 <option value="interest">Interest Rate</option>
             </select>
         </div>
         <div className="flex items-center justify-center pt-4 text-slate-300">
             <i className="fa-solid fa-xmark"></i>
         </div>
         <div className="flex-1">
             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Y-Axis Variable</label>
             <select 
               value={yAxis}
               onChange={(e) => setYAxis(e.target.value as SensitivityVariable)}
               className="w-full text-xs font-bold text-slate-700 border-slate-300 rounded-md focus:ring-blue-500"
             >
                 <option value="revenue">Sales Revenue (Price)</option>
                 <option value="cost">Construction Cost</option>
                 <option value="duration">Project Duration</option>
                 <option value="interest">Interest Rate</option>
             </select>
         </div>
      </div>

      <div className="relative overflow-x-auto">
        {/* X-Axis Label */}
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          {getAxisLabel(xAxis)}
        </div>

        <div className="flex">
          {/* Y-Axis Label */}
          <div className="flex items-center justify-center w-8 shrink-0">
             <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               {getAxisLabel(yAxis)}
             </div>
          </div>

          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2"></th>
                {stepsX.map(step => (
                  <th key={step} className={`p-2 font-bold ${step === 0 ? 'text-blue-600 bg-blue-50 rounded-t-lg' : 'text-slate-500'}`}>
                    {formatHeader(step, xAxis)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rowIndex) => {
                const yVal = stepsY[rowIndex];
                const isBaseline = yVal === 0;
                
                return (
                  <tr key={yVal}>
                    <td className={`p-2 font-bold whitespace-nowrap ${isBaseline ? 'text-blue-600 bg-blue-50 rounded-l-lg' : 'text-slate-500'}`}>
                      {formatHeader(yVal, yAxis)}
                    </td>
                    {row.map((cell) => (
                      <td key={cell.xVar} className="p-1">
                        <div className={`w-full h-full py-2.5 rounded border ${getCellColor(metric === 'margin' ? cell.margin : cell.profit)} transition-all hover:scale-105 cursor-default font-bold`}>
                          {formatValue(cell)}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Key / Legend */}
        <div className="flex justify-end mt-4 space-x-4">
           <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
              <span className="text-[9px] text-slate-500">Loss</span>
           </div>
           <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div>
              <span className="text-[9px] text-slate-500">High Risk (&lt;10%)</span>
           </div>
           <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div>
              <span className="text-[9px] text-slate-500">Feasible (&gt;20%)</span>
           </div>
        </div>
      </div>
    </div>
  );
};
