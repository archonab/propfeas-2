
import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment, MilestoneLink, TaxConfiguration, TaxState,
  ItemisedRow, ItemisedCategory, ItemisedCashflow, ProjectMetrics, LineItemSummary
} from '../types';
import { Site, FeasibilityScenario, FeasibilitySettings } from '../types-v2';
import { TaxLibrary } from './TaxLibrary';
import { DEFAULT_TAX_SCALES } from '../constants';

// --- INTERNAL TYPES FOR PURE PIPELINE ---
interface TimelineContext {
  horizonMonths: number;
  settlementMonth: number;
  constStartMonth: number;
  constEndMonth: number;
  refiMonthOffset: number;
  actualRefiMonth: number;
  isOperatingPhase: (m: number) => boolean;
  isQuarterEnd: boolean[]; // Pre-calculated to avoid Date objects in loops
  monthLabels: string[];
  inflationFactors: Decimal[];
}

interface CostFlow {
  totalNet: Decimal;
  totalGST: Decimal; // Input Tax Credits
  breakdown: Record<CostCategory, number>; // Kept as number for compatibility with MonthlyFlow output
}

interface RevenueFlow {
  gross: Decimal;
  net: Decimal; // After Opex/Agents
  gstLiability: Decimal;
  sellingCosts: Decimal;
  rentalOpex: Decimal;
  terminalValue: Decimal;
}

interface TaxFlow {
  netGstMovement: Decimal; // Cashflow impact (Refunds or Payments)
  liability: Decimal;
  credits: Decimal;
  cumulativeCredits: Decimal;
}

// --- HELPER: MATH ---
// Error Function for Bell Curve (Pure Math)
const erf = (x: number) => {
  var sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  var a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741, a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  var t = 1.0 / (1.0 + p*x);
  var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
  return sign*y;
};

// --- HELPER: DATE & FORMATTING ---
export const getMonthLabel = (startDate: string, offset: number): string => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + offset);
  const month = d.toLocaleString('default', { month: 'short' });
  const year = d.getFullYear().toString().substr(2, 2);
  return `${month} ${year}`;
};

// --- HELPER: ANNUALISATION ---
export const annualiseMonthlyRate = (monthlyRate: number): number => {
  // Effective Annual Rate = (1 + monthly)^12 - 1
  return Math.pow(1 + monthlyRate, 12) - 1;
};

// --- HELPER: STAMP DUTY ---
const calculateStampDuty = (
    price: number, 
    state: TaxState, 
    isForeign: boolean, 
    scales: TaxConfiguration = DEFAULT_TAX_SCALES,
    manualOverride?: number
): number => {
  if (manualOverride !== undefined && manualOverride !== null && manualOverride >= 0) {
      return manualOverride;
  }
  let duty = TaxLibrary.calculateTax(price, scales, state, 'STAMP_DUTY');
  if (isForeign) {
    const surchargeRate = state === 'QLD' ? 0.07 : 0.08;
    duty += (price * surchargeRate);
  }
  return duty;
};

// --- HELPER: GENERATE IMPLICIT LAND ITEMS ---
// This ensures Land costs appear in itemised reports exactly as they do in the cashflow
const getImplicitAcquisitionCosts = (settings: FeasibilitySettings, site: Site, taxScales: TaxConfiguration): LineItem[] => {
    const { acquisition } = site;
    const items: LineItem[] = [];
    const price = acquisition.purchasePrice;
    
    // 1. Deposit
    const depositAmt = price * (acquisition.depositPercent / 100);
    if (depositAmt > 0) {
        items.push({
            id: 'IMP-DEPOSIT',
            code: 'LND-DEP',
            category: CostCategory.LAND,
            description: 'Land Deposit',
            inputType: InputType.FIXED,
            amount: depositAmt,
            startDate: 0,
            span: 1,
            method: DistributionMethod.UPFRONT,
            escalationRate: 0,
            gstTreatment: GstTreatment.MARGIN_SCHEME // Assuming Margin Scheme for Land usually
        });
    }

    // 2. Settlement
    const settlementAmt = price - depositAmt;
    if (settlementAmt > 0) {
        items.push({
            id: 'IMP-SETTLE',
            code: 'LND-SET',
            category: CostCategory.LAND,
            description: 'Land Settlement',
            inputType: InputType.FIXED,
            amount: settlementAmt,
            startDate: acquisition.settlementPeriod || 0, // Absolute month relative to start
            span: 1,
            method: DistributionMethod.UPFRONT,
            escalationRate: 0,
            gstTreatment: GstTreatment.MARGIN_SCHEME
        });
    }

    // 3. Stamp Duty
    const dutyAmt = calculateStampDuty(price, acquisition.stampDutyState, acquisition.isForeignBuyer, taxScales, acquisition.stampDutyOverride);
    if (dutyAmt > 0) {
        items.push({
            id: 'IMP-DUTY',
            code: 'STAT-DUTY',
            category: CostCategory.STATUTORY,
            description: `Stamp Duty (${acquisition.stampDutyState})`,
            inputType: InputType.FIXED,
            amount: dutyAmt,
            startDate: acquisition.stampDutyTiming === 'EXCHANGE' ? 0 : (acquisition.settlementPeriod || 0),
            span: 1,
            method: DistributionMethod.UPFRONT,
            escalationRate: 0,
            gstTreatment: GstTreatment.GST_FREE
        });
    }

    // 4. Legal Fees
    if (acquisition.legalFeeEstimate && acquisition.legalFeeEstimate > 0) {
        items.push({
            id: 'IMP-LEGAL',
            code: 'LND-LEG',
            category: CostCategory.LAND,
            description: 'Acquisition Legal Fees',
            inputType: InputType.FIXED,
            amount: acquisition.legalFeeEstimate,
            startDate: 0,
            span: 1,
            method: DistributionMethod.UPFRONT,
            escalationRate: 0,
            gstTreatment: GstTreatment.TAXABLE
        });
    }

    // 5. Agent Fees
    const agentAmt = price * ((acquisition.buyersAgentFee || 0) / 100);
    if (agentAmt > 0) {
        items.push({
            id: 'IMP-AGENT',
            code: 'LND-AGT',
            category: CostCategory.CONSULTANTS,
            description: "Buyer's Agent Fee",
            inputType: InputType.FIXED,
            amount: agentAmt,
            startDate: acquisition.settlementPeriod || 0,
            span: 1,
            method: DistributionMethod.UPFRONT,
            escalationRate: 0,
            gstTreatment: GstTreatment.TAXABLE
        });
    }

    return items;
};

