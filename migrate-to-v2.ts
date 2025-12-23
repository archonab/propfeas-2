
import { Site as OldSite, SiteDNA, FeasibilitySettings as OldFeasibilitySettings, TaxState } from './types';
import { Site as NewSite, SiteIdentity, SiteAcquisition, SitePlanning, FeasibilityScenario as NewScenario } from './types-v2';

/**
 * Migrates a Site from the old data model to the new Site-centric model
 */
export function migrateSiteToV2(oldSite: OldSite): NewSite {
  // If it already looks like a V2 site (has identity/acquisition), return it casted
  if ((oldSite as any).identity && (oldSite as any).acquisition) {
      return oldSite as unknown as NewSite;
  }

  const oldDNA = oldSite.dna;
  
  // Extract Identity (immutable physical data)
  const identity: SiteIdentity = {
    address: oldDNA.address,
    state: oldDNA.state as TaxState,
    landArea: oldDNA.landArea,
    lga: oldDNA.lga,
    zoning: oldDNA.zoning,
    zoningCode: oldDNA.zoningCode,
    overlays: oldDNA.overlays || [],
    titleReference: oldDNA.titleReference,
    ownershipEntity: oldDNA.ownershipEntity,
    auv: oldDNA.auv,
    acv: oldDNA.acv,
    geometry: oldDNA.geometry,
    propertyId: oldDNA.propertyId,
  };
  
  // Extract Acquisition (commercial terms)
  // NOTE: We're taking purchasePrice from the FIRST scenario's settings
  // This is a limitation of the old model - in reality, purchase price should be site-level
  const firstScenario = oldSite.scenarios[0];
  const oldAcquisitionSettings = firstScenario?.settings.acquisition;
  
  const acquisition: SiteAcquisition = {
    purchasePrice: oldAcquisitionSettings?.purchasePrice || 0,
    depositPercent: oldAcquisitionSettings?.depositPercent || 10,
    settlementDate: oldDNA.milestones?.settlementDate,
    settlementPeriod: oldAcquisitionSettings?.settlementPeriod || 0,
    stampDutyState: oldAcquisitionSettings?.stampDutyState || oldDNA.state || 'VIC',
    stampDutyTiming: oldAcquisitionSettings?.stampDutyTiming,
    stampDutyOverride: oldAcquisitionSettings?.stampDutyOverride,
    buyersAgentFee: oldAcquisitionSettings?.buyersAgentFee || 0,
    legalFeeEstimate: oldAcquisitionSettings?.legalFeeEstimate || 0,
    vendor: {
      name: oldDNA.vendor?.name || 'Unknown',
      company: oldDNA.vendor?.company,
    },
    purchaser: {
      entity: oldDNA.ownershipEntity || 'Not Set',
    },
    agent: oldDNA.agent ? {
      name: oldDNA.agent.name,
      company: oldDNA.agent.company,
      email: oldDNA.agent.email,
      phone: oldDNA.agent.phone,
    } : undefined,
    isForeignBuyer: oldAcquisitionSettings?.isForeignBuyer || false,
  };
  
  // Extract Planning (statutory data)
  const planning: SitePlanning = {
    permitStatus: (oldDNA.permitStatus as any) || 'Not Started',
    floodZone: (oldDNA.floodZone as any),
    contaminationStatus: oldDNA.contaminationStatus,
    easements: oldDNA.easements,
    covenants: oldDNA.covenants,
  };
  
  // Migrate Scenarios (remove acquisition from settings)
  // We need to cast the settings to unknown then to NewSettings to avoid type errors during transition
  const migratedScenarios = oldSite.scenarios.map(scenario => {
    const { acquisition: _, ...settingsWithoutAcquisition } = scenario.settings;
    
    return {
      ...scenario,
      settings: settingsWithoutAcquisition,
    } as unknown as NewScenario;
  });
  
  // Construct New Site
  const newSite: NewSite = {
    id: oldSite.id,
    code: oldSite.code,
    name: oldSite.name,
    thumbnail: oldSite.thumbnail,
    status: oldSite.status,
    stage: oldSite.stage,
    
    identity,
    acquisition,
    planning,
    
    stakeholders: (oldSite.stakeholders || []) as any[],
    scenarios: migratedScenarios,
    
    projectManager: oldSite.pm,
    openTasks: oldSite.openTasks,
    openRFIs: oldSite.openRFIs,
    conditions: oldSite.conditions,
    
    createdAt: oldSite.createdAt,
    updatedAt: oldSite.updatedAt,
  };
  
  return newSite;
}

/**
 * Migrate all sites in the context
 */
export function migrateAllSites(oldSites: OldSite[]): NewSite[] {
  return oldSites.map(migrateSiteToV2);
}
