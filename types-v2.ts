
import { 
  TaxState, 
  CapitalStack, 
  LineItem, 
  RevenueItem, 
  ScenarioStatus 
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
 * ACQUISITION: Commercial terms of the land purchase
 * Set once when site is acquired, used by ALL feasibility scenarios
 */
export interface SiteAcquisition {
  // Purchase Terms
  purchasePrice: number;
  depositPercent: number;
  
  // Dates
  contractDate?: string; // ISO date
  settlementDate?: string; // ISO date
  settlementPeriod?: number; // days/months from contract to settlement (Engine logic)
  
  // Parties
  vendor: {
    name: string;
    company?: string;
    legalRep?: string;
  };
  
  purchaser: {
    entity: string; // Buying entity name
    solicitor?: string;
  };
  
  // Agent
  agent?: {
    name: string;
    company: string;
    email?: string;
    phone?: string;
    commissionPercent?: number;
    commissionAmount?: number;
  };
  
  // Buyer Circumstances
  isForeignBuyer: boolean;
  stampDutyState: TaxState; // Added to explicit tracking
  stampDutyTiming?: 'EXCHANGE' | 'SETTLEMENT';
  stampDutyOverride?: number;
  buyersAgentFee?: number; // Percent
  legalFeeEstimate?: number; // Fixed Amount
  
  // Transaction Costs (system-calculated, but stored for audit)
  calculatedStampDuty?: number;
}

/**
 * PLANNING: Statutory approvals and environmental considerations
 * These evolve over the site lifecycle
 */
export interface SitePlanning {
  // Permit/Approval Status
  permitStatus: PermitStatus;
  permitApplicationDate?: string;
  permitApprovalDate?: string;
  permitNumber?: string;
  permitConditions?: number; // Count of planning conditions
  
  // Environmental
  floodZone?: FloodZone;
  contaminationStatus?: string;
  contaminationNotes?: string;
  
  // Legal Encumbrances
  easements?: string;
  covenants?: string;
  restrictionsOnTitle?: string;
  
  // Heritage/Conservation
  heritageOverlay?: boolean;
  heritageGrade?: string;
}

/**
 * SITE: The master entity
 * Represents a physical land parcel throughout its lifecycle
 */
export interface Site extends Auditable {
  // Unique Identifiers
  id: string; // Add ID to interface
  code: string; // Internal reference (e.g., "PROJ-001")
  name: string; // Project/Site name
  
  // Visual
  thumbnail: string; // Hero image URL
  
  // Lifecycle Status
  status: LeadStatus; // Prospect → Due Diligence → Acquired → Archive
  stage: ProjectStage; // Analysis → Acquisition → Planning → Construction → Sales → Asset Management
  
  // Core Data (The Three Pillars)
  identity: SiteIdentity;
  acquisition: SiteAcquisition;
  planning: SitePlanning;
  
  // Stakeholders (CRM)
  stakeholders: Stakeholder[];
  
  // Financial Scenarios (Multiple Options)
  scenarios: FeasibilityScenario[];
  
  // Active Project (if under construction)
  activeProjectId?: string; // References a Project entity (future)
  
  // Management Metadata
  projectManager?: string; // Mapped from 'pm'
  openTasks: number;
  openRFIs: number;
  conditions?: number; // Added for compatibility
}

// --- UPDATED FEASIBILITY SCENARIO ---

/**
 * FEASIBILITY SCENARIO: A design/financial option for the site
 * Multiple scenarios can exist for one site (e.g., "10 units" vs "12 units")
 */
export interface FeasibilityScenario extends Auditable {
  name: string;
  description?: string;
  
  // Hierarchy
  isBaseline: boolean; // Is this the approved scenario?
  status: ScenarioStatus; // Draft | Baseline | Promoted
  
  // Design Strategy
  strategy: 'SELL' | 'HOLD';
  linkedSellScenarioId?: string; // For HOLD scenarios
  
  // Scenario-Specific Settings (removed acquisition data)
  settings: FeasibilitySettings;
  
  // Cost & Revenue Inputs
  costs: LineItem[];
  revenues: RevenueItem[];
}

/**
 * FEASIBILITY SETTINGS: Scenario-specific design and financial assumptions
 * NO LONGER includes acquisition data (that's in Site.acquisition)
 */
export interface FeasibilitySettings {
  // Project Identity
  projectName?: string;
  description?: string;
  inputScale?: any; // InputScale enum 
  
  // Development Design
  totalUnits: number;
  developmentType?: 'Residential' | 'Commercial' | 'Mixed-Use' | 'Industrial';
  gfa?: number; // Gross Floor Area
  
  // Timeline
  startDate: string; // Project commencement (ISO date)
  durationMonths: number; // Total project duration
  constructionDelay: number; // Months from start to construction
  
  // Financial Assumptions
  discountRate: number;
  gstRate: number;
  useMarginScheme: boolean;
  defaultEscalationRate?: number;
  
  // Escalation
  growth: {
    constructionEscalation: number; // % per annum
    salesPriceEscalation: number;
    rentalGrowth: number;
    landAppreciation: number;
    cpi: number;
  };
  
  // Hold Strategy (Specific to BTR)
  holdStrategy?: any; // Keep complex type opaque here or import

  // Capital Structure
  capitalStack: CapitalStack;
}

// --- SUPPORTING ENUMS ---

export type LeadStatus = 'Prospect' | 'Due Diligence' | 'Acquired' | 'Archive';
export type ProjectStage = 
  | 'Analysis' 
  | 'Acquisition' 
  | 'Planning' 
  | 'Construction' 
  | 'Sales' 
  | 'Asset Management';

export type PermitStatus = 
  | 'Not Started' 
  | 'Draft' 
  | 'Lodged' 
  | 'RFI' 
  | 'Approved' 
  | 'Rejected';

export type FloodZone = 'Low' | 'Medium' | 'High';

// --- STAKEHOLDER ---

export type StakeholderRole = 
  | 'Investor' 
  | 'Client' 
  | 'Consultant' 
  | 'Architect' 
  | 'Engineer'
  | 'Builder'
  | 'Agent'
  | 'Lender' 
  | 'Authority'
  | 'Vendor'; // Added Vendor

export interface Stakeholder extends Auditable {
  role: StakeholderRole | string; // Allow loose string for compatibility
  name: string;
  company: string;
  email?: string;
  phone?: string;
  notes?: string;
}

// --- AUDIT TRAIL ---

export interface Auditable {
  id: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  createdBy?: string; // User ID (future)
}
