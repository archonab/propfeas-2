
import { CostCategory, DistributionMethod, FeasibilitySettings, LineItem, RevenueItem, InputType } from './types';

// Fix: Added missing 'totalUnits' property to satisfy FeasibilitySettings type
export const INITIAL_SETTINGS: FeasibilitySettings = {
  projectName: "Bluewater View",
  description: "Twenty Townhouse Units",
  location: "Double Bay, Sydney",
  startDate: "2024-06-01",
  durationMonths: 24,
  discountRate: 15,
  gstRate: 10,
  interestRate: 7.5,
  totalUnits: 20
};

// Fix: Added missing 'code' and 'inputType' properties to each cost item to satisfy LineItem type
export const INITIAL_COSTS: LineItem[] = [
  {
    id: '1',
    code: 'C001',
    category: CostCategory.LAND,
    description: 'Land Purchase Price',
    inputType: InputType.FIXED,
    amount: 1883609,
    startDate: 0,
    span: 6,
    method: DistributionMethod.LINEAR,
    escalationRate: 0,
    isTaxable: false
  },
  {
    id: '2',
    code: 'C002',
    category: CostCategory.CONSULTANTS,
    description: 'Architect & Planning',
    inputType: InputType.FIXED,
    amount: 431998,
    startDate: 0,
    span: 12,
    method: DistributionMethod.S_CURVE,
    escalationRate: 4,
    isTaxable: true
  },
  {
    id: '3',
    code: 'C003',
    category: CostCategory.CONSTRUCTION,
    description: 'Main Works Contract',
    inputType: InputType.FIXED,
    amount: 7187144,
    startDate: 6,
    span: 18,
    method: DistributionMethod.S_CURVE,
    escalationRate: 4,
    isTaxable: true
  }
];

export const INITIAL_REVENUE: RevenueItem[] = [
  {
    id: 'r1',
    description: 'Townhouse Units (Residential)',
    units: 20,
    pricePerUnit: 680000,
    exchangeDate: 12,
    settlementDate: 24,
    commissionRate: 2.2,
    isTaxable: true
  }
];
