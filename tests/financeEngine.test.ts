
import { describe, it, expect } from 'vitest';
import { FinanceEngine } from '../services/financeEngine';
import { 
  FeasibilityScenario, ScenarioStatus, CostCategory, 
  InputType, DistributionMethod, GstTreatment, DebtLimitMethod, InterestRateMode, FeeBase, EquityMode,
  SiteDNA, FeasibilitySettings, MilestoneLink 
} from '../types';
import { DEFAULT_TAX_SCALES } from '../constants';
import Decimal from 'decimal.js';

// --- MOCK DATA FACTORIES ---
const createMockSettings = (): FeasibilitySettings => ({
  description: 'Test',
  projectName: 'Test Project',
  acquisition: {
    purchasePrice: 1000000,
    settlementPeriod: 1,
    depositPercent: 10,
    stampDutyState: 'VIC',
    stampDutyTiming: 'SETTLEMENT',
    isForeignBuyer: false,
    buyersAgentFee: 0,
    legalFeeEstimate: 0
  },
  startDate: '2024-01-01',
  durationMonths: 12,
  constructionDelay: 0,
  growth: { constructionEscalation: 0, rentalGrowth: 0, landAppreciation: 0, salesPriceEscalation: 0, cpi: 0 },
  discountRate: 10,
  gstRate: 10,
  totalUnits: 10,
  useMarginScheme: false,
  capitalStack: {
    surplusInterestRate: 0,
    equity: { mode: EquityMode.SUM_OF_MONEY, initialContribution: 500000, instalments: [], percentageInput: 0 },
    jv: { enabled: false, partnerName: '', equitySplitPct: 0, profitSharePct: 0 },
    senior: {
      rateMode: InterestRateMode.SINGLE, interestRate: 5.0, variableRates: [],
      establishmentFeeBase: FeeBase.FIXED, establishmentFee: 0, lineFeePct: 0,
      limitMethod: DebtLimitMethod.FIXED, limit: 2000000, isInterestCapitalised: true, activationMonth: 0
    },
    mezzanine: { rateMode: InterestRateMode.SINGLE, interestRate: 0, variableRates: [], establishmentFeeBase: FeeBase.FIXED, establishmentFee: 0, isInterestCapitalised: true }
  }
});

const createMockScenario = (strategy: 'SELL' | 'HOLD' = 'SELL'): FeasibilityScenario => ({
  id: 'test-1',
  name: 'Test Scenario',
  createdAt: '', updatedAt: '',
  isBaseline: true,
  status: ScenarioStatus.DRAFT,
  strategy,
  settings: createMockSettings(),
  costs: [],
  revenues: []
});

const mockSiteDNA: SiteDNA = {
  address: '123 Test St', state: 'VIC', landArea: 1000, lga: '', zoning: '', overlays: [],
  agent: { name: '', company: '' }, vendor: { name: '' }, milestones: {}
};

