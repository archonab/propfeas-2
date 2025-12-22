
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

export enum InputScale {
  ONES = 'ONES',
  THOUSANDS = 'THOUSANDS',
  MILLIONS = 'MILLIONS'
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
export type LineItemTag = 
  'LAND_PRICE' | 
  'STAMP_DUTY' | 
  'LEGAL_PURCHASE' | 
  'AGENT_FEE' | 
  'LEGAL_SALES' | 
  'COUNCIL_RATES' | 
  'LAND_TAX' |      
  'NONE';

export type CalculationLink = 'AUTO_STAMP_DUTY' | 'AUTO_LAND_TAX' | 'AUTO_COUNCIL_RATES' | 'NONE';

export type RevenueItemTag = 'GROSS_SALES' | 'OTHER_INCOME' | 'NONE';

// --- MILESTONE LINKING ---
export enum MilestoneLink {
  MANUAL = 'Manual Date',
  ACQUISITION = 'Settlement',
  CONSTRUCTION_START = 'Const. Start',
  CONSTRUCTION_END = 'Const. Completion'
}

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

// --- TAX & DUTY AUTOMATION ---
export type TaxMethod = 'SLIDING' | 'FLAT'; // Sliding = Marginal, Flat = % of Total Value
export type TaxType = 'STAMP_DUTY' | 'LAND_TAX_GENERAL' | 'LAND_TAX_TRUST';
export type TaxState = 'VIC' | 'NSW' | 'QLD';

export interface TaxBracket {
  limit: number; // The upper bound of this bracket (e.g. 25000)
  rate: number; // The percentage rate (e.g. 1.4 for 1.4%)
  base: number; // The base amount payable for this bracket (Flat Fee)
  method: TaxMethod;
}

// Nested Configuration: State -> TaxType -> Brackets
export type TaxConfiguration = Record<TaxState, Record<TaxType, TaxBracket[]>>;

// --- SENSITIVITY TYPES ---
export type SensitivityVariable = 'revenue' | 'cost' | 'duration' | 'interest' | 'land';

export interface SensitivityRow {
  varianceLabel: string; // e.g. "+5%"
  variableValue: number; // The input value being tested (e.g. Land Price $)
  devCost: number;       // Total Dev Cost
  netProfit: number;
  margin: number;
  irr: number;
  isBaseCase: boolean;
}

// --- CANONICAL FINANCIAL MODEL ---
export interface ProjectFinancials {
  grossRealisation: number; // Inc GST
  gstOnSales: number;
  netRealisation: number; // Ex GST
  
  totalCostGross: number; // Invoice value
  gstInputCredits: number;
  totalCostNet: number; // Economic cost
  
  netProfit: number;
  marginOnCost: number;
}

// --- REPORTING METRICS ---
export interface ProjectMetrics extends ProjectFinancials {
  // Core Financials (Legacy Compatibility)
  totalDevelopmentCost: number; // Maps to totalCostNet
  grossRevenue: number;         // Maps to grossRealisation
  netRevenue: number;           // Maps to netRealisation
  totalFinanceCost: number;
  
  // Margins
  devMarginPct: number; // Net Profit / TDC
  marginBeforeInterest: number; // $ Amount
  marginOnEquity: number; // Net Profit / Peak Equity
  
  // Returns
  equityIRR: number;
  projectIRR: number; // Unlevered
  
  // Tax
  gstCollected: number;
  // gstInputCredits exists in ProjectFinancials
  netGstPayable: number;

  // Debt Analysis
  peakDebtAmount: number;
  peakDebtMonthIndex: number;
  peakDebtDate: string; // "Mar 2026"
  
  // Equity Analysis
  peakEquity: number;
  residualLandValue?: number;
}

// --- SITE-FIRST DATA MODEL ---

// Audit Trail Interface
export interface Auditable {
  id: string;
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  createdBy?: string; // User ID
}

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
  settlementDate?: string; // Critical for sorting
  constructionStartDate?: string;
  completionDate?: string;
  eoiCloseDate?: string; // New: Expression of Interest close
}

// Extended Asset Registry Types
export type PermitStatus = 'Not Started' | 'Draft' | 'Lodged' | 'RFI' | 'Approved' | 'Rejected';
export type FloodZone = 'Low' | 'Medium' | 'High';
export type StakeholderRole = 'Investor' | 'Client' | 'Consultant' | 'Lender' | 'Authority';

export interface Stakeholder extends Auditable {
  role: StakeholderRole;
  name: string;
  company: string;
  email?: string;
  phone?: string;
}

export interface SiteDNA {
  // Physical Attributes
  address: string;
  state: TaxState;
  landArea: number; // m2
  lga: string; // Council
  zoning: string; // General description
  
  // Planning & Environment (New)
  zoningCode?: string; // Specific code e.g., RGZ1
  overlays: string[];
  permitStatus?: PermitStatus;
  floodZone?: FloodZone;
  contaminationStatus?: string;

  // Statutory Values
  auv?: number; // Site Value
  acv?: number; // Capital Improved Value

  // Legal & Title (New)
  titleReference?: string; // Vol/Folio
  ownershipEntity?: string;
  easements?: string;
  covenants?: string;

  // Geolocation
  geometry?: { lat: number, lng: number };
  propertyId?: string;

  // Legacy CRM (Deprecated in favor of Stakeholders array, kept for compat)
  agent: AgentContact;
  vendor: VendorProfile;

  // Timeline
  milestones: SiteMilestones;
}

export interface FeasibilityScenario extends Auditable {
  name: string;
  isBaseline: boolean;
  status: ScenarioStatus;
  strategy: 'SELL' | 'HOLD';
  linkedSellScenarioId?: string;
  settings: FeasibilitySettings;
  costs: LineItem[];
  revenues: RevenueItem[];
}

