
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
  RATE_PER_UNIT = 'Rate per Unit'
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

export enum ScenarioStatus {
  DRAFT = 'Draft',
  LOCKED = 'Locked/Baseline',
  PROMOTED = 'Promoted'
}

export interface Project {
  id: string;
  code: string;
  name: string;
  address: string;
  thumbnail: string;
  status: 'prospect' | 'active' | 'complete';
  stage: 'Analysis' | 'Acquisition' | 'Planning' | 'Construction' | 'Sales';
  targetFinish: string;
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
  isTaxable: boolean;
  
  // Advanced Distribution Settings
  sCurveSteepness?: number; // k-factor, default 10
  milestones?: Record<number, number>; // Map of relative month -> percentage (0-100)
}

export interface RevenueItem {
  id: string;
  description: string;
  units: number;
  pricePerUnit: number;
  exchangeDate: number;
  settlementDate: number;
  commissionRate: number;
  isTaxable: boolean;
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
  projectName: string;
  description: string;
  location: string;
  startDate: string;
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
  
  // Operational Flows
  developmentCosts: number; 
  netRevenue: number; 
  
  // Funding Sources
  drawDownEquity: number;
  drawDownMezz: number;
  drawDownSenior: number;
  lendingInterestIncome: number; // Interest earned on surplus
  
  // Repayment Flows
  repaySenior: number;
  repayMezz: number;
  repayEquity: number;
  
  // Balances
  balanceSenior: number;
  balanceMezz: number;
  balanceEquity: number; 
  balanceSurplus: number; // Cash at Bank
  
  // Costs
  interestSenior: number;
  interestMezz: number;
  
  // Totals
  netCashflow: number;
  cumulativeCashflow: number;
}

// ... existing Budget types ...
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
