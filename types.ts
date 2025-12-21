
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

// --- NEW FINANCIAL TYPES ---

export interface CapitalTier {
  interestRate: number; // % p.a.
  establishmentFee: number; // % of peak limit or facility amount
  lineFee?: number; // % p.a. on Limit (if limit set)
  limit?: number; // Optional hard limit for Mezzanine or Senior
  isInterestCapitalised?: boolean; // Default true. If false, interest is serviced monthly.
}

export interface CapitalStack {
  senior: CapitalTier;
  mezzanine: CapitalTier;
  equityContribution: number; // Fixed amount of developer equity (first loss)
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
  
  // New Capital Stack Object
  capitalStack: CapitalStack;
}

export interface MonthlyFlow {
  month: number;
  label: string;
  
  // Operational Flows
  developmentCosts: number; // Costs before finance
  netRevenue: number; // Revenue after commissions/GST
  
  // Funding Sources (Inflow to project)
  drawDownEquity: number;
  drawDownMezz: number;
  drawDownSenior: number;
  
  // Repayment Flows (Outflow from project)
  repaySenior: number;
  repayMezz: number;
  repayEquity: number; // Profit distribution
  
  // Balances (End of Month)
  balanceSenior: number;
  balanceMezz: number;
  balanceEquity: number; // Cumulative equity paid in
  
  // Costs
  interestSenior: number;
  interestMezz: number;
  
  // Totals for Charting
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
