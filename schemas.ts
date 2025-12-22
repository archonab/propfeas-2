
import { z } from 'zod';
import { 
  DistributionMethod, InputType, InputScale, CostCategory, GstTreatment, ScenarioStatus, 
  MilestoneLink, DebtLimitMethod, InterestRateMode, FeeBase, EquityMode, 
  TaxState, PermitStatus, FloodZone, StakeholderRole,
  RevenueStrategy, RevenueCalcMode
} from './types';

// --- ENUMS & CONSTANTS ---
const LineItemTagSchema = z.enum([
  'LAND_PRICE', 'STAMP_DUTY', 'LEGAL_PURCHASE', 'AGENT_FEE', 
  'LEGAL_SALES', 'COUNCIL_RATES', 'LAND_TAX', 'NONE'
]);

const CalculationLinkSchema = z.enum([
  'AUTO_STAMP_DUTY', 'AUTO_LAND_TAX', 'AUTO_COUNCIL_RATES', 'NONE'
]);

const RevenueItemTagSchema = z.enum([
  'GROSS_SALES', 'OTHER_INCOME', 'NONE'
]);

// --- SUB-SCHEMAS ---

export const LineItemSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  category: z.nativeEnum(CostCategory),
  description: z.string().min(1, "Description required"),
  inputType: z.nativeEnum(InputType),
  amount: z.number().safe("Amount must be a valid number"),
  startDate: z.number().int(),
  span: z.number().int().min(1, "Duration must be at least 1 month"),
  linkToMilestone: z.nativeEnum(MilestoneLink).optional(),
  method: z.nativeEnum(DistributionMethod),
  escalationRate: z.number().min(0).default(0),
  gstTreatment: z.nativeEnum(GstTreatment),
  sCurveSteepness: z.number().optional(),
  milestones: z.record(z.number(), z.number()).optional(),
  specialTag: LineItemTagSchema.optional(),
  calculationLink: CalculationLinkSchema.optional()
});

export const RevenueItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  strategy: z.enum(['Sell', 'Hold']), // Zod enum from string literals matching type
  calcMode: z.enum(['LUMP_SUM', 'QUANTITY_RATE']),
  units: z.number().int().min(0),
  pricePerUnit: z.number().safe(),
  absorptionRate: z.number().min(0).optional(),
  commissionRate: z.number().min(0).max(100),
  isTaxable: z.boolean(),
  weeklyRent: z.number().min(0).optional(),
  opexRate: z.number().min(0).max(100).optional(),
  vacancyFactorPct: z.number().min(0).max(100).optional(),
  leaseUpMonths: z.number().int().min(0).optional(),
  isCapitalised: z.boolean().optional(),
  capRate: z.number().min(0).optional(),
  offsetFromCompletion: z.number().int(),
  settlementSpan: z.number().int().min(0),
  specialTag: RevenueItemTagSchema.optional()
});

const CapitalTierSchema = z.object({
  rateMode: z.nativeEnum(InterestRateMode),
  interestRate: z.number().min(0),
  variableRates: z.array(z.object({
    id: z.string(),
    month: z.number().int(),
    rate: z.number()
  })),
  establishmentFeeBase: z.nativeEnum(FeeBase),
  establishmentFee: z.number().min(0),
  lineFeePct: z.number().min(0).optional(),
  limitMethod: z.nativeEnum(DebtLimitMethod).optional(),
  limit: z.number().optional(),
  activationMonth: z.number().int().optional(),
  isInterestCapitalised: z.boolean().optional()
});

const EquityStructureSchema = z.object({
  mode: z.nativeEnum(EquityMode),
  initialContribution: z.number(),
  instalments: z.array(z.object({
    id: z.string(),
    month: z.number().int(),
    amount: z.number()
  })),
  percentageInput: z.number().min(0).max(100)
});

const JointVentureSchema = z.object({
  enabled: z.boolean(),
  partnerName: z.string(),
  equitySplitPct: z.number().min(0).max(100),
  profitSharePct: z.number().min(0).max(100)
});

