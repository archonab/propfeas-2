
export enum DistributionMethod {
  LINEAR = 'Linear',
  S_CURVE = 'S-Curve',
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
  escalationRate: number;
  isTaxable: boolean;
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

export interface FeasibilitySettings {
  projectName: string;
  description: string;
  location: string;
  startDate: string;
  durationMonths: number;
  discountRate: number;
  gstRate: number;
  interestRate: number;
  totalUnits: number;
  status?: ScenarioStatus;
  equityContribution?: number;
  useMarginScheme: boolean;
  landLVR: number;
  constructionFundingPct: number;
}

export interface MonthlyFlow {
  month: number;
  label: string;
  outflow: number;
  inflow: number;
  net: number;
  cumulative: number;
  interest: number;
  debtBalance: number;
  equityOutflow: number;
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
