
import React, { useMemo, useState } from 'react';
import { FeasibilitySettings, LineItem, RevenueItem } from './types';
import { SensitivityService, SensitivityCell } from './services/sensitivityService';

interface Props {
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
}

export const SensitivityMatrix: React.FC<Props> = ({ settings, costs, revenues }) => {
  const [metric, setMetric] = useState<'margin' | 'profit'>('margin');

  // Memoize the heavy calculation so it only runs when inputs change
  const steps = [-15, -10, -5, 0, 5, 10, 15];
  const matrix = useMemo(() => {
    return SensitivityService.generateMatrix(settings, costs, revenues, steps);
  }, [settings, costs, revenues]);

  // Helper for Heatmap Colors
  const getCellColor = (val: number) => {
    // Logic for Margin %
    if (metric === 'margin') {
      if (val < 0) return 'bg-red-100 text-red-800 border-red-200';
      if (val < 10) return 'bg-amber-100 text-amber-800 border-amber-200'; // High Risk
      if (val < 15) return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Moderate
      if (val < 20) return 'bg-emerald-100 text-emerald-800 border-emerald-200'; // Good
      return 'bg-emerald-200 text-emerald-900 border-emerald-300'; // Excellent
    } else {
      // Logic for Profit (simple > 0 check mainly)
      if (val < 0) return 'bg-red-100 text-red-800 border-red-200';
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const formatValue = (cell: SensitivityCell) => {
    if (metric === 'margin') {
      return `${cell.margin.toFixed(1)}%`;
    }
    return `$${(cell.profit / 1000000).toFixed(2)}m`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sensitivity Analysis</h3>
          <p className="text-xs text-slate-500">Multivariate risk matrix (Revenue vs. Construction Costs)</p>
        </div>
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

      <div className="relative overflow-x-auto">
        {/* X-Axis Label */}
        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          Gross Realisation (Sales Price) Variance
        </div>

        <div className="flex">
          {/* Y-Axis Label */}
          <div className="flex items-center justify-center w-8 shrink-0">
             <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               Construction Cost Variance
             </div>
          </div>

          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2"></th>
                {steps.map(step => (
                  <th key={step} className={`p-2 font-bold ${step === 0 ? 'text-blue-600 bg-blue-50 rounded-t-lg' : 'text-slate-500'}`}>
                    {step > 0 ? '+' : ''}{step}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rowIndex) => {
                const costVar = steps[rowIndex];
                return (
                  <tr key={costVar}>
                    <td className={`p-2 font-bold ${costVar === 0 ? 'text-blue-600 bg-blue-50 rounded-l-lg' : 'text-slate-500'}`}>
                      {costVar > 0 ? '+' : ''}{costVar}%
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
