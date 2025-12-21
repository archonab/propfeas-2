import React from 'react';
import { FeasibilityEngine } from './FeasibilityEngine';
import { SiteLead } from './types';

interface Props {
  site: SiteLead;
}

export const FeasibilityModule: React.FC<Props> = ({ site }) => {
  const activeScenario = site.scenarios.find(s => s.isBaseline) || site.scenarios[0];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">Feasibility Analysis</h2>
        <p className="text-sm text-slate-500">Manage financial models and assumptions.</p>
      </div>
      <FeasibilityEngine 
        site={site} 
        activeScenario={activeScenario}
        isEditable={true} 
      />
    </div>
  );
};