describe('FinanceEngine Pure Modules', () => {
  const { buildTimeline, calcCostSchedule, calcRevenueSchedule, calcTaxSchedule, calcFundingSchedule } = FinanceEngine._internal;

  describe('1. Simple SELL Scenario', () => {
    it('should correctly distribute linear construction costs', () => {
      const scenario = createMockScenario('SELL');
      scenario.costs.push({
        id: 'c1', code: 'C1', category: CostCategory.CONSTRUCTION, description: 'Build',
        inputType: InputType.FIXED, amount: 120000, startDate: 1, span: 4,
        method: DistributionMethod.LINEAR, escalationRate: 0, gstTreatment: GstTreatment.TAXABLE
      });

      // Run Pipeline
      const timeline = buildTimeline(scenario);
      const costs = calcCostSchedule(scenario, mockSiteDNA, timeline, undefined, DEFAULT_TAX_SCALES);
      
      // Check Middle Months (Start at Month 1 + Settlement 1 = Month 2 effectively?)
      // Timeline: Settlement is Month 1. Const Delay 0. Const Start = Month 1.
      // Item Start 1 = Month 1 + 1 = Month 2.
      // Span 4: Month 2, 3, 4, 5.
      // Amount 120k / 4 = 30k. + GST = 33k.
      
      expect(costs[2].totalNet.toNumber()).toBeCloseTo(33000); 
      expect(costs[3].totalNet.toNumber()).toBeCloseTo(33000);
      expect(costs[6].totalNet.toNumber()).toBe(0);
    });

    it('should calculate revenue based on absorption', () => {
      const scenario = createMockScenario('SELL');
      scenario.revenues.push({
        id: 'r1', description: 'Units', strategy: 'Sell', calcMode: 'QUANTITY_RATE',
        units: 10, pricePerUnit: 100000, absorptionRate: 5,
        offsetFromCompletion: 0, settlementSpan: 2, commissionRate: 0, isTaxable: true
      });
      // Settlement 1, Duration 12. End = Month 13.
      // Offset 0 -> Sales start Month 13.
      // 10 units, 5/mo -> Month 13 (5 units), Month 14 (5 units).
      // Revenue = 5 * 100k = 500k.

      const timeline = buildTimeline(scenario);
      const revs = calcRevenueSchedule(scenario, timeline);

      expect(revs[13].gross.toNumber()).toBeCloseTo(500000);
      expect(revs[14].gross.toNumber()).toBeCloseTo(500000);
      expect(revs[15].gross.toNumber()).toBe(0);
    });
  });

  describe('2. HOLD Scenario (Linked)', () => {
    it('should calculate operating phase statutory costs correctly', () => {
      const linkedBase = createMockScenario('SELL');
      linkedBase.settings.durationMonths = 12; // Construction ends M12
      
      const holdScenario = createMockScenario('HOLD');
      holdScenario.settings.holdStrategy = {
        refinanceMonth: 12, refinanceLvr: 60, investmentRate: 5,
        holdPeriodYears: 1, annualCapitalGrowth: 0, terminalCapRate: 5, depreciationSplit: { capitalWorksPct: 0, plantPct: 0 }
      };
      
      const timeline = buildTimeline(holdScenario, linkedBase);
      // Horizon = 12 (Base) + 12 (Hold) = 24.
      
      const costs = calcCostSchedule(holdScenario, { ...mockSiteDNA, auv: 1000000 }, timeline, linkedBase, DEFAULT_TAX_SCALES);
      
      // Land Tax should trigger annually in operating phase.
      // Refi Month = 12. Operating starts M12.
      // M12 is first month of Op. Should have Tax.
      
      expect(costs[12].breakdown[CostCategory.STATUTORY]).toBeGreaterThan(0);
    });
  });

  describe('3. Milestone Distribution', () => {
    it('should place costs at Settlement milestone', () => {
      const scenario = createMockScenario();
      scenario.settings.acquisition.settlementPeriod = 3;
      scenario.costs.push({
        id: 'c1', code: 'C1', category: CostCategory.CONSULTANTS, description: 'Fee',
        inputType: InputType.FIXED, amount: 10000, startDate: 0, span: 1,
        linkToMilestone: MilestoneLink.ACQUISITION,
        method: DistributionMethod.UPFRONT, escalationRate: 0, gstTreatment: GstTreatment.GST_FREE
      });

      const timeline = buildTimeline(scenario);
      const costs = calcCostSchedule(scenario, mockSiteDNA, timeline, undefined, DEFAULT_TAX_SCALES);

      // Settlement is Month 3. Item offset 0. Expect cost at Month 3.
      expect(costs[3].totalNet.toNumber()).toBe(10000);
      expect(costs[2].totalNet.toNumber()).toBe(0);
    });
  });

  describe('4. Debt & Interest', () => {
    it('should calculate simple interest correctly', () => {
      const scenario = createMockScenario();
      scenario.settings.capitalStack.senior.interestRate = 12.0; // 1% per month
      scenario.settings.capitalStack.equity.initialContribution = 0; // Force debt
      
      // Cost at M1 = 100k
      const timeline = buildTimeline(scenario);
      const costSchedule = Array(timeline.horizonMonths + 1).fill(null).map(() => ({ totalNet: new Decimal(0), totalGST: new Decimal(0), breakdown: {} }));
      costSchedule[1].totalNet = new Decimal(100000); // 100k outflow M1
      
      const revSchedule = Array(timeline.horizonMonths + 1).fill(null).map(() => ({ gross: new Decimal(0), net: new Decimal(0), gstLiability: new Decimal(0), sellingCosts: new Decimal(0), rentalOpex: new Decimal(0), terminalValue: new Decimal(0) }));
      const taxSchedule = Array(timeline.horizonMonths + 1).fill(null).map(() => ({ netGstMovement: new Decimal(0), liability: new Decimal(0), credits: new Decimal(0), cumulativeCredits: new Decimal(0) }));

      const flows = calcFundingSchedule(timeline, costSchedule as any, revSchedule, taxSchedule, scenario.settings);

      // M1: Draw 100k. Balance 100k.
      expect(flows[1].drawDownSenior).toBeCloseTo(100000);
      expect(flows[1].balanceSenior).toBeCloseTo(100000);
      
      // M2: Interest on 100k @ 1% = 1k. Balance becomes 101k.
      expect(flows[2].interestSenior).toBeCloseTo(1000);
      expect(flows[2].balanceSenior).toBeCloseTo(101000);
    });
  });

  describe('5. Stamp Duty', () => {
    it('should calculate VIC stamp duty correctly', () => {
      // Test Bracket: > 960k in VIC is 5.5% flat (Investment)
      const duty = FinanceEngine.calculateStampDuty(1000000, 'VIC', false);
      expect(duty).toBe(55000); // 5.5% of 1M
    });
    
    it('should apply foreign purchaser surcharge', () => {
        const duty = FinanceEngine.calculateStampDuty(1000000, 'VIC', true);
        // Base 55,000 + Surcharge 8% (80,000) = 135,000
        expect(duty).toBe(135000);
    });
  });
});