// --- HELPER: LINE ITEM TOTAL ---
export const calculateLineItemTotal = (
  item: LineItem, 
  settings: FeasibilitySettings, 
  site: Site,
  constructionSum: number, 
  totalRevenue: number,
  scales: TaxConfiguration = DEFAULT_TAX_SCALES
): number => {
  // Automated Statutory Links
  if (item.calculationLink && item.calculationLink !== 'NONE') {
      const state = site.acquisition.stampDutyState as TaxState;
      switch (item.calculationLink) {
          case 'AUTO_STAMP_DUTY':
              return calculateStampDuty(
                  site.acquisition.purchasePrice,
                  state,
                  site.acquisition.isForeignBuyer,
                  scales,
                  site.acquisition.stampDutyOverride
              );
          case 'AUTO_LAND_TAX':
              return TaxLibrary.calculateTax(site.identity.auv || 0, scales, state, 'LAND_TAX_GENERAL');
          case 'AUTO_COUNCIL_RATES':
              const rateBase = site.identity.acv || site.identity.auv || 0;
              return item.amount < 1 ? rateBase * item.amount : item.amount;
      }
  }

  // Legacy Tags
  if (item.specialTag === 'COUNCIL_RATES' || item.specialTag === 'LAND_TAX') {
      const baseValue = site.identity.auv || 0;
      if (item.specialTag === 'LAND_TAX' && item.amount === 0) {
          const state = site.acquisition.stampDutyState as TaxState;
          return TaxLibrary.calculateTax(baseValue, scales, state, 'LAND_TAX_GENERAL');
      }
      if (item.amount < 1 && item.amount > 0) return baseValue * item.amount;
      return item.amount;
  }

  const val = new Decimal(item.amount);
  switch (item.inputType) {
    case InputType.PCT_REVENUE: return val.div(100).times(totalRevenue).toNumber();
    case InputType.PCT_CONSTRUCTION: return val.div(100).times(constructionSum).toNumber();
    case InputType.RATE_PER_UNIT: return val.times(settings.totalUnits).toNumber();
    case InputType.RATE_PER_SQM: return val.times(site.identity.landArea || 0).toNumber();
    case InputType.FIXED: default: return item.amount;
  }
};

// --- PURE MODULE 1: TIMELINE ---
const buildTimeline = (
  scenario: FeasibilityScenario, 
  site: Site,
  linkedScenario?: FeasibilityScenario
): TimelineContext => {
  const isHold = scenario.strategy === 'HOLD';
  const baseSettings = isHold && linkedScenario ? linkedScenario.settings : scenario.settings;
  const baseCosts = isHold && linkedScenario ? linkedScenario.costs : scenario.costs;

  // SOURCE ACQUISITION FROM SITE
  const settlementPeriod = site.acquisition.settlementPeriod || 0;
  
  const constructionDelay = baseSettings.constructionDelay || 0;
  
  // Calculate Construction End based on Max Span of construction items
  const settlementMonth = settlementPeriod;
  const constStartMonth = settlementMonth + constructionDelay;
  
  let maxSpan = 0;
  baseCosts.forEach(c => {
      if (c.category === CostCategory.CONSTRUCTION && (!c.linkToMilestone || c.linkToMilestone === MilestoneLink.CONSTRUCTION_START)) {
          if (c.span > maxSpan) maxSpan = c.span;
      }
  });
  if (maxSpan === 0) maxSpan = 12; // Default fallback
  const constEndMonth = constStartMonth + maxSpan;

  // Inheritance Logic for Hold
  let refiMonthOffset = 0;
  if (isHold && linkedScenario) {
      // Logic duplicated to ensure we know exactly when the "Build" phase ends
      const linkedMilestones = buildTimeline(linkedScenario, site);
      refiMonthOffset = linkedMilestones.constEndMonth;
  }

  const holdPeriodYears = scenario.settings.holdStrategy?.holdPeriodYears || 0;
  const horizonMonths = isHold 
    ? refiMonthOffset + (holdPeriodYears * 12) 
    : baseSettings.durationMonths;

  const actualRefiMonth = isHold ? (scenario.settings.holdStrategy?.refinanceMonth || refiMonthOffset) : -1;

  // Pre-calculate Quarter Ends and Inflation
  const isQuarterEnd: boolean[] = [];
  const monthLabels: string[] = [];
  const inflationFactors: Decimal[] = [];
  const annualConstEsc = baseSettings.growth?.constructionEscalation ?? baseSettings.defaultEscalationRate ?? 3.0;

  for (let m = 0; m <= horizonMonths; m++) {
    // Inflation
    inflationFactors.push(new Decimal(Math.pow(1 + (annualConstEsc / 100), m / 12)));

    // Date Logic (Pure within the loop context if we consider the array generation pure)
    const d = new Date(baseSettings.startDate);
    d.setMonth(d.getMonth() + m);
    // BAS is usually quarterly (Mar, Jun, Sep, Dec)
    const mIndex = d.getMonth(); 
    isQuarterEnd.push((mIndex + 1) % 3 === 0);
    
    // Label
    const monthStr = d.toLocaleString('default', { month: 'short' });
    const yearStr = d.getFullYear().toString().substr(2, 2);
    monthLabels.push(`${monthStr} ${yearStr}`);
  }

  return {
    horizonMonths,
    settlementMonth,
    constStartMonth,
    constEndMonth,
    refiMonthOffset,
    actualRefiMonth,
    isOperatingPhase: (m: number) => isHold && m >= actualRefiMonth,
    isQuarterEnd,
    monthLabels,
    inflationFactors
  };
};

// --- HELPER: DISTRIBUTION ---
export const distributeValue = (total: number, currentMonth: number, item: LineItem): Decimal => {
  const totalDec = new Decimal(total);
  const span = item.span;
  if (span <= 0) return new Decimal(0);

  switch (item.method) {
    case DistributionMethod.S_CURVE: {
      const k = item.sCurveSteepness || 10; 
      const x0 = 0.5;
      const getCumulative = (t: number) => {
        const x = t / span;
        const exponent = new Decimal(-k).times(x - x0);
        const denominator = new Decimal(1).plus(Decimal.exp(exponent));
        return new Decimal(1).dividedBy(denominator);
      };
      const startPct = getCumulative(currentMonth);
      const endPct = getCumulative(currentMonth + 1);
      const minVal = getCumulative(0);
      const maxVal = getCumulative(span);
      // Normalize to ensure 100% is distributed
      const range = maxVal.minus(minVal);
      const normalizedStep = endPct.minus(startPct).div(range);
      return totalDec.times(normalizedStep);
    }
    case DistributionMethod.UPFRONT: return currentMonth === 0 ? totalDec : new Decimal(0);
    case DistributionMethod.END: return currentMonth === span - 1 ? totalDec : new Decimal(0);
    case DistributionMethod.LINEAR: default: return totalDec.div(span);
  }
};

