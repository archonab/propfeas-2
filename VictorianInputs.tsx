
import React, { useMemo } from 'react';
import { CostCategory, DistributionMethod, InputType, LineItem } from './types';

interface Props {
  landValue: number;
  developmentCost: number;
  onSync: (statItems: LineItem[]) => void;
  isLocked: boolean;
}

export const VictorianInputs: React.FC<Props> = ({ landValue, developmentCost, onSync, isLocked }) => {
  const calculations = useMemo(() => {
    // 1. VIC Stamp Duty (Standard Investment/Commercial Rates)
    let stampDuty = 0;
    if (landValue > 960000) {
      stampDuty = landValue * 0.055; // Flat rate for premium properties
    } else if (landValue > 480000) {
      stampDuty = 20370 + (landValue - 480000) * 0.06;
    } else if (landValue > 130000) {
      stampDuty = 2870 + (landValue - 130000) * 0.05;
    } else if (landValue > 25000) {
      stampDuty = 350 + (landValue - 25000) * 0.024;
    } else {
      stampDuty = landValue * 0.014;
    }

    // 2. Public Open Space (POS) - Default 5%
    const posContribution = landValue * 0.05;

    // 3. Metropolitan Planning Levy (MPL)
    // Applies to projects > $1.2M development cost
    const mplThreshold = 1200000;
    const mplRate = 0.0013; // $1.30 per $1,000
    const mpl = developmentCost > mplThreshold ? developmentCost * mplRate : 0;

    return { stampDuty, posContribution, mpl };
  }, [landValue, developmentCost]);

  const handleSync = () => {
    const items: LineItem[] = [
      {
        id: 'VIC-SD',
        code: 'STAT-01',
        category: CostCategory.STATUTORY,
        description: 'VIC Stamp Duty (Land Transfer)',
        inputType: InputType.FIXED,
        amount: Math.round(calculations.stampDuty),
        startDate: 0,
        span: 1,
        method: DistributionMethod.UPFRONT,
        escalationRate: 0,
        isTaxable: false
      },
      {
        id: 'VIC-POS',
        code: 'STAT-02',
        category: CostCategory.STATUTORY,
        description: 'Public Open Space (POS) Contrib.',
        inputType: InputType.FIXED,
        amount: Math.round(calculations.posContribution),
        startDate: 0,
        span: 1,
        method: DistributionMethod.UPFRONT,
        escalationRate: 0,
        isTaxable: false
      },
      {
        id: 'VIC-MPL',
        code: 'STAT-03',
        category: CostCategory.STATUTORY,
        description: 'Metropolitan Planning Levy (MPL)',
        inputType: InputType.FIXED,
        amount: Math.round(calculations.mpl),
        startDate: 0,
        span: 1,
        method: DistributionMethod.UPFRONT,
        escalationRate: 0,
        isTaxable: false
      }
    ];
    onSync(items);
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
            <i className="fa-solid fa-map-location-dot"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Victorian Statutory Calculator</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase">VIC SRO & Planning Compliance</p>
          </div>
        </div>
        {!isLocked && (
          <button 
            onClick={handleSync}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase transition-all flex items-center"
          >
            <i className="fa-solid fa-rotate mr-2"></i>Sync to Cashflow
          </button>
        )}
      </div>
      
      <div className="p-6 grid grid-cols-3 gap-6">
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase block">VIC Stamp Duty</span>
          <div className="text-lg font-bold mono text-emerald-400">
            ${calculations.stampDuty.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] text-slate-600 italic">Tiered Land Transfer Duty</p>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase block">POS Contribution (5%)</span>
          <div className="text-lg font-bold mono text-blue-400">
            ${calculations.posContribution.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] text-slate-600 italic">Based on Site Value</p>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase block">Metro Planning Levy (MPL)</span>
          <div className="text-lg font-bold mono text-indigo-400">
            ${calculations.mpl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] text-slate-600 italic">Dev Cost Threshold $1.2M+</p>
        </div>
      </div>

      <div className="bg-slate-950 px-6 py-2 flex justify-between items-center">
        <span className="text-[9px] font-bold text-slate-500 uppercase">Total Victorian Stat. Costs</span>
        <span className="text-xs font-bold mono text-white">
          ${(calculations.stampDuty + calculations.posContribution + calculations.mpl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
};
