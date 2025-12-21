
export enum DistributionMethod {
  LINEAR = 'Linear',
  S_CURVE = 'S-Curve',
  BELL_CURVE = 'Bell Curve',
  MILESTONE = 'Milestone',
  UPFRONT = 'Upfront',
  END = 'End'
}

export enum InputType {
  FIXED = 'Fixed Amount',
  PCT_REVENUE = '% of Revenue',
  PCT_CONSTRUCTION = '% of Construction',
  RATE_PER_UNIT = 'Rate per Unit',
  RATE_PER_SQM = 'Rate per sqm'
}

export enum CostCategory {
  LAND = 'Land Purchasing',
  CONSULTANTS = "Consultants' Fees",
  CONSTRUCTION = 'Construction Costs',
  STATUTORY = 'Statutory Fees',
  MISCELLANEOUS = 'Miscellaneous Costs',
  SELLING = 'Selling & Leasing Costs',
  FINANCE = 'Finance Costs'
}

export enum GstTreatment {
  TAXABLE = 'Taxable',
  GST_FREE = 'GST Free',
  INPUT_TAXED = 'Input Taxed',
  MARGIN_SCHEME = 'Margin Scheme'
}

export enum ScenarioStatus {
  DRAFT = 'Draft',
  LOCKED = 'Locked/Baseline',
  PROMOTED = 'Promoted'
}

// --- SPECIAL LOGIC TAGS ---
export type LineItemTag = 'LAND_PRICE' | 'STAMP_DUTY' | 'LEGAL_PURCHASE' | 'AGENT_FEE' | 'LEGAL_SALES' | 'NONE';
export type RevenueItemTag = 'GROSS_SALES' | 'OTHER_INCOME' | 'NONE';

// --- GLOBAL SETTINGS TYPES ---
export interface SmartRates {
  architectPct: number;
  projectManagementPct: number;
  civilEngRatePerSqm: number;
  landscapeRatePerSqm: number;
  contingencyPct: number;
  defaultGstRate: number;
  defaultEscalationRate: number;
  defaultAgentFeePct: number;
}

// --- SENSITIVITY TYPES ---
export type SensitivityVariable = 'revenue' | 'cost' | 'duration' | 'interest';

// --- SITE-FIRST DATA MODEL ---

export interface AgentContact {
  name: string;
  company: string;
  email?: string;
  phone?: string;
}

export interface VendorProfile {
  name: string;
  company?: string;
}

export interface SiteMilestones {
  acquisitionDate?: string;
  settlementDate?: string;
  constructionStartDate?: string;
  completionDate?: string;
}

export interface SiteDNA {
  // Physical Attributes (Immutable per Site)
  address: string;
  landArea: number; // in square meters
  lga: string; // Local Government Area (Council)
  zoning: string;
  overlays: string[]; // e.g., "Heritage", "Flood"
  
  // Geolocation & Enrichment
  geometry?: { lat: number, lng: number };
  propertyId?: string;

  // CRM / Deal Attributes
  agent: AgentContact;
  vendor: VendorProfile;

  // Timeline
  milestones: SiteMilestones;
}

export interface FeasibilityScenario {
  id: string;
  name: string; // e.g. "Base Case", "High Yield Option"
  lastModified: string;
  isBaseline: boolean;
  status: ScenarioStatus;
  strategy: 'SELL' | 'HOLD'; // High-level strategy intent
  
  // Scenario Linking (The Feastudy "Golden Thread")
  linkedSellScenarioId?: string; // If HOLD, this points to the development basis
  
  // The Financial Model
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
}

export type LeadStatus = 'Prospect' | 'Due Diligence' | 'Acquired' | 'Archive';

export interface Site {
  id: string;
  code: string;
  name: string; // Project Title / Name
  thumbnail: string;
  status: LeadStatus;
  
  // Embedded Site Data
  dna: SiteDNA;
  
  // Financial Scenarios (One Site -> Many Models)
  scenarios: FeasibilityScenario[];

  // Management Stats (Mocked for dashboard)
  stage: 'Analysis' | 'Acquisition' | 'Planning' | 'Construction' | 'Sales';
  pm: string;
  openTasks: number;
  openRFIs: number;
  conditions: number;
}

export type GlobalView = 'pipeline' | 'portfolio' | 'admin';
export type ProjectModule = 'overview' | 'feasibility' | 'tasks' | 'procurement' | 'contracts' | 'sales' | 'rfi' | 'files';

export interface LineItem {
  id: string;
  code: string;
  category: CostCategory;
  description: string;
  inputType: InputType;
  amount: number;
  startDate: number;
  span: number;
  method: DistributionMethod;
  escalationRate: number; // Annual %
  gstTreatment: GstTreatment;
  sCurveSteepness?: number; 
  milestones?: Record<number, number>; 
  specialTag?: LineItemTag; 
}