const getEffectiveStartMonth = (item: LineItem, timeline: TimelineContext): number => {
  switch (item.linkToMilestone) {
      case MilestoneLink.ACQUISITION: return timeline.settlementMonth + item.startDate; 
      case MilestoneLink.CONSTRUCTION_START: return timeline.constStartMonth + item.startDate;
      case MilestoneLink.CONSTRUCTION_END: return timeline.constEndMonth + item.startDate;
      default: return item.startDate; 
  }
};

const getEscalationRate = (category: CostCategory, settings: FeasibilitySettings): number => {
  const { growth } = settings;
  if (!growth) return settings.defaultEscalationRate || 3.0; 
  switch (category) {
    case CostCategory.CONSTRUCTION: case CostCategory.CONSULTANTS: return growth.constructionEscalation;
    case CostCategory.LAND: return growth.landAppreciation;
    case CostCategory.SELLING: return growth.salesPriceEscalation;
    default: return growth.cpi;
  }
};

// --- PURE MODULE 2: COSTS ---
const calcCostSchedule = (
  scenario: FeasibilityScenario,
  site: Site,
  timeline: TimelineContext,
  linkedScenario: FeasibilityScenario | undefined,
  taxScales: TaxConfiguration
): CostFlow[] => {
  const isHold = scenario.strategy === 'HOLD';
  const baseSettings = isHold && linkedScenario ? linkedScenario.settings : scenario.settings;
  const baseCosts = isHold && linkedScenario ? linkedScenario.costs : scenario.costs;
  
  // SOURCE ACQUISITION FROM SITE
  const { purchasePrice, depositPercent, legalFeeEstimate, stampDutyTiming, isForeignBuyer, stampDutyState, stampDutyOverride, buyersAgentFee } = site.acquisition;

  // 1. Calculate Totals for % based items
  const constructionSum = baseCosts
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc + c.amount, 0);
  
  const estTotalRevenue = scenario.revenues.reduce((acc, rev) => {
     if (rev.strategy === 'Hold') return acc + ((rev.weeklyRent||0) * 52 * rev.units);
     return acc + (rev.units * rev.pricePerUnit);
  }, 0);

  const depositAmount = new Decimal(purchasePrice).times(depositPercent).div(100);
  const settlementAmount = new Decimal(purchasePrice).minus(depositAmount);
  const stampDutyAmount = new Decimal(calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer, taxScales, stampDutyOverride));

  // Initialize Array
  const schedule: CostFlow[] = Array(timeline.horizonMonths + 1).fill(null).map(() => ({
    totalNet: new Decimal(0),
    totalGST: new Decimal(0),
    breakdown: { 
        [CostCategory.LAND]: 0, [CostCategory.CONSULTANTS]: 0, [CostCategory.CONSTRUCTION]: 0,
        [CostCategory.STATUTORY]: 0, [CostCategory.MISCELLANEOUS]: 0, [CostCategory.SELLING]: 0, [CostCategory.FINANCE]: 0
    }
  }));

  // A. Acquisition Costs (Hardcoded Timeline)
  if (!isHold) {
      // Month 0: Deposit + Legal
      schedule[0].totalNet = schedule[0].totalNet.plus(depositAmount).plus(legalFeeEstimate || 0);
      schedule[0].breakdown[CostCategory.LAND] += depositAmount.toNumber();
      
      // Stamp Duty Exchange vs Settlement
      if (stampDutyTiming === 'EXCHANGE') {
          schedule[0].totalNet = schedule[0].totalNet.plus(stampDutyAmount);
          schedule[0].breakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber();
      } else {
          const sm = timeline.settlementMonth;
          if (sm < schedule.length) {
              schedule[sm].totalNet = schedule[sm].totalNet.plus(stampDutyAmount);
              schedule[sm].breakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber();
          }
      }

      // Settlement Month: Balance
      const sm = timeline.settlementMonth;
      if (sm < schedule.length) {
          schedule[sm].totalNet = schedule[sm].totalNet.plus(settlementAmount);
          schedule[sm].breakdown[CostCategory.LAND] += settlementAmount.toNumber();
          
          // Buyer's Agent Fee
          const agentFee = new Decimal(purchasePrice).times(buyersAgentFee || 0).div(100);
          if (agentFee.gt(0)) {
              schedule[sm].totalNet = schedule[sm].totalNet.plus(agentFee);
              schedule[sm].breakdown[CostCategory.CONSULTANTS] += agentFee.toNumber();
          }
      }
  }

  // B. Development Costs (Line Items)
  if (!isHold) {
      baseCosts.forEach(cost => {
          if (cost.category === CostCategory.LAND) return; // Handled above
          const effectiveStart = getEffectiveStartMonth(cost, timeline);
          const totalAmt = calculateLineItemTotal(cost, baseSettings, site, constructionSum, estTotalRevenue, taxScales);
          const escRate = cost.escalationRate || getEscalationRate(cost.category, baseSettings);

          for (let m = effectiveStart; m < effectiveStart + cost.span; m++) {
              if (m >= schedule.length) break;
              
              const monthlyBase = distributeValue(totalAmt, m - effectiveStart, cost);
              const compounding = new Decimal(Math.pow(1 + (escRate/100), m/12));
              const monthlyEscalated = monthlyBase.times(compounding);

              // GST Logic
              if (cost.gstTreatment === GstTreatment.TAXABLE) {
                  const gst = monthlyEscalated.times(0.1);
                  schedule[m].totalNet = schedule[m].totalNet.plus(monthlyEscalated).plus(gst); // Note: totalNet tracks cash out, usually includes GST for payment
                  schedule[m].totalGST = schedule[m].totalGST.plus(gst);
              } else {
                  schedule[m].totalNet = schedule[m].totalNet.plus(monthlyEscalated);
              }

              schedule[m].breakdown[cost.category] += monthlyEscalated.toNumber();
          }
      });
  }

  // C. Operating Costs (Hold Phase)
  if (isHold) {
      // Dynamic Land Tax & Statutory Appreciation
      let currentStatutoryValue = new Decimal(site.identity.auv || purchasePrice || 0);
      const landAppreciationRate = baseSettings.growth?.landAppreciation || 3.0;
      const monthlyGrowthFactor = new Decimal(Math.pow(1 + (landAppreciationRate / 100), 1/12));

      for (let m = 0; m < schedule.length; m++) {
          if (timeline.isOperatingPhase(m)) {
              // 1. Statutory (Land Tax Annual)
              const operatingMonth = m - timeline.actualRefiMonth;
              if (operatingMonth % 12 === 0) {
                  const annualTax = TaxLibrary.calculateTax(
                      currentStatutoryValue.toNumber(),
                      taxScales,
                      site.acquisition.stampDutyState as TaxState,
                      'LAND_TAX_GENERAL'
                  );
                  schedule[m].totalNet = schedule[m].totalNet.plus(annualTax);
                  schedule[m].breakdown[CostCategory.STATUTORY] += annualTax;
              }
          }
          currentStatutoryValue = currentStatutoryValue.times(monthlyGrowthFactor);
      }
  }

  return schedule;
};

