
import { describe, it, expect } from 'vitest';
import { FinanceEngine } from '../services/financeEngine';
import { ReportService } from '../services/reportModel';
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

      const timeline = buildTimeline(scenario);
      const costs = calcCostSchedule(scenario, mockSiteDNA, timeline, undefined, DEFAULT_TAX_SCALES);
      
      expect(costs[2].totalNet.toNumber()).toBeCloseTo(33000); 
      expect(costs[3].totalNet.toNumber()).toBeCloseTo(33000);
      expect(costs[6].totalNet.toNumber()).toBe(0);
    });
  });

  describe('2. Implicit Land Cashflows', () => {
    it('should generate implicit land items in itemised report', () => {
      const scenario = createMockScenario();
      scenario.settings.acquisition.purchasePrice = 1000000;
      scenario.settings.acquisition.depositPercent = 10;
      
      // We expect the itemised report to contain a Deposit item and Settlement item
      // even though scenario.costs is empty
      const itemised = FinanceEngine.generateItemisedCashflowData(scenario, mockSiteDNA, DEFAULT_TAX_SCALES);
      
      const landCat = itemised.categories.find(c => c.name === 'Land & Acquisition');
      expect(landCat).toBeDefined();
      
      const depositRow = landCat?.rows.find(r => r.label === 'Land Deposit');
      const settleRow = landCat?.rows.find(r => r.label === 'Land Settlement');
      
      expect(depositRow).toBeDefined();
      expect(depositRow?.total).toBe(100000); // 10% of 1M
      expect(settleRow).toBeDefined();
      expect(settleRow?.total).toBe(900000); // 90% of 1M
    });
  });

  describe('3. IRR & Stability', () => {
    it('should return null for divergent IRR', () => {
      // Cashflow with only positive numbers -> Infinite IRR
      const flows = [100, 100, 100];
      const irr = FinanceEngine.calculateIRR(flows);
      expect(irr).toBeNull();
    });

    it('should calculate correct annualised IRR for simple case', () => {
      // Invest 100, Return 110 in 1 month -> 10% monthly yield
      // Annualised = (1.1)^12 - 1 ~= 213%
      const flows = [-100, 110];
      const irr = FinanceEngine.calculateIRR(flows);
      
      // Monthly rate is 0.1
      const expectedAnnual = (Math.pow(1.1, 12) - 1) * 100;
      expect(irr).toBeCloseTo(expectedAnnual, 1);
    });
  });

  describe('4. Reconciliation Logic', () => {
    it('should maintain accounting identity: Gross Cost - ITC = Net Cost', () => {
      const scenario = createMockScenario();
      // Add a taxable cost
      scenario.costs.push({
        id: 'c1', code: 'C1', category: CostCategory.CONSTRUCTION, description: 'Build',
        inputType: InputType.FIXED, amount: 100000, startDate: 0, span: 1,
        method: DistributionMethod.UPFRONT, escalationRate: 0, gstTreatment: GstTreatment.TAXABLE
      });

      const report = ReportService.runFeasibility(scenario, mockSiteDNA);
      const rec = report.reconciliation;

      // GST is 10% of Net Amount (10,000)
      // Gross Cost is Net + GST (110,000)
      
      // Implicit Land costs are also there! 
      // Purchase Price 1M (Margin Scheme usually implies NO ITC or different handling, but our engine treats Margin Scheme input as Gross = Net currently for simplicity unless full GST logic applied)
      // Let's check the CONSTRUCTION part specifically if possible, or total.
      
      // Total Gross = Total Net + GST Credits
      // Note: This relies on floating point precision, so check closeTo
      expect(rec.totalCostGross - rec.gstInputCredits).toBeCloseTo(rec.totalCostNet, 0);
    });
  });
});
