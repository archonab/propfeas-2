
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Site, FeasibilityScenario, SmartRates, LineItem, TaxConfiguration, TaxState, LeadStatus, CostCategory, ScenarioStatus } from '../types';
import { MOCK_SITES, DEFAULT_RATES, DEFAULT_TAX_SCALES } from '../constants';
import { STANDARD_LIBRARY } from '../costLibrary';

// Define the shape of the context
interface ProjectContextType {
  // State
  sites: Site[];
  selectedSiteId: string | null;
  selectedScenarioId: string | null;
  isSaving: boolean; // Visual feedback state

  // Selection Actions
  selectSite: (id: string | null) => void;
  selectScenario: (id: string | null) => void;
  
  // Global Settings
  smartRates: SmartRates;
  taxScales: TaxConfiguration;
  customLibrary: LineItem[];
  setSmartRates: (rates: SmartRates) => void;
  setTaxScales: (scales: TaxConfiguration) => void;
  setCustomLibrary: (library: LineItem[]) => void;

  // Site CRUD
  addSite: (site: Site) => void;
  updateSite: (siteId: string, updates: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  updateSiteStatus: (id: string, status: LeadStatus) => void;
  
  // Scenario CRUD
  addScenario: (siteId: string, scenario: FeasibilityScenario) => void;
  updateScenario: (siteId: string, scenarioId: string, updates: Partial<FeasibilityScenario>) => void;
  deleteScenario: (siteId: string, scenarioId: string) => void;
  duplicateScenario: (siteId: string, scenarioId: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const flattenLibrary = (lib: Record<CostCategory, LineItem[]>): LineItem[] => {
  return Object.values(lib).flat();
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- STATE ---
  // Initialize from LocalStorage if available, otherwise use MOCK_SITES
  const [sites, setSites] = useState<Site[]>(() => {
    const saved = localStorage.getItem('devfeas_sites');
    return saved ? JSON.parse(saved) : MOCK_SITES;
  });

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Global Admin State
  const [smartRates, setSmartRates] = useState<SmartRates>(DEFAULT_RATES);
  const [taxScales, setTaxScales] = useState<TaxConfiguration>(DEFAULT_TAX_SCALES);
  const [customLibrary, setCustomLibrary] = useState<LineItem[]>([]);

  // --- PERSISTENCE & INIT ---
  
  // Save Sites to LocalStorage whenever they change
  useEffect(() => {
    try {
        localStorage.setItem('devfeas_sites', JSON.stringify(sites));
        // Visual feedback could be handled here if we debounced the save
    } catch (e) {
        console.error("Failed to save sites to local storage", e);
    }
  }, [sites]);

  useEffect(() => {
    // Load Admin Settings
    const savedRates = localStorage.getItem('devfeas_admin_rates');
    if (savedRates) setSmartRates(JSON.parse(savedRates));

    const savedTax = localStorage.getItem('devfeas_admin_tax');
    if (savedTax) setTaxScales(JSON.parse(savedTax));

    const savedLib = localStorage.getItem('devfeas_admin_library');
    if (savedLib) setCustomLibrary(JSON.parse(savedLib));
    else setCustomLibrary(flattenLibrary(STANDARD_LIBRARY));
  }, []);

  useEffect(() => {
    localStorage.setItem('devfeas_admin_rates', JSON.stringify(smartRates));
  }, [smartRates]);

  useEffect(() => {
    localStorage.setItem('devfeas_admin_tax', JSON.stringify(taxScales));
  }, [taxScales]);

  useEffect(() => {
    if (customLibrary.length > 0) {
      localStorage.setItem('devfeas_admin_library', JSON.stringify(customLibrary));
    }
  }, [customLibrary]);

  // --- HELPER: TRIGGER SAVE FLASH ---
  const triggerSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  // --- ACTIONS ---

  const selectSite = useCallback((id: string | null) => {
    setSelectedSiteId(id);
    // Auto-select first scenario if site selected
    if (id) {
        const site = sites.find(s => s.id === id);
        if (site && site.scenarios.length > 0) {
            // Prefer baseline, else first
            const baseline = site.scenarios.find(s => s.isBaseline);
            setSelectedScenarioId(baseline ? baseline.id : site.scenarios[0].id);
        } else {
            setSelectedScenarioId(null);
        }
    } else {
        setSelectedScenarioId(null);
    }
  }, [sites]);

  const selectScenario = useCallback((id: string | null) => {
    setSelectedScenarioId(id);
  }, []);

  const addSite = useCallback((site: Site) => {
    // Auto-timestamp on creation
    const stampedSite = {
        ...site,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    setSites(prev => [stampedSite, ...prev]);
    triggerSave();
  }, []);

  const updateSite = useCallback((siteId: string, updates: Partial<Site>) => {
    setSites(prev => {
        const index = prev.findIndex(s => s.id === siteId);
        if (index === -1) return prev;

        const oldSite = prev[index];
        const newSite = { 
            ...oldSite, 
            ...updates,
            updatedAt: new Date().toISOString() // Audit Timestamp
        };

        // ERP Logic: If Site State (Tax Jurisdiction) changes, sync to all scenarios
        if (updates.dna && updates.dna.state && updates.dna.state !== oldSite.dna.state) {
             const newState = updates.dna.state as TaxState;
             newSite.scenarios = oldSite.scenarios.map(scen => ({
                ...scen,
                settings: {
                    ...scen.settings,
                    acquisition: {
                        ...scen.settings.acquisition,
                        stampDutyState: newState
                    }
                },
                updatedAt: new Date().toISOString() // Update children too
             }));
        }

        const newSites = [...prev];
        newSites[index] = newSite;
        return newSites;
    });
    triggerSave();
  }, []);

  const deleteSite = useCallback((id: string) => {
    setSites(prev => prev.filter(s => s.id !== id));
    if (selectedSiteId === id) {
        selectSite(null);
    }
    triggerSave();
  }, [selectedSiteId, selectSite]);

  const updateSiteStatus = useCallback((id: string, status: LeadStatus) => {
    setSites(prev => {
        return prev.map(site => {
            if (site.id !== id) return site;
            
            let updatedScenarios = site.scenarios;

            // ERP Logic: Lock Baseline on Acquisition
            if (status === 'Acquired') {
                updatedScenarios = site.scenarios.map(s => {
                    if (s.isBaseline) {
                        return { 
                            ...s, 
                            status: ScenarioStatus.LOCKED,
                            updatedAt: new Date().toISOString() 
                        };
                    }
                    return s;
                });
            }

            return { 
                ...site, 
                status, 
                scenarios: updatedScenarios,
                updatedAt: new Date().toISOString()
            };
        });
    });
    triggerSave();
  }, []);

  const addScenario = useCallback((siteId: string, scenario: FeasibilityScenario) => {
    const stampedScenario = {
        ...scenario,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    setSites(prev => prev.map(s => {
        if (s.id !== siteId) return s;
        return { 
            ...s, 
            scenarios: [...s.scenarios, stampedScenario],
            updatedAt: new Date().toISOString() // Parent site updated
        };
    }));
    triggerSave();
  }, []);

  const updateScenario = useCallback((siteId: string, scenarioId: string, updates: Partial<FeasibilityScenario>) => {
    setSites(prev => prev.map(site => {
        if (site.id !== siteId) return site;
        return {
            ...site,
            updatedAt: new Date().toISOString(), // Parent site update
            scenarios: site.scenarios.map(s => {
                if (s.id !== scenarioId) return s;
                return { ...s, ...updates, updatedAt: new Date().toISOString() };
            })
        };
    }));
    triggerSave();
  }, []);

  const deleteScenario = useCallback((siteId: string, scenarioId: string) => {
    setSites(prev => prev.map(site => {
        if (site.id !== siteId) return site;
        return {
            ...site,
            updatedAt: new Date().toISOString(),
            scenarios: site.scenarios.filter(s => s.id !== scenarioId)
        };
    }));
    if (selectedScenarioId === scenarioId) {
        setSelectedScenarioId(null);
    }
    triggerSave();
  }, [selectedScenarioId]);

  const duplicateScenario = useCallback((siteId: string, scenarioId: string) => {
    setSites(prev => prev.map(site => {
        if (site.id !== siteId) return site;
        const source = site.scenarios.find(s => s.id === scenarioId);
        if (!source) return site;

        const copy: FeasibilityScenario = {
            ...JSON.parse(JSON.stringify(source)),
            id: `scen-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            name: `${source.name} (Copy)`,
            isBaseline: false, // Copies are never baseline by default
            status: ScenarioStatus.DRAFT,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return {
            ...site,
            updatedAt: new Date().toISOString(),
            scenarios: [...site.scenarios, copy]
        };
    }));
    triggerSave();
  }, []);

  return (
    <ProjectContext.Provider value={{
      sites, selectedSiteId, selectedScenarioId, isSaving,
      selectSite, selectScenario,
      smartRates, taxScales, customLibrary,
      addSite, updateSite, deleteSite, updateSiteStatus,
      addScenario, updateScenario, deleteScenario, duplicateScenario,
      setSmartRates, setTaxScales, setCustomLibrary
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