// --- PURE MODULE 3: REVENUE ---
const calcRevenueSchedule = (
  scenario: FeasibilityScenario,
  timeline: TimelineContext
): RevenueFlow[] => {
  const isHold = scenario.strategy === 'HOLD';
  const { settings, revenues } = scenario;
  
  const schedule: RevenueFlow[] = Array(timeline.horizonMonths + 1).fill(null).map(() => ({
      gross: new Decimal(0),
      net: new Decimal(0),
      gstLiability: new Decimal(0),
      sellingCosts: new Decimal(0),
      rentalOpex: new Decimal(0),
      terminalValue: new Decimal(0)
  }));

  // Growth Factors
  const revGrowthRate = settings.growth?.salesPriceEscalation ?? settings.defaultEscalationRate ?? 3.0;
  const rentGrowthRate = settings.growth?.rentalGrowth ?? 2.5;

  revenues.forEach(rev => {
      // A. SELL STRATEGY
      if (rev.strategy === 'Sell' && !isHold) {
          const startMonth = timeline.constEndMonth + (rev.offsetFromCompletion || 0);
          const absorption = rev.absorptionRate || 1;
          
          // Loop through sales months
          for (let m = startMonth; m < schedule.length; m++) {
              // Calculate units sold this month
              const monthsInSales = m - startMonth;
              const unitsSoldPreviously = monthsInSales * absorption;
              const unitsRemaining = Math.max(0, rev.units - unitsSoldPreviously);
              const unitsSoldThisMonth = Math.min(unitsRemaining, absorption);

              if (unitsSoldThisMonth > 0) {
                  const compounding = new Decimal(Math.pow(1 + (revGrowthRate/100), m/12));
                  const revenuePeriod = new Decimal(unitsSoldThisMonth).times(rev.pricePerUnit).times(compounding);
                  
                  schedule[m].gross = schedule[m].gross.plus(revenuePeriod);
                  
                  // Costs
                  const comms = revenuePeriod.times(rev.commissionRate).div(100);
                  const gst = rev.isTaxable ? revenuePeriod.div(11) : new Decimal(0);
                  
                  schedule[m].sellingCosts = schedule[m].sellingCosts.plus(comms);
                  schedule[m].gstLiability = schedule[m].gstLiability.plus(gst);
                  
                  // Net = Gross - GST - Commissions
                  schedule[m].net = schedule[m].net.plus(revenuePeriod.minus(gst).minus(comms));
              }
          }
      }

      // B. HOLD STRATEGY
      if (rev.strategy === 'Hold') {
          for (let m = 0; m < schedule.length; m++) {
              if (timeline.isOperatingPhase(m)) {
                  const opMonthIndex = m - timeline.actualRefiMonth;
                  
                  // Ramp Up
                  const leaseUp = rev.leaseUpMonths || 1;
                  let rampFactor = 1;
                  if (opMonthIndex < leaseUp) rampFactor = (opMonthIndex + 1) / leaseUp;

                  // Growth
                  const compounding = new Decimal(Math.pow(1 + (rentGrowthRate/100), m/12));
                  
                  // Base Numbers
                  const annualBase = new Decimal((rev.weeklyRent || 0) * 52 * rev.units);
                  const monthlyPotential = annualBase.times(compounding).div(12);
                  
                  // Adjustments
                  const vacancy = (rev.vacancyFactorPct || 0) / 100;
                  const effectiveGross = monthlyPotential.times(rampFactor).times(1 - vacancy);
                  
                  schedule[m].gross = schedule[m].gross.plus(effectiveGross);
                  
                  // Opex
                  const opex = effectiveGross.times((rev.opexRate || 0) / 100);
                  schedule[m].rentalOpex = schedule[m].rentalOpex.plus(opex);
                  schedule[m].net = schedule[m].net.plus(effectiveGross.minus(opex));
              }
          }
      }
  });

  // C. TERMINAL VALUE (Exit at end of Hold)
  if (isHold) {
      const endM = timeline.horizonMonths;
      if (endM < schedule.length) {
          let totalStabilisedNetRent = new Decimal(0);
          const compounding = new Decimal(Math.pow(1 + (rentGrowthRate/100), endM/12));
          
          revenues.forEach(rev => {
              if (rev.strategy !== 'Hold') return;
              const grossAnnual = new Decimal((rev.weeklyRent || 0) * 52 * rev.units).times(compounding);
              const netAnnual = grossAnnual.times(1 - (rev.opexRate || 0)/100);
              totalStabilisedNetRent = totalStabilisedNetRent.plus(netAnnual);
          });

          const termCap = (settings.holdStrategy?.terminalCapRate || 5) / 100;
          const isp = termCap > 0 ? totalStabilisedNetRent.div(termCap) : new Decimal(0);
          
          schedule[endM].terminalValue = isp;
          schedule[endM].gross = schedule[endM].gross.plus(isp);
          
          // Exit Fees (Agent)
          const exitFees = isp.times(0.02);
          schedule[endM].sellingCosts = schedule[endM].sellingCosts.plus(exitFees);
          schedule[endM].net = schedule[endM].net.plus(isp.minus(exitFees));
      }
  }

  return schedule;
};

