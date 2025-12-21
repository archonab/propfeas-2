
import { CostCategory, DistributionMethod, FeasibilitySettings, LineItem, RevenueItem, InputType, ScenarioStatus, SiteLead, EquityMode, InterestRateMode, FeeBase, DebtLimitMethod, GstTreatment } from './types';

export const MOCK_SITES: SiteLead[] = [
  // --- Active Portfolio (Acquired) ---
  {
    id: 'p1',
    code: 'ACT-SYD-001',
    name: "Kings Hill Development",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Acquired',
    stage: 'Planning',
    pm: 'Sarah Mitchell',
    openTasks: 14,
    openRFIs: 3,
    conditions: 8,
    dna: {
      address: "Kings Hill, NSW",
      landArea: 1250,
      lga: "Sydney City Council",
      zoning: "R4 High Density",
      overlays: ["Heritage Facade"],
      agent: { name: "Tom Ford", company: "Ray White Commercial" },
      vendor: { name: "Private Holding Co." },
      milestones: { acquisitionDate: "2023-01-15", settlementDate: "2023-06-30" }
    }
  },
  {
    id: 'p2',
    code: 'ACT-MEL-042',
    name: "Parkside Estate",
    thumbnail: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Acquired',
    stage: 'Construction',
    pm: 'John Davis',
    openTasks: 27,
    openRFIs: 5,
    conditions: 2,
    dna: {
      address: "St Kilda, VIC",
      landArea: 840,
      lga: "Port Phillip",
      zoning: "Mixed Use",
      overlays: [],
      agent: { name: "Emily Blunt", company: "JLL" },
      vendor: { name: "InvestCorp" },
      milestones: { acquisitionDate: "2022-08-10" }
    }
  },
  // --- Prospects (Pipeline) ---
  {
    id: 'prospect-1',
    code: 'LEAD-089',
    name: "142 O'Riordan St",
    thumbnail: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Prospect',
    stage: 'Analysis',
    pm: 'Unassigned',
    openTasks: 0,
    openRFIs: 0,
    conditions: 0,
    dna: {
      address: "Mascot, NSW",
      landArea: 2100,
      lga: "Bayside Council",
      zoning: "B4 Mixed Use",
      overlays: ["Airport Height Ops"],
      agent: { name: "Pending", company: "CBRE" },
      vendor: { name: "Logistics REIT" },
      milestones: {}
    }
  },
  {
    id: 'prospect-2',
    code: 'LEAD-092',
    name: "The Old Mill Site",
    thumbnail: "https://images.unsplash.com/photo-1516156008625-3a9d60da923c?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Prospect',
    stage: 'Analysis',
    pm: 'Unassigned',
    openTasks: 0,
    openRFIs: 0,
    conditions: 0,
    dna: {
      address: "Bowden, SA",
      landArea: 4500,
      lga: "Charles Sturt",
      zoning: "Urban Corridor",
      overlays: ["Contamination"],
      agent: { name: "Local Agent", company: "Harris RE" },
      vendor: { name: "State Govt" },
      milestones: {}
    }
  },
  {
    id: 'prospect-3',
    code: 'LEAD-104',
    name: "Coastal Infill Opp",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=400&h=250&auto=format&fit=crop",
    status: 'Due Diligence',
    stage: 'Acquisition',
    pm: 'Emma Wilson',
    openTasks: 2,
    openRFIs: 0,
    conditions: 0,
    dna: {
      address: "Gold Coast, QLD",
      landArea: 600,
      lga: "Gold Coast City",
      zoning: "High Density Res",
      overlays: [],
      agent: { name: "Mike Ross", company: "Colliers" },
      vendor: { name: "Private" },
      milestones: { acquisitionDate: "2024-05-01" }
    }
  }
];

export const INITIAL_SETTINGS: FeasibilitySettings = {
  projectName: "Scenario A: Base Case",
  description: "Standard residential feasibility",
  
  // Site DNA (Default)
  site: {
    address: "New Site, NSW",
    landArea: 1000,
    lga: "Pending",
    zoning: "Pending",
    overlays: [],
    agent: { name: "", company: "" },
    vendor: { name: "" },
    milestones: {}
  },

  startDate: "2024-06-01",
  durationMonths: 24,
  discountRate: 15, // Project Discount Rate
  gstRate: 10,
  totalUnits: 20,
  status: ScenarioStatus.DRAFT,
  useMarginScheme: true,
  
  capitalStack: {
    surplusInterestRate: 2.5,
    equity: {
      mode: EquityMode.SUM_OF_MONEY,
      initialContribution: 2000000,
      instalments: [],
      percentageInput: 20,
    },
    senior: {
      rateMode: InterestRateMode.SINGLE,
      interestRate: 6.5,
      variableRates: [],
      establishmentFeeBase: FeeBase.PERCENT,
      establishmentFee: 1.0,
      limitMethod: DebtLimitMethod.FIXED,
      isInterestCapitalised: true,
      activationMonth: 0
    },
    mezzanine: {
      rateMode: InterestRateMode.SINGLE,
      interestRate: 12.0,
      variableRates: [],
      establishmentFeeBase: FeeBase.PERCENT,
      establishmentFee: 2.0,
      limit: 1500000,
      limitMethod: DebtLimitMethod.FIXED,
      isInterestCapitalised: true,
      activationMonth: 0
    }
  }
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
    gstTreatment: GstTreatment.MARGIN_SCHEME
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
    gstTreatment: GstTreatment.TAXABLE
  }
];

export const INITIAL_REVENUE: RevenueItem[] = [
  {
    id: 'r1',
    description: 'Standard Sales',
    units: 20,
    strategy: 'Sell',
    pricePerUnit: 850000,
    exchangeDate: 12,
    settlementDate: 24,
    commissionRate: 2.0,
    isTaxable: true
  }
];
