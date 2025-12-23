
import React, { useState } from 'react';
import { Site } from './types';
import { FeasibilityModule } from './FeasibilityModule';
import { SiteDashboard } from './components/SiteDashboard';
import { useProject } from './contexts/SiteContext';
import { ScenarioWizard } from './components/ScenarioWizard';

interface Props {
  site: Site;
  onBack: () => void;
}

export const ProjectLayout: React.FC<Props> = ({ site, onBack }) => {
  // Navigation State
  const { selectedScenarioId, selectScenario, addScenario } = useProject();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // HANDLER: Create new Scenario from Site Hub
  const handleCreateScenario = () => {
     setIsWizardOpen(true);
  };

  const handleWizardCreate = (scen: any) => {
      addScenario(site.id, scen);
      // Optional: Auto-select the new scenario to jump straight in
      // selectScenario(scen.id); 
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Wizard Modal */}
      <ScenarioWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        onCreate={handleWizardCreate}
        projectName={site.name}
        existingScenarios={site.scenarios}
      />

      {/* 1. CONTEXT HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shrink-0">
        <div className="px-6 py-3 flex justify-between items-center border-b border-slate-100">
           {/* Breadcrumbs */}
           <div className="flex items-center space-x-2 text-sm">
              <button onClick={onBack} className="text-slate-400 hover:text-slate-700 font-bold">Portfolio</button>
              <span className="text-slate-300">/</span>
              <button onClick={() => selectScenario(null)} className={`font-bold ${!selectedScenarioId ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}>
                 {site.name}
              </button>
              {selectedScenarioId && (
                 <>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">
                       {site.scenarios.find(s => s.id === selectedScenarioId)?.name}
                    </span>
                 </>
              )}
           </div>
           
           {/* Global Actions (Share, etc) */}
           <div className="flex items-center space-x-3">
              <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded shadow-sm">Share</button>
           </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT ROUTER */}
      <main className="flex-1 overflow-hidden relative">
         
         {/* CASE A: No Scenario Selected -> Show SITE HUB */}
         {!selectedScenarioId ? (
            <div className="h-full overflow-y-auto bg-slate-50">
               <SiteDashboard 
                  site={site} 
                  onOpenScenario={selectScenario}
                  onCreateScenario={handleCreateScenario}
               />
            </div>
         ) : (
            /* CASE B: Scenario Selected -> Show FEASIBILITY ENGINE (Workbench) */
            <FeasibilityModule site={site} />
         )}

      </main>
    </div>
  );
};