// --- PURE MODULE 4: TAX (GST) ---
const calcTaxSchedule = (
  costSchedule: CostFlow[],
  revenueSchedule: RevenueFlow[],
  timeline: TimelineContext
): TaxFlow[] => {
  let pendingCredits = new Decimal(0);
  
  return costSchedule.map((cost, m) => {
      const revenue = revenueSchedule[m];
      const commsGst = revenue.sellingCosts.div(11); 
      const monthlyItc = cost.totalGST.plus(commsGst);
      
      pendingCredits = pendingCredits.plus(monthlyItc);
      
      let cashImpact = new Decimal(0);
      if (timeline.isQuarterEnd[m]) {
          cashImpact = pendingCredits;
          pendingCredits = new Decimal(0);
      }

      return {
          netGstMovement: cashImpact,
          liability: revenue.gstLiability,
          credits: monthlyItc,
          cumulativeCredits: pendingCredits
      };
  });
};

// --- PURE MODULE 5: FUNDING WATERFALL ---
const calcFundingSchedule = (
  timeline: TimelineContext,
  costSchedule: CostFlow[],
  revenueSchedule: RevenueFlow[],
  taxSchedule: TaxFlow[],
  settings: FeasibilitySettings,
  site: Site,
  taxScales: TaxConfiguration // Added for Duty Calc
) => {
  const { capitalStack } = settings;
  const flows: MonthlyFlow[] = [];

  // Running Balances
  let seniorBal = new Decimal(0);
  let mezzBal = new Decimal(0);
  let cumulativeEquity = new Decimal(0); 
  let surplusCash = new Decimal(0);
  
  // Asset Tracking
  let currentAssetValue = new Decimal(site.acquisition.purchasePrice);
  let currentStatutoryValue = new Decimal(currentAssetValue);
  let depreciableCapitalWorks = new Decimal(0); 
  let depreciablePlant = new Decimal(0);
  
  // Setup Depreciation Basis
  if (settings.holdStrategy) {
      const constructionSum = costSchedule.reduce((a,c) => a.plus(c.breakdown[CostCategory.CONSTRUCTION]), new Decimal(0));
      depreciableCapitalWorks = constructionSum.times((settings.holdStrategy.depreciationSplit.capitalWorksPct)/100);
      depreciablePlant = constructionSum.times((settings.holdStrategy.depreciationSplit.plantPct)/100);
  }

  // --- DYNAMIC EQUITY CALCULATION ---
  // The 'initialContribution' setting is used as a fallback or base.
  // If PCT_LAND or PCT_TOTAL_COST is selected, we calculate the $ limit dynamically.
  let equityLimit = new Decimal(capitalStack.equity.initialContribution);

  if (capitalStack.equity.mode === EquityMode.PCT_LAND) {
      // Logic: X% of Land Purchase Price
      let basis = new Decimal(site.acquisition.purchasePrice);
      
      // If includeAcquisitionCosts is TRUE, add Duty, Legal, Agent
      if (capitalStack.equity.includeAcquisitionCosts) {
          const duty = calculateStampDuty(
              site.acquisition.purchasePrice, 
              site.acquisition.stampDutyState, 
              site.acquisition.isForeignBuyer,
              taxScales,
              site.acquisition.stampDutyOverride
          );
          const agentFee = site.acquisition.purchasePrice * ((site.acquisition.buyersAgentFee || 0) / 100);
          const legal = site.acquisition.legalFeeEstimate || 0;
          basis = basis.plus(duty).plus(agentFee).plus(legal);
      }

      equityLimit = basis.times(capitalStack.equity.percentageInput).div(100);

  } else if (capitalStack.equity.mode === EquityMode.PCT_TOTAL_COST) {
      // Logic: X% of Total Costs (Excl Finance)
      // We sum up the net costs from the schedule we just calculated
      const totalCosts = costSchedule.reduce((sum, c) => sum.plus(c.totalNet), new Decimal(0));
      equityLimit = totalCosts.times(capitalStack.equity.percentageInput).div(100);
  }

  for (let m = 0; m < costSchedule.length; m++) {
      const costs = costSchedule[m];
      const rev = revenueSchedule[m];
      const tax = taxSchedule[m];
      const isOp = timeline.isOperatingPhase(m);

      // 1. Depreciation (Non Cash)
      let depreciation = new Decimal(0);
      if (isOp) {
          const cw = depreciableCapitalWorks.times(0.025).div(12);
          const plant = depreciablePlant.times(0.10).div(12);
          depreciation = cw.plus(plant);
      }

      // 2. Refi Inflow
      let refiInflow = new Decimal(0);
      let investmentBal = new Decimal(0);
      let investmentInt = new Decimal(0);
      
      if (isOp && m === timeline.actualRefiMonth) {
          const lvr = (settings.holdStrategy?.refinanceLvr || 65) / 100;
          const loanAmount = currentAssetValue.times(lvr);
          refiInflow = loanAmount;
          investmentBal = loanAmount;
      }
      
      if (isOp) {
          const invRate = (settings.holdStrategy?.investmentRate || 0) / 100 / 12;
          investmentInt = investmentBal.times(invRate);
      }

      // 3. Net Cash Position (Pre-Finance)
      let lendingInt = new Decimal(0);
      if (surplusCash.gt(0)) {
          lendingInt = surplusCash.times((capitalStack.surplusInterestRate || 0)/100/12);
      }

      const inflow = rev.net.plus(refiInflow).plus(lendingInt).plus(tax.netGstMovement);
      const outflow = costs.totalNet.plus(investmentInt);
      
      // Line Fees
      const seniorLimit = capitalStack.senior.limit || 0;
      const seniorLineRate = (capitalStack.senior.lineFeePct || 0) / 100 / 12;
      const lineFee = (seniorLimit > 0 && m >= (capitalStack.senior.activationMonth||0)) 
          ? new Decimal(seniorLimit).times(seniorLineRate) 
          : new Decimal(0);

      // Calculates the raw funding requirement for this month
      let netCash = inflow.minus(outflow).minus(lineFee);

      // 4. Waterfall Variables
      let drawEq = new Decimal(0), drawSn = new Decimal(0), drawMz = new Decimal(0);
      let paySn = new Decimal(0), payMz = new Decimal(0), payEq = new Decimal(0);

      // Interest Calculation
      const getRate = (tier: CapitalTier) => {
          return new Decimal(tier.interestRate).div(100).div(12);
      };
      
      const intSn = seniorBal.times(getRate(capitalStack.senior));
      const intMz = mezzBal.times(getRate(capitalStack.mezzanine));
      
      // Capitalise Interest
      if (capitalStack.senior.isInterestCapitalised !== false) seniorBal = seniorBal.plus(intSn);
      if (capitalStack.mezzanine.isInterestCapitalised !== false) mezzBal = mezzBal.plus(intMz);

      // --- FUNDING WATERFALL LOGIC (Equity First) ---
      if (netCash.lt(0)) {
          let deficit = netCash.abs();
          
          // A. Surplus Cash
          if (surplusCash.gt(0)) {
              const use = Decimal.min(deficit, surplusCash);
              surplusCash = surplusCash.minus(use);
              deficit = deficit.minus(use);
          }

          // B. Developer Equity (First Loss)
          // No phase check - Equity is always first resort if available
          if (deficit.gt(0)) {
              // Use the DYNAMIC equityLimit calculated above
              const eqAvailable = equityLimit.minus(cumulativeEquity);
              
              if (eqAvailable.gt(0)) {
                  const draw = Decimal.min(deficit, eqAvailable);
                  drawEq = draw;
                  cumulativeEquity = cumulativeEquity.plus(draw);
                  deficit = deficit.minus(draw);
              }
          }

          // C. Senior Debt
          if (deficit.gt(0)) {
              const snLimit = capitalStack.senior.limit || Infinity;
              const snAvailable = (snLimit === 0 && capitalStack.senior.limitMethod === DebtLimitMethod.FIXED) 
                  ? new Decimal(Number.MAX_SAFE_INTEGER) 
                  : new Decimal(snLimit).minus(seniorBal);
              
              if (snAvailable.gt(0)) {
                 const draw = Decimal.min(deficit, snAvailable);
                 drawSn = draw;
                 seniorBal = seniorBal.plus(drawSn);
                 deficit = deficit.minus(drawSn);
              }
          }

          // D. Mezzanine Debt
          if (deficit.gt(0)) {
              const mzLimit = capitalStack.mezzanine.limit || 0;
              const mzAvailable = new Decimal(mzLimit).minus(mezzBal);

              if (mzAvailable.gt(0)) {
                  const draw = Decimal.min(deficit, mzAvailable);
                  drawMz = draw;
                  mezzBal = mezzBal.plus(drawMz);
                  deficit = deficit.minus(drawMz);
              }
          }

          // E. Emergency Equity (Overflow)
          if (deficit.gt(0)) {
              const emergencyEquity = deficit;
              drawEq = drawEq.plus(emergencyEquity);
              cumulativeEquity = cumulativeEquity.plus(emergencyEquity);
              deficit = new Decimal(0);
          }

      } else {
          // --- REPAYMENT LOGIC (Surplus) ---
          let surplus = netCash;
          
          // 1. Pay Senior
          if (seniorBal.gt(0)) {
              paySn = Decimal.min(surplus, seniorBal);
              seniorBal = seniorBal.minus(paySn);
              surplus = surplus.minus(paySn);
          }
          // 2. Pay Mezz
          if (mezzBal.gt(0) && surplus.gt(0)) {
              payMz = Decimal.min(surplus, mezzBal);
              mezzBal = mezzBal.minus(payMz);
              surplus = surplus.minus(payMz);
          }
          // 3. Pay Equity / Profit
          if (surplus.gt(0)) {
              payEq = surplus;
              surplus = new Decimal(0);
          }
      }

      // Asset Value Updates
      if (!isOp) {
          currentAssetValue = currentAssetValue.plus(costs.totalNet);
      } else {
          const growth = (settings.holdStrategy?.annualCapitalGrowth || 0) / 100;
          const monthlyGrowth = Math.pow(1 + growth, 1/12) - 1;
          currentAssetValue = currentAssetValue.times(1 + monthlyGrowth);
      }

      // Record Flow
      flows.push({
          month: m,
          label: timeline.monthLabels[m],
          
          developmentCosts: costs.totalNet.toNumber(),
          costBreakdown: costs.breakdown,
          // New Explicit GST Tracking
          grossCosts: costs.totalNet.plus(costs.totalGST).toNumber(), 
          gstOnCosts: costs.totalGST.toNumber(),

          grossRevenue: rev.gross.toNumber(),
          netRevenue: rev.net.toNumber(),
          gstOnSales: rev.gstLiability.toNumber(),

          drawDownEquity: drawEq.toNumber(),
          drawDownMezz: drawMz.toNumber(),
          drawDownSenior: drawSn.toNumber(),
          lendingInterestIncome: lendingInt.toNumber(),
          repaySenior: paySn.toNumber(),
          repayMezz: payMz.toNumber(),
          repayEquity: payEq.toNumber(),
          balanceSenior: seniorBal.toNumber(),
          balanceMezz: mezzBal.toNumber(),
          balanceEquity: cumulativeEquity.toNumber(),
          balanceSurplus: surplusCash.toNumber(),
          interestSenior: intSn.toNumber(),
          interestMezz: intMz.toNumber(),
          lineFeeSenior: lineFee.toNumber(),
          netCashflow: netCash.toNumber(),
          cumulativeCashflow: 0, 
          investmentBalance: investmentBal.toNumber(),
          investmentInterest: investmentInt.toNumber(),
          assetValue: currentAssetValue.toNumber(),
          statutoryValue: currentStatutoryValue.toNumber(),
          landTaxLiability: costs.breakdown[CostCategory.STATUTORY],
          inflationFactor: timeline.inflationFactors[m].toNumber(),
          depreciation: depreciation.toNumber()
      });
  }

  return flows;
};