export type RevenueStrategy = 'Sell' | 'Hold';

export interface RevenueItem {
  id: string;
  description: string;
  units: number;
  strategy: RevenueStrategy;
  pricePerUnit: number;
  offsetFromCompletion: number; 
  settlementSpan: number; 
  commissionRate: number; 
  isTaxable: boolean; 
  weeklyRent?: number;
  opexRate?: number; 
  capRate?: number; 
  leaseUpDuration?: number; 
  specialTag?: RevenueItemTag;
}

// --- ADVANCED FINANCIAL TYPES ---

export enum DebtLimitMethod {
  FIXED = 'Fixed Amount',
  LVR = 'LVR Cap (%)',
  LTC = 'LTC Cap (%)'
}

export enum InterestRateMode {
  SINGLE = 'Single Rate',
  VARIABLE = 'Variable Rates over Time'
}

export enum FeeBase {
  FIXED = 'Fixed Amount ($)',
  PERCENT = 'Percentage of Limit (%)'
}

export enum EquityMode {
  SUM_OF_MONEY = 'Sum of Money (Upfront)',
  INSTALMENTS = 'Lump Sum Instalments',
  PCT_LAND = '% of Land Purchase Price',
  PCT_TOTAL_COST = '% of Total Costs (Pre-Interest)',
  PCT_MONTHLY = '% of Monthly Costs (Pari Passu)'
}

export interface DatedRate {
  id: string;
  month: number;
  rate: number;
}

export interface DatedAmount {
  id: string;
  month: number;
  amount: number;
}

export interface CapitalTier {
  rateMode: InterestRateMode;
  interestRate: number;
  variableRates: DatedRate[];
  establishmentFeeBase: FeeBase;
  establishmentFee: number;
  lineFee?: number;
  limitMethod?: DebtLimitMethod; 
  limit?: number; 
  activationMonth?: number; 
  isInterestCapitalised?: boolean;
}

export interface EquityStructure {
  mode: EquityMode;
  initialContribution: number;
  instalments: DatedAmount[];
  percentageInput: number;
}

export interface CapitalStack {
  senior: CapitalTier;
  mezzanine: CapitalTier;
  equity: EquityStructure;
  surplusInterestRate: number;
}

export interface AcquisitionSettings {
  purchasePrice: number;
  settlementPeriod: number;
  depositPercent: number;
  stampDutyState: 'VIC' | 'NSW' | 'QLD';
  isForeignBuyer: boolean;
  buyersAgentFee: number;
  legalFeeEstimate: number;
}

export interface DepreciationSplit {
  capitalWorksPct: number;
  plantPct: number;
}

export interface HoldStrategy {
  refinanceMonth: number;
  refinanceLvr: number;
  investmentRate: number;
  holdPeriodYears: number;
  annualCapitalGrowth: number;
  terminalCapRate: number;
  depreciationSplit: DepreciationSplit;
}

export interface FeasibilitySettings {
  // Scenario specifics (Site Data has moved to Parent)
  description?: string;
  projectName?: string; // Optional override for report titles

  // Deal Structure
  acquisition: AcquisitionSettings;

  // Calculation Settings
  startDate: string;
  durationMonths: number;
  constructionDelay: number;
  
  holdStrategy?: HoldStrategy;

  discountRate: number;
  gstRate: number;
  totalUnits: number;
  useMarginScheme: boolean;
  defaultEscalationRate?: number;
  
  capitalStack: CapitalStack;
}

export interface MonthlyFlow {
  month: number;
  label: string;
  developmentCosts: number; 
  costBreakdown: Record<CostCategory, number>;
  grossRevenue: number;
  netRevenue: number; 
  drawDownEquity: number;
  drawDownMezz: number;
  drawDownSenior: number;
  lendingInterestIncome: number; 
  repaySenior: number;
  repayMezz: number;
  repayEquity: number;
  balanceSenior: number;
  balanceMezz: number;
  balanceEquity: number; 
  balanceSurplus: number; 
  interestSenior: number;
  interestMezz: number;
  netCashflow: number;
  cumulativeCashflow: number;
  investmentBalance: number;
  investmentInterest: number;
  assetValue: number;
  depreciation: number;
}

export interface BudgetLineItem extends LineItem {
  originalBudget: number;
  committedCost: number;
  actualCost: number;
  forecastCost: number;
}

export interface VendorPlaceholder {
  id: string;
  role: string;
  category: CostCategory;
  suggestedBudget: number;
}

export interface ProjectBudget {
  id: string;
  sourceScenarioId: string;
  projectName: string;
  baselineDate: string;
  lineItems: BudgetLineItem[];
  vendors: VendorPlaceholder[];
}
