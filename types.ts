
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
export type TaxMethod = 'SLIDING' | 'FLAT'; 
export type TaxType = 'STAMP_DUTY' | 'LAND_TAX_GENERAL' | 'LAND_TAX_TRUST';
export type TaxState = 'VIC' | 'NSW' | 'QLD';

export interface TaxBracket {
  limit: number; 
  rate: number; 
  base: number; 
  method: TaxMethod;
}

export type TaxConfiguration = Record<TaxState, Record<TaxType, TaxBracket[]>>;

// --- SENSITIVITY TYPES ---
export type SensitivityVariable = 'revenue' | 'cost' | 'duration' | 'interest' | 'land';

export interface SensitivityRow {
  varianceLabel: string; 
  variableValue: number; 
  devCost: number;       
  netProfit: number;
  margin: number;
  irr: number | null;    
  isBaseCase: boolean;
}

// --- CANONICAL FINANCIAL MODEL ---
export interface ProjectFinancials {
  grossRealisation: number; 
  gstOnSales: number;
  netRealisation: number; 
  
  totalCostGross: number; 
  gstInputCredits: number;
  totalCostNet: number; 
  
  netProfit: number;
  marginOnCost: number;
}

// --- REPORTING METRICS ---
export interface ProjectMetrics extends ProjectFinancials {
  totalDevelopmentCost: number; 
  grossRevenue: number;         
  netRevenue: number;           
  totalFinanceCost: number;
  
  devMarginPct: number; 
  marginBeforeInterest: number; 
  marginOnEquity: number; 
  
  equityIRR: number | null; 
  projectIRR: number | null;
  
  gstCollected: number;
  netGstPayable: number;

  peakDebtAmount: number;
  peakDebtMonthIndex: number;
  peakDebtDate: string; 
  
  peakEquity: number;
  residualLandValue?: number;

  // FEASTUDY PARITY RATIOS
  ratios: {
    landCostPerSqm: number;
    tdcPerSqm: number;
    revenuePerSqm: number;
    profitPerUnit: number;
  };

  // INSTITUTIONAL BENCHMARKS (GFA/NSA)
  benchmarks: {
    constructionEfficiency: number; // $/sqm GFA
    salesRealisation: number;       // $/sqm NSA
    landValuePerSqm: number;        // $/sqm Site
    areaEfficiency: number;         // NSA/GFA %
  };
}

export interface GstAuditEntry {
  id: string;
  label: string;
  category: CostCategory | 'Income';
  amountWithGst: number; // Gross
  gstComponent: number;  // The tax portion
  preGstAmount: number;  // Net
}

export interface LineItemSummary {
  id: string;
  category: CostCategory;
  description: string;
  netAmount: number; 
  gstAmount: number; 
  grossAmount: number; 
  isImplicit: boolean; 
}

export interface ReportModel {
  timestamp: string;
  basis: {
    pricesIncludeGST: boolean;
    gstMethod: 'FULL_GST' | 'MARGIN_SCHEME';
  };
  metrics: ProjectMetrics;
  itemSummaries: LineItemSummary[]; 
  gstAudit: GstAuditEntry[]; // Granular audit for PDF reports
  reconciliation: {
    totalCostGross: number;
    gstInputCredits: number;
    totalCostNet: number;
    grossRealisation: number;
    gstPayable: number;
    netRealisation: number;
    netProfit: number;
  };
  cashflow: {
    monthly: MonthlyFlow[];
    itemised: ItemisedCashflow;
  };
}

export interface Auditable {
  id: string;
  createdAt: string; 
  updatedAt: string; 
  createdBy?: string; 
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
  settlementDate?: string; 
  constructionStartDate?: string;
  completionDate?: string;
  eoiCloseDate?: string; 
}

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
  address: string;
  state: TaxState;
  landArea: number; 
  totalGFA?: number; // Gross Floor Area
  totalNSA?: number; // Net Saleable Area
  lga: string; 
  zoning: string; 
  zoningCode?: string; 
  overlays: string[];
  permitStatus?: PermitStatus;
  floodZone?: FloodZone;
  contaminationStatus?: string;
  auv?: number; 
  acv?: number; 
  titleReference?: string; 
  ownershipEntity?: string;
  easements?: string;
  covenants?: string;
  geometry?: { lat: number, lng: number };
  propertyId?: string;
  agent: AgentContact;
  vendor: VendorProfile;
  milestones: SiteMilestones;
}

// --- MISSING EXPORTS TO FIX COMPILATION ERRORS ---

export type LeadStatus = 'Prospect' | 'Due Diligence' | 'Acquired' | 'Archive';
export type ProjectStage = 'Analysis' | 'Acquisition' | 'Planning' | 'Construction' | 'Sales' | 'Asset Management';
export type CockpitTab = 'overview' | 'dna' | 'feasibility' | 'stakeholders' | 'documents';

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