// --- HELPER: ITEM SUMMARY CALCULATOR ---
const calculateLineItemSummaries = (
  scenario: FeasibilityScenario, 
  site: Site,
  taxScales: TaxConfiguration
): LineItemSummary[] => {
  const { settings } = scenario;
  const timeline = buildTimeline(scenario, site);
  
  // Implicit Items
  const implicitCosts = getImplicitAcquisitionCosts(settings, site, taxScales).map(i => ({...i, isImplicit: true}));
  
  // Combined Costs
  const allCosts = [...implicitCosts, ...scenario.costs.map(c => ({...c, isImplicit: false}))];

  // Calculators Bases
  const constructionSum = scenario.costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc + c.amount, 0);
  
  const estTotalRevenue = scenario.revenues.reduce((acc, rev) => {
     if (rev.strategy === 'Hold') return acc + ((rev.weeklyRent||0) * 52 * rev.units);
     return acc + (rev.units * rev.pricePerUnit);
  }, 0);

  // Process Each Item
  return allCosts.map(item => {
      const effectiveStart = getEffectiveStartMonth(item, timeline);
      const totalAmt = calculateLineItemTotal(item, settings, site, constructionSum, estTotalRevenue, taxScales);
      const escRate = item.escalationRate || getEscalationRate(item.category, settings);

      let totalNetEscalated = new Decimal(0);

      // Iterate Distribution over Span
      for (let m = effectiveStart; m < effectiveStart + item.span; m++) {
          if (m > timeline.horizonMonths) break;
          
          const monthlyBase = distributeValue(totalAmt, m - effectiveStart, item);
          // Apply compounding escalation monthly
          const compounding = new Decimal(Math.pow(1 + (escRate/100), m/12));
          const monthlyEscalated = monthlyBase.times(compounding);
          
          totalNetEscalated = totalNetEscalated.plus(monthlyEscalated);
      }

      // Calc GST on Final Net
      let gstAmount = new Decimal(0);
      let grossAmount = totalNetEscalated;

      if (item.gstTreatment === GstTreatment.TAXABLE) {
          gstAmount = totalNetEscalated.times(0.1);
          grossAmount = totalNetEscalated.plus(gstAmount);
      }

      return {
          id: item.id,
          category: item.category,
          description: item.description,
          netAmount: totalNetEscalated.toNumber(),
          gstAmount: gstAmount.toNumber(),
          grossAmount: grossAmount.toNumber(),
          isImplicit: (item as any).isImplicit
      };
  });
};

