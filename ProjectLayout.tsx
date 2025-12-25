
import React, { useState } from 'react';
import { Site } from './types-v2';
import { FeasibilityModule } from './FeasibilityModule';
import { SiteDashboard } from './components/SiteDashboard';
import { useProject } from './contexts/SiteContext';
import { ScenarioWizard } from './components/ScenarioWizard';

interface Props {
  site: Site;
  onBack: () => void;
}

export const ProjectLayout: React.FC<Props> = ({ site, onBack }) => {
  const { selectedScenarioId, selectScenario, addScenario } = useProject();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleCreateScenario = () => {
     setIsWizardOpen(true);
  };

  const handleWizardCreate = (scen: any) => {
      addScenario(site.id, scen);
      selectScenario(scen.id); // Auto-open new scenarios
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      
      {/* Wizard Modal */}
      <ScenarioWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        onCreate={handleWizardCreate}
        projectName={site.name}
        existingScenarios={site.scenarios}
      />

      {/* 
          PROJECT CONTEXT ROUTER 
          If a scenario is selected, show the workbench (FeasibilityModule).
          Otherwise, show the Mockup-styled Dashboard (Site Hub).
      */}
      <main className="flex-1 overflow-hidden relative">
         
         {!selectedScenarioId ? (
            <SiteDashboard 
               site={site} 
               onOpenScenario={selectScenario}
               onCreateScenario={handleCreateScenario}
               onBack={onBack}
            />
         ) : (
            <FeasibilityModule site={site} />
         )}

      </main>
    </div>
  );
};