const CapitalStackSchema = z.object({
  senior: CapitalTierSchema,
  mezzanine: CapitalTierSchema,
  equity: EquityStructureSchema,
  jv: JointVentureSchema,
  surplusInterestRate: z.number().min(0)
});

const AcquisitionSettingsSchema = z.object({
  purchasePrice: z.number().min(0),
  settlementPeriod: z.number().int().min(0),
  depositPercent: z.number().min(0).max(100),
  stampDutyState: z.enum(['VIC', 'NSW', 'QLD']),
  stampDutyTiming: z.enum(['EXCHANGE', 'SETTLEMENT']),
  stampDutyOverride: z.number().optional(),
  isForeignBuyer: z.boolean(),
  buyersAgentFee: z.number().min(0),
  legalFeeEstimate: z.number().min(0)
});

export const FeasibilitySettingsSchema = z.object({
  description: z.string().optional(),
  projectName: z.string().optional(),
  inputScale: z.nativeEnum(InputScale).optional(),
  acquisition: AcquisitionSettingsSchema,
  startDate: z.string(), // ISO String check handled by date parse if strictly needed, string OK for inputs
  durationMonths: z.number().int().min(1),
  constructionDelay: z.number().int().min(0),
  growth: z.object({
    constructionEscalation: z.number(),
    rentalGrowth: z.number(),
    landAppreciation: z.number(),
    salesPriceEscalation: z.number(),
    cpi: z.number()
  }),
  holdStrategy: z.object({
    refinanceMonth: z.number().int().min(0),
    refinanceLvr: z.number().min(0).max(100),
    investmentRate: z.number().min(0),
    holdPeriodYears: z.number().int().min(0),
    annualCapitalGrowth: z.number(),
    terminalCapRate: z.number(),
    depreciationSplit: z.object({
      capitalWorksPct: z.number().min(0).max(100),
      plantPct: z.number().min(0).max(100)
    })
  }).optional(),
  discountRate: z.number(),
  gstRate: z.number().min(0).max(100),
  totalUnits: z.number().int().min(0),
  useMarginScheme: z.boolean(),
  defaultEscalationRate: z.number().optional(),
  capitalStack: CapitalStackSchema
});

// --- CORE SCHEMAS ---

export const SiteDNASchema = z.object({
  address: z.string(),
  state: z.enum(['VIC', 'NSW', 'QLD']),
  landArea: z.number().min(0),
  lga: z.string(),
  zoning: z.string(),
  zoningCode: z.string().optional(),
  overlays: z.array(z.string()),
  permitStatus: z.string().optional(), // Using string literal types in TS, z.enum if strictly constrained
  floodZone: z.string().optional(),
  contaminationStatus: z.string().optional(),
  auv: z.number().optional(),
  acv: z.number().optional(),
  titleReference: z.string().optional(),
  ownershipEntity: z.string().optional(),
  easements: z.string().optional(),
  covenants: z.string().optional(),
  geometry: z.object({ lat: z.number(), lng: z.number() }).optional(),
  propertyId: z.string().optional(),
  agent: z.object({ name: z.string(), company: z.string(), email: z.string().optional(), phone: z.string().optional() }),
  vendor: z.object({ name: z.string(), company: z.string().optional() }),
  milestones: z.object({
    acquisitionDate: z.string().optional(),
    settlementDate: z.string().optional(),
    constructionStartDate: z.string().optional(),
    completionDate: z.string().optional(),
    eoiCloseDate: z.string().optional()
  })
});

export const FeasibilityScenarioSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  isBaseline: z.boolean(),
  status: z.nativeEnum(ScenarioStatus),
  strategy: z.enum(['SELL', 'HOLD']),
  linkedSellScenarioId: z.string().optional(),
  settings: FeasibilitySettingsSchema,
  costs: z.array(LineItemSchema),
  revenues: z.array(RevenueItemSchema)
});

// --- VALIDATION HELPER ---

export const safeParseScenario = (data: unknown) => {
  const result = FeasibilityScenarioSchema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data, errors: null };
  }
  return { ok: false, data: null, errors: result.error.format() };
};