// --- ORCHESTRATOR ---
const calculateMonthlyCashflow = (
  scenario: FeasibilityScenario,
  site: Site,
  linkedScenario?: FeasibilityScenario, 
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): MonthlyFlow[] => {
  // 1. Build Context
  const timeline = buildTimeline(scenario, site, linkedScenario);

  // 2. Generate Independent Schedules
  const costs = calcCostSchedule(scenario, site, timeline, linkedScenario, taxScales);
  const revenues = calcRevenueSchedule(scenario, timeline);
  const taxes = calcTaxSchedule(costs, revenues, timeline);

  // 3. Run Dependent Waterfall
  return calcFundingSchedule(timeline, costs, revenues, taxes, scenario.settings, site, taxScales);
};

// --- HELPER: NPV (Exported for testing or internal use) ---
export const calculateNPV = (flows: number[], rate: number): number => {
  let npv = 0;
  for (let i = 0; i < flows.length; i++) {
    npv += flows[i] / Math.pow(1 + rate, i);
  }
  return npv;
};

// --- Updated IRR: Robust Bracketing + Bisection ---
// Returns Monthly Effective Rate (Decimal) or null
const calculateIRR = (flows: number[]): number | null => {
  // 1. Sanity Check: Must have signs changes
  let hasPos = false;
  let hasNeg = false;
  for (const f of flows) {
    if (f > 0) hasPos = true;
    if (f < 0) hasNeg = true;
    if (hasPos && hasNeg) break;
  }
  if (!hasPos || !hasNeg) return null;

  // 2. Define NPV function for convenience
  const npv = (r: number) => calculateNPV(flows, r);

  // 3. Find Bracket
  // We search for a range [a, b] where signs of NPV differ.
  // Monthly rates typically between -100% (-1.0) and +100% (1.0).
  // Extreme cases might go higher.
  
  let low = -0.99; // Near -100% loss
  let high = 1.0;  // 100% monthly return
  let fLow = npv(low);
  let fHigh = npv(high);

  if (fLow * fHigh > 0) {
      // Signs match, try expanding upper bound
      if (fLow > 0) {
          // NPV positive at 100% monthly? Try 1000%
          high = 10.0; 
          fHigh = npv(high);
      } else {
          // NPV negative at -99%? Extremely bad project.
          return null; 
      }
  }

  if (fLow * fHigh > 0) return null; // Still no sign change, unsolvable in range

  // 4. Bisection Method (Robust)
  const tolerance = 1e-8;
  const maxIter = 100;

  for (let i = 0; i < maxIter; i++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid);

      if (Math.abs(fMid) < tolerance || (high - low) < tolerance) {
          return mid;
      }

      if (fLow * fMid < 0) {
          high = mid;
          fHigh = fMid;
      } else {
          low = mid;
          fLow = fMid;
      }
  }

  return (low + high) / 2;
};

// --- LEGACY EXPORTS (METRICS & ITEMISED) - Updated to handle implicit land items ---
const generateItemisedCashflowData = (
  scenario: FeasibilityScenario, 
  site: Site,
  mainFlows: MonthlyFlow[],
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): ItemisedCashflow => {
  const months = mainFlows.map(f => f.label);
  const duration = months.length;

  const categories: ItemisedCategory[] = [];
  const addCategory = (name: string, id: CostCategory) => {
    categories.push({ id, name, rows: [], total: 0, monthlyTotals: new Array(duration).fill(0) });
  };

  addCategory('Income', CostCategory.SELLING);
  addCategory('Land & Acquisition', CostCategory.LAND);
  addCategory('Construction', CostCategory.CONSTRUCTION);
  addCategory('Consultants', CostCategory.CONSULTANTS);
  addCategory('Statutory & General', CostCategory.STATUTORY);
  addCategory('Finance & Funding', CostCategory.FINANCE);

  const getCat = (name: string) => categories.find(c => c.name === name)!;

  // Income Rows
  const salesRow: ItemisedRow = { label: 'Gross Sales Revenue', total: 0, values: new Array(duration).fill(0) };
  const otherRow: ItemisedRow = { label: 'Interest Income', total: 0, values: new Array(duration).fill(0) };
  const incomeCat = getCat('Income');

  mainFlows.forEach((f, i) => {
      salesRow.values[i] = f.grossRevenue;
      otherRow.values[i] = f.lendingInterestIncome;
      salesRow.total += f.grossRevenue;
      otherRow.total += f.lendingInterestIncome;
      incomeCat.monthlyTotals[i] += (f.grossRevenue + f.lendingInterestIncome);
  });
  incomeCat.total = salesRow.total + otherRow.total;
  incomeCat.rows.push(salesRow, otherRow);

  // Combine Manual Costs + Implicit Land Costs
  const virtualLandItems = getImplicitAcquisitionCosts(scenario.settings, site, taxScales);
  const allCosts = [...scenario.costs, ...virtualLandItems];

  // Re-run cost distribution logic individually for reporting granularity
  const timeline = buildTimeline(scenario, site);
  const constructionSum = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a,b) => a+b.amount, 0);
  const revenueSum = incomeCat.total;

  allCosts.forEach(item => {
      let targetCat: ItemisedCategory | undefined;
      if (item.category === CostCategory.LAND) targetCat = getCat('Land & Acquisition');
      else if (item.category === CostCategory.CONSTRUCTION) targetCat = getCat('Construction');
      else if (item.category === CostCategory.CONSULTANTS) targetCat = getCat('Consultants');
      else if (item.category === CostCategory.STATUTORY || item.category === CostCategory.MISCELLANEOUS) targetCat = getCat('Statutory & General');
      else if (item.category === CostCategory.SELLING) targetCat = getCat('Statutory & General');
      
      if (!targetCat) return;

      const totalAmount = calculateLineItemTotal(item, scenario.settings, site, constructionSum, revenueSum, taxScales);
      const row: ItemisedRow = { label: item.description, total: totalAmount, values: new Array(duration).fill(0) };
      
      let startIdx = item.startDate;
      if (item.linkToMilestone === MilestoneLink.ACQUISITION) startIdx += timeline.settlementMonth;
      if (item.linkToMilestone === MilestoneLink.CONSTRUCTION_START) startIdx += timeline.constStartMonth;
      if (item.linkToMilestone === MilestoneLink.CONSTRUCTION_END) startIdx += timeline.constEndMonth;

      for (let m = 0; m < duration; m++) {
          if (m >= startIdx && m < startIdx + item.span) {
              const base = distributeValue(totalAmount, m - startIdx, item);
              const val = item.gstTreatment === GstTreatment.TAXABLE ? base.times(1.1) : base;
              row.values[m] = val.toNumber();
          }
      }
      row.total = row.values.reduce((a,b) => a+b, 0);
      targetCat.rows.push(row);
      row.values.forEach((v, i) => targetCat!.monthlyTotals[i] += v);
      targetCat.total += row.total;
  });

  // Finance Rows
  const finCat = getCat('Finance & Funding');
  const intRow: ItemisedRow = { label: 'Interest Expense', total: 0, values: new Array(duration).fill(0) };
  mainFlows.forEach((f, i) => {
      const val = f.interestSenior + f.interestMezz + f.lineFeeSenior;
      intRow.values[i] = val;
      finCat.monthlyTotals[i] += val;
  });
  intRow.total = intRow.values.reduce((a,b)=>a+b, 0);
  finCat.total = intRow.total;
  finCat.rows.push(intRow);

  const netCashflow = months.map((_, i) => {
      const inc = incomeCat.monthlyTotals[i];
      const costs = categories.filter(c => c.name !== 'Income').reduce((sum, cat) => sum + cat.monthlyTotals[i], 0);
      return inc - costs;
  });

  return { headers: months, categories, netCashflow, cumulativeCashflow: [] };
};