export enum EquityMode {
  SUM_OF_MONEY = 'Sum of Money',
  INSTALMENTS = 'Instalments',
  PCT_LAND = '% of Land Price',
  PCT_TOTAL_COST = '% of Total Cost',
  PCT_MONTHLY = '% of Monthly Spend'
}

export enum InterestRateMode {
  SINGLE = 'Single Rate',
  VARIABLE = 'Variable/Step'
}

export enum FeeBase {
  PERCENT = '% of Limit',
  FIXED = 'Fixed Amount'
}

export enum DebtLimitMethod {
  FIXED = 'Fixed Limit',
  LTC = '% of Cost (LTC)',
  LVR = '% of Value (LVR)'
}

export type RevenueStrategy = 'Sell' | 'Hold';
export type RevenueCalcMode = 'LUMP_SUM' | 'QUANTITY_RATE';

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
  escalationRate: number;
  gstTreatment: GstTreatment;
  linkToMilestone?: MilestoneLink;
  calculationLink?: CalculationLink;
}

export interface RevenueItem {
  id: string;
  description: string;
  strategy: RevenueStrategy;
  calcMode: RevenueCalcMode;
  units: number;
  pricePerUnit: number;
  offsetFromCompletion: number;
  settlementSpan: number;
  commissionRate: number;
  isTaxable: boolean;
  absorptionRate?: number;
  weeklyRent?: number;
  opexRate?: number;
  vacancyFactorPct?: number;
  leaseUpMonths?: number;
  isCapitalised?: boolean;
  capRate?: number;
}

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
  isInterestCapitalised: boolean;
}

export interface CapitalStack {
  senior: CapitalTier;
  mezzanine: CapitalTier;
  equity: {
    mode: EquityMode;
    initialContribution: number;
    instalments: DatedAmount[];
    percentageInput: number;
    includeAcquisitionCosts?: boolean;
  };
  jv: {
    enabled: boolean;
    partnerName: string;
    equitySplitPct: number;
    profitSharePct: number;
  };
  surplusInterestRate: number;
}

export interface FeasibilitySettings {
  description?: string;
  projectName?: string;
  inputScale?: InputScale;
  acquisition: {
    purchasePrice: number;
    settlementPeriod: number;
    depositPercent: number;
    stampDutyState: TaxState;
    stampDutyTiming: 'EXCHANGE' | 'SETTLEMENT';
    // Added stampDutyOverride property to support migration and override functionality
    stampDutyOverride?: number;
    isForeignBuyer: boolean;
    buyersAgentFee: number;
    legalFeeEstimate: number;
  };
  startDate: string;
  durationMonths: number;
  constructionDelay: number;
  growth: {
    constructionEscalation: number;
    rentalGrowth: number;
    landAppreciation: number;
    salesPriceEscalation: number;
    cpi: number;
  };
  holdStrategy?: {
    refinanceLvr: number;
    refinanceMonth: number;
    investmentRate: number;
    holdPeriodYears: number;
    annualCapitalGrowth: number;
    terminalCapRate: number;
    depreciationSplit: {
      capitalWorksPct: number;
      plantPct: number;
    };
  };
  discountRate: number;
  gstRate: number;
  totalUnits: number;
  useMarginScheme: boolean;
  defaultEscalationRate: number;
  capitalStack: CapitalStack;
}

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

export interface Site {
  id: string;
  code: string;
  name: string;
  thumbnail: string;
  status: LeadStatus;
  stage: ProjectStage;
  pm?: string;
  openTasks: number;
  openRFIs: number;
  conditions?: number;
  createdAt: string;
  updatedAt: string;
  dna: SiteDNA;
  stakeholders: Stakeholder[];
  scenarios: FeasibilityScenario[];
}

export interface MonthlyFlow {
  monthIndex: number;
  label: string;
  grossRevenue: number;
  gstOnSales: number;
  netRevenue: number;
  developmentCosts: number;
  gstOnCosts: number;
  netCashflow: number;
  drawDownSenior: number;
  repaySenior: number;
  balanceSenior: number;
  interestSenior: number;
  lineFeeSenior: number;
  drawDownMezz: number;
  repayMezz: number;
  balanceMezz: number;
  interestMezz: number;
  drawDownEquity: number;
  repayEquity: number;
  balanceEquity: number;
  lendingInterestIncome: number;
  costBreakdown: Record<string, number>;
  investmentInterest: number;
  depreciation: number;
  landTaxLiability: number;
  statutoryValue: number;
  assetValue: number;
  inflationFactor: number;
}

export interface ItemisedRow {
  label: string;
  values: number[];
  total: number;
}

export interface ItemisedCategory {
  name: string;
  rows: ItemisedRow[];
}

export interface ItemisedCashflow {
  headers: string[];
  categories: ItemisedCategory[];
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
