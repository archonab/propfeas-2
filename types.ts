
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
  // Physical Attributes
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

export type LeadStatus = 'Prospect' | 'Due Diligence' | 'Acquired' | 'Archive';

export interface SiteLead {
  id: string;
  code: string;
  name: string; // Project Title / Name
  thumbnail: string;
  status: LeadStatus;
  
  // Embedded Site Data
  dna: SiteDNA;

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
  
  // Advanced Distribution Settings
  sCurveSteepness?: number; // k-factor, default 10
  milestones?: Record<number, number>; // Map of relative month -> percentage (0-100)
}

export type RevenueStrategy = 'Sell' | 'Hold';

export interface RevenueItem {
  id: string;
  description: string;
  units: number;
  strategy: RevenueStrategy;
  
  // Sell Strategy Fields
  pricePerUnit: number;
  exchangeDate: number; // Month index
  settlementDate: number; // Month index (Revenue realization)
  commissionRate: number; // %
  isTaxable: boolean; 

  // Hold Strategy Fields
  weeklyRent?: number;
  opexRate?: number; // % of Gross Rent
  capRate?: number; // %
  leaseUpDuration?: number; // Months to stabilize
}

// --- ADVANCED FINANCIAL TYPES (FEASTUDY 7.0) ---

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
  month: number; // Month index (0, 1, 2...)
  rate: number; // Annual %
}

export interface DatedAmount {
  id: string;
  month: number; // Month index
  amount: number;
}

export interface CapitalTier {
  // Interest
  rateMode: InterestRateMode;
  interestRate: number; // Single rate fallback
  variableRates: DatedRate[]; // Schedule
  
  // Fees
  establishmentFeeBase: FeeBase;
  establishmentFee: number; // $ or %
  lineFee?: number; // % p.a. on Limit
  
  // Limits & Timing
  limitMethod?: DebtLimitMethod; 
  limit?: number; 
  activationMonth?: number; 
  isInterestCapitalised?: boolean;
}

export interface EquityStructure {
  mode: EquityMode;
  initialContribution: number; // Used for Sum of Money
  instalments: DatedAmount[]; // Used for Lump Sum Instalments
  percentageInput: number; // Used for % Land, % Total, % Monthly
}

export interface CapitalStack {
  senior: CapitalTier;
  mezzanine: CapitalTier;
  equity: EquityStructure;
  surplusInterestRate: number; // Interest earned on positive cash balance
}

export interface FeasibilitySettings {
  projectName: string; // The specific scenario name (e.g. "Option 1")
  description: string;
  
  // Site Context
  site: SiteDNA; // Replacing flat 'location' string with full DNA

  // Calculation Settings
  startDate: string; // Cashflow Start Date (might differ from acquisition date)
  durationMonths: number;
  discountRate: number;
  gstRate: number;
  totalUnits: number;
  status?: ScenarioStatus;
  useMarginScheme: boolean;
  
  capitalStack: CapitalStack;
}

export interface MonthlyFlow {
  month: number;
  label: string;
  
  developmentCosts: number; 
  costBreakdown: Record<CostCategory, number>; // Breakdown by category

  grossRevenue: number; // New field: Raw sales income before costs
  netRevenue: number; // After Selling Costs and GST
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