export type LeadStatus = 'Prospect' | 'Due Diligence' | 'Acquired' | 'Archive';

export interface Site extends Auditable {
  code: string;
  name: string;
  thumbnail: string;
  status: LeadStatus;
  
  // Core Asset Data
  dna: SiteDNA;
  
  // Project Team (New)
  stakeholders: Stakeholder[];

  // Financial Scenarios
  scenarios: FeasibilityScenario[];

  // Management Stats
  stage: 'Analysis' | 'Acquisition' | 'Planning' | 'Construction' | 'Sales';
  pm: string;
  openTasks: number;
  openRFIs: number;
  conditions: number;
}

export type GlobalView = 'sites' | 'feasibilities' | 'admin';
export type CockpitTab = 'overview' | 'dna' | 'feasibility' | 'stakeholders';
export type ProjectModule = 'overview' | 'feasibility' | 'tasks' | 'sales';

export interface LineItem {
  id: string;
  code: string;
  category: CostCategory;
  description: string;
  inputType: InputType;
  amount: number;
  startDate: number;
  span: number;
  linkToMilestone?: MilestoneLink;
  method: DistributionMethod;
  escalationRate: number;
  gstTreatment: GstTreatment;
  sCurveSteepness?: number; 
  milestones?: Record<number, number>; 
  specialTag?: LineItemTag; 
  calculationLink?: CalculationLink; 
}

export type RevenueStrategy = 'Sell' | 'Hold';
export type RevenueCalcMode = 'LUMP_SUM' | 'QUANTITY_RATE';

export interface RevenueItem {
  id: string;
  description: string;
  strategy: RevenueStrategy;
  calcMode: RevenueCalcMode;
  units: number;
  pricePerUnit: number;
  absorptionRate?: number;
  commissionRate: number; 
  isTaxable: boolean; 
  weeklyRent?: number;
  opexRate?: number;
  vacancyFactorPct?: number;
  leaseUpMonths?: number;
  isCapitalised?: boolean;
  capRate?: number;
  offsetFromCompletion: number;
  settlementSpan: number;
  specialTag?: RevenueItemTag;
}

// --- ADVANCED FINANCIAL TYPES (unchanged) ---
export enum DebtLimitMethod { FIXED = 'Fixed Amount', LVR = 'LVR Cap (%)', LTC = 'LTC Cap (%)' }
export enum InterestRateMode { SINGLE = 'Single Rate', VARIABLE = 'Variable Rates over Time' }
export enum FeeBase { FIXED = 'Fixed Amount ($)', PERCENT = 'Percentage of Limit (%)' }
export enum EquityMode { SUM_OF_MONEY = 'Sum of Money (Upfront)', INSTALMENTS = 'Lump Sum Instalments', PCT_LAND = '% of Land Purchase Price', PCT_TOTAL_COST = '% of Total Costs (Pre-Interest)', PCT_MONTHLY = '% of Monthly Costs (Pari Passu)' }

export interface DatedRate { id: string; month: number; rate: number; }
export interface DatedAmount { id: string; month: number; amount: number; }

export interface CapitalTier {
  rateMode: InterestRateMode;
  interestRate: number;
  variableRates: DatedRate[];
  establishmentFeeBase: FeeBase;
  establishmentFee: number;
  lineFeePct?: number;
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
  includeAcquisitionCosts?: boolean; // New flag for PCT_LAND mode
}

export interface JointVenture {
  enabled: boolean;
  partnerName: string;
  equitySplitPct: number;
  profitSharePct: number;
}

export interface CapitalStack {
  senior: CapitalTier;
  mezzanine: CapitalTier;
  equity: EquityStructure;
  jv: JointVenture;
  surplusInterestRate: number;
}

export interface AcquisitionSettings {
  purchasePrice: number;
  settlementPeriod: number;
  depositPercent: number;
  stampDutyState: 'VIC' | 'NSW' | 'QLD';
  stampDutyTiming: 'EXCHANGE' | 'SETTLEMENT';
  stampDutyOverride?: number;
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

export interface GrowthMatrix {
  constructionEscalation: number;
  rentalGrowth: number;
  landAppreciation: number;
  salesPriceEscalation: number;
  cpi: number;
}

export interface FeasibilitySettings {
  description?: string;
  projectName?: string;
  inputScale?: InputScale; // New Input Scale
  acquisition: AcquisitionSettings;
  startDate: string;
  durationMonths: number;
  constructionDelay: number;
  growth: GrowthMatrix;
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
  
  // Costs
  developmentCosts: number; // Net
  grossCosts: number; // New: Gross Invoice
  gstOnCosts: number; // New: Input Tax Credits
  costBreakdown: Record<CostCategory, number>;
  
  // Revenue
  grossRevenue: number;
  netRevenue: number; 
  gstOnSales: number; // New: GST Liability
  
  // Funding
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
  lineFeeSenior: number;
  
  // Net
  netCashflow: number;
  cumulativeCashflow: number;
  
  // Asset
  investmentBalance: number;
  investmentInterest: number;
  assetValue: number;
  statutoryValue: number;
  landTaxLiability: number;
  inflationFactor: number; 
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

// --- REPORTING TYPES ---
export interface ItemisedRow {
  label: string;
  total: number;
  values: number[]; // Length = duration
}

export interface ItemisedCategory {
  id: string;
  name: string;
  rows: ItemisedRow[];
  total: number;
  monthlyTotals: number[];
}

export interface ItemisedCashflow {
  headers: string[]; // Month Labels
  categories: ItemisedCategory[];
  netCashflow: number[];
  cumulativeCashflow: number[];
}
