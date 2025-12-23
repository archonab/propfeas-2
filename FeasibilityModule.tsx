
import React from 'react';
import { FeasibilityEngine } from './FeasibilityEngine';
import { Site } from './types';
import { useProject } from './contexts/SiteContext';

interface Props {
  site: Site;
}

export const FeasibilityModule: React.FC<Props> = ({ site }) => {
  const { selectedScenarioId, updateScenario, smartRates, customLibrary, taxScales } = useProject();
  
  // Find the active scenario based on the selection from context
  const activeScenario = site.scenarios.find(s => s.id === selectedScenarioId);

  // Fallback (should typically not happen if routed correctly)
  if (!activeScenario) return <div className="p-12 text-center text-slate-400">Scenario not found.</div>;

  const handleSaveScenario = (updated: any) => {
      updateScenario(site.id, activeScenario.id, updated);
  };

  return (
    <div className="h-full">
      <FeasibilityEngine 
        site={site} 
        activeScenario={activeScenario}
        isEditable={true} 
        onSaveScenario={handleSaveScenario}
        smartRates={smartRates}
        libraryData={customLibrary}
        taxScales={taxScales}
      />
    </div>
  );
};
