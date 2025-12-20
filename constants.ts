
import { CostCategory, DistributionMethod, FeasibilitySettings, LineItem, RevenueItem, InputType, ScenarioStatus, Project } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    code: 'DAN-KIN-049',
    name: "Kings Hill Development",
    address: "Kings Hill, NSW",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Baseline',
    stage: 'Planning',
    targetFinish: '30 Jun 2026',
    pm: 'Sarah Mitchell',
    openTasks: 14,
    openRFIs: 3,
    conditions: 8
  },
  {
    id: 'p2',
    code: 'DAN-PAR-051',
    name: "Parkside Estate",
    address: "St Kilda, VIC",
    thumbnail: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Live',
    stage: 'Construction',
    targetFinish: '15 Dec 2025',
    pm: 'John Davis',
    openTasks: 27,
    openRFIs: 5,
    conditions: 2
  },
  {
    id: 'p3',
    code: 'DAN-RIV-052',
    name: "Riverside Apartments",
    address: "Brisbane, QLD",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Draft',
    stage: 'Sales',
    targetFinish: '31 Oct 2025',
    pm: 'Emma Wilson',
    openTasks: 9,
    openRFIs: 0,
    conditions: 0
  }
];

export const INITIAL_SETTINGS: FeasibilitySettings = {
  projectName: "New Scenario",
  description: "Standard residential feasibility",
  location: "Sydney, NSW",
  startDate: "2024-06-01",
  durationMonths: 24,
  discountRate: 15,
  gstRate: 10,
  interestRate: 7.5,
  totalUnits: 20,
  status: ScenarioStatus.DRAFT,
  useMarginScheme: true,
  landLVR: 65,
  constructionFundingPct: 100
};

export const INITIAL_COSTS: LineItem[] = [
  {
    id: '1',
    code: 'C001',
    category: CostCategory.LAND,
    description: 'Land Purchase Price',
    inputType: InputType.FIXED,
    amount: 5000000,
    startDate: 0,
    span: 1,
    method: DistributionMethod.UPFRONT,
    escalationRate: 0,
    isTaxable: false
  },
  {
    id: '2',
    code: 'C002',
    category: CostCategory.CONSTRUCTION,
    description: 'Civils & Foundation',
    inputType: InputType.FIXED,
    amount: 2500000,
    startDate: 3,
    span: 12,
    method: DistributionMethod.S_CURVE,
    escalationRate: 3,
    isTaxable: true
  }
];

export const INITIAL_REVENUE: RevenueItem[] = [
  {
    id: 'r1',
    description: 'Standard Sales',
    units: 20,
    pricePerUnit: 850000,
    exchangeDate: 12,
    settlementDate: 24,
    commissionRate: 2.0,
    isTaxable: true
  }
];