const calculateProjectMetrics = (cashflow: MonthlyFlow[], settings: FeasibilitySettings): ProjectMetrics => {
  // Canonical Financials Aggregation
  const grossRealisation = cashflow.reduce((acc, c) => acc + c.grossRevenue + c.lendingInterestIncome, 0);
  const gstOnSales = cashflow.reduce((acc, c) => acc + c.gstOnSales, 0);
  const netRealisation = grossRealisation - gstOnSales;

  const totalFinanceCost = cashflow.reduce((acc, curr) => acc + curr.interestSenior + curr.interestMezz + curr.lineFeeSenior, 0);
  
  // Total Development Costs (Net) = DevCosts + Finance
  const devCostsNet = cashflow.reduce((acc, c) => acc + c.developmentCosts, 0);
  const totalCostNet = devCostsNet + totalFinanceCost;

  // GST Calculation
  const gstInputCredits = cashflow.reduce((acc, c) => acc + c.gstOnCosts, 0);
  
  // Gross Costs (Net + ITC)
  const totalCostGross = totalCostNet + gstInputCredits;

  const exactProfit = netRealisation - totalCostNet;
  const devMarginPct = totalCostNet > 0 ? (exactProfit / totalCostNet) * 100 : 0;
  const marginBeforeInterest = exactProfit + totalFinanceCost;
  
  let peakDebtAmount = 0;
  let peakDebtMonthIndex = 0;
  cashflow.forEach((flow, idx) => {
      const debt = flow.balanceSenior + flow.balanceMezz;
      if (debt > peakDebtAmount) {
          peakDebtAmount = debt;
          peakDebtMonthIndex = idx;
      }
  });
  
  const peakDebtDate = getMonthLabel(settings.startDate, peakDebtMonthIndex);
  const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
  const peakEquity = Math.max(...cashflow.map(f => f.balanceEquity));
  
  const marginOnEquity = peakEquity > 0 ? (exactProfit / peakEquity) * 100 : 0;
  
  // IRR Calculations
  // 1. Calculate Monthly IRR (Decimal)
  const equityMonthlyIRR = calculateIRR(equityFlows);
  // 2. Convert to Effective Annual Rate (%) if solvable
  const equityIRR = equityMonthlyIRR !== null ? annualiseMonthlyRate(equityMonthlyIRR) * 100 : null;

  const projectFlows = cashflow.map(f => {
      const inF = f.netRevenue + f.lendingInterestIncome; 
      const outF = f.developmentCosts / 1.1; // Approximation for legacy project flow
      return inF - outF;
  });
  
  const projectMonthlyIRR = calculateIRR(projectFlows);
  const projectIRR = projectMonthlyIRR !== null ? annualiseMonthlyRate(projectMonthlyIRR) * 100 : null;

  return {
      // Canonical Financials
      grossRealisation,
      gstOnSales,
      netRealisation,
      totalCostGross,
      gstInputCredits,
      totalCostNet,
      netProfit: exactProfit,
      marginOnCost: devMarginPct,

      // Legacy & UI Compatibility
      totalDevelopmentCost: totalCostNet,
      grossRevenue: grossRealisation,
      netRevenue: netRealisation,
      totalFinanceCost,
      devMarginPct,
      marginBeforeInterest,
      marginOnEquity,
      equityIRR,
      projectIRR,
      gstCollected: gstOnSales,
      netGstPayable: gstOnSales - gstInputCredits,
      peakDebtAmount,
      peakDebtMonthIndex,
      peakDebtDate,
      peakEquity,
      residualLandValue: 0 
  };
};

export const FinanceEngine = {
  calculateLineItemTotal,
  calculateMonthlyCashflow,
  generateItemisedCashflowData,
  calculateProjectMetrics,
  calculateLineItemSummaries, // Exported for ReportModel
  getMonthLabel,
  calculateNPV,
  calculateIRR,
  calculateStampDuty,
  getImplicitAcquisitionCosts,
  annualiseMonthlyRate,
  distributeValue,
  _internal: {
    buildTimeline,
    calcCostSchedule,
    calcRevenueSchedule,
    calcTaxSchedule,
    calcFundingSchedule
  }
};
