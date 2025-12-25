
import { 
  TaxState, 
  CapitalStack, 
  LineItem, 
  RevenueItem, 
  ScenarioStatus,
  LeadStatus,
  ProjectStage,
  Stakeholder,
  FeasibilitySettings as OldSettings
} from './types';

// ============================================
// SITE-CENTRIC DATA MODEL V2
// ============================================

// --- CORE SITE ENTITIES ---

/**
 * IDENTITY: Immutable physical and legal attributes of the site
 * This data rarely changes after initial entry
 */
export interface SiteIdentity {
  // Location
  address: string;
  suburb?: string;
  state: TaxState;
  postcode?: string;
  
  // Physical Attributes
  landArea: number; // sqm
  totalGFA?: number; // Gross Floor Area
  totalNSA?: number; // Net Saleable Area
  frontage?: number;
  depth?: number;
  
  // Legal & Title
  titleReference?: string; // Vol/Folio
  lotNumber?: string;
  planNumber?: string;
  ownershipEntity?: string; // SPV name
  
  // Statutory Context
  lga: string; // Local Government Area (Council)
  zoning: string; // General description
  zoningCode?: string; // Specific code (e.g., RGZ1, GRZ2)
  overlays: string[];
  
  // Statutory Values
  auv?: number; // Assessed Unimproved Value (Site Value)
  acv?: number; // Assessed Capital Improved Value
  
  // Geolocation
  geometry?: { lat: number; lng: number };
  propertyId?: string; // External reference (e.g., VPA Property ID)
}

/**
 * ACQUISITION: Commercial terms related to the purchase of the asset
 */
export interface SiteAcquisition {
  purchasePrice: number;
  depositPercent: number;
  settlementDate?: string;
  settlementPeriod?: number;
  stampDutyState: TaxState;
  stampDutyTiming?: 'EXCHANGE' | 'SETTLEMENT';
  stampDutyOverride?: number;
  isForeignBuyer: boolean;
  buyersAgentFee: number;
  legalFeeEstimate: number;
  vendor: {
    name: string;
    company?: string;
  };
  purchaser: {
    entity: string;
  };
  agent?: {
    name: string;
    company: string;
    email?: string;
    phone?: string;
  };
}

/**
 * PLANNING: Statutory status and constraints
 */
export interface SitePlanning {
  permitStatus: string;
  floodZone?: string;
  contaminationStatus?: string;
  easements?: string;
  covenants?: string;
}

// --- FEASIBILITY OVERRIDES ---

/**
 * V2 Settings removes the 'acquisition' object as it is now site-level
 */
export interface FeasibilitySettings extends Omit<OldSettings, 'acquisition'> {}

export interface FeasibilityScenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isBaseline: boolean;
  status: ScenarioStatus;
  strategy: 'SELL' | 'HOLD';
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
  linkedSellScenarioId?: string;
}

/**
 * V2 SITE: The root container for all project data
 */
export interface Site {
  id: string;
  code: string;
  name: string;
  thumbnail: string;
  status: LeadStatus;
  stage: ProjectStage;
  
  identity: SiteIdentity;
  acquisition: SiteAcquisition;
  planning: SitePlanning;
  
  stakeholders: Stakeholder[];
  scenarios: FeasibilityScenario[];
  
  projectManager?: string;
  openTasks: number;
  openRFIs: number;
  conditions: number;
  
  createdAt: string;
  updatedAt: string;
}

// Re-export common types for convenience
export { LeadStatus, ProjectStage };
