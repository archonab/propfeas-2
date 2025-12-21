
import Decimal from 'decimal.js';
import { LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, InputType, CostCategory } from '../types';

/**
 * Calculates the total nominal amount of a line item based on its input type.
 */
const calculateLineItemTotal = (item: LineItem, settings: FeasibilitySettings, constructionSum: number, totalRevenue: number): number => {
  const val = new Decimal(item.amount);
  switch (item.inputType) {
    case InputType.PCT_REVENUE:
      return val.dividedBy(100).times(totalRevenue).toNumber();
    case InputType.PCT_CONSTRUCTION:
      return val.dividedBy(100).times(constructionSum).toNumber();
    case InputType.RATE_PER_UNIT:
      return val.times(settings.totalUnits).toNumber();
    case InputType.FIXED:
    default:
      return item.amount;
  }
};

/**
 * Generates formatted label for charts (e.g., "Jun 24")
 */
const getMonthLabel = (startDate: string, offset: number): string => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
};

/**
 * Advanced Distribution curves for spreading costs over time
 */
const distributeValue = (total: number, currentMonth: number, item: LineItem): Decimal => {
  const totalDec = new Decimal(total);
  const span = item.span;
  const method = item.method;
  
  if (span <= 0) return new Decimal(0);

  // Helper for Normal Distribution CDF (Error function approximation)
  const erf = (x: number) => {
    // Save the sign of x
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
  
    // Constants
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;
  
    // A&S formula 7.1.26
    var t = 1.0 / (1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
    return sign*y;
  };

  switch (method) {
    case DistributionMethod.S_CURVE: {
      // Adjustable Logistic Function
      // k = steepness. Higher k = steeper S-curve (more centered).
      // Default k=10 is standard construction S-curve.
      const k = item.sCurveSteepness || 10; 
      const x0 = 0.5; // Midpoint
      
      const getCumulative = (t: number) => {
        const x = t / span;
        const exponent = new Decimal(-k).times(x - x0);
        const denominator = new Decimal(1).plus(Decimal.exp(exponent));
        return new Decimal(1).dividedBy(denominator);
      };

      const startPct = getCumulative(currentMonth);
      const endPct = getCumulative(currentMonth + 1);
      
      // Normalize against the range [0..span] so the total sums to 1.0 regardless of k
      const minVal = getCumulative(0);
      const maxVal = getCumulative(span);
      const range = maxVal.minus(minVal);

      const normalizedStep = endPct.minus(startPct).dividedBy(range);
      return totalDec.times(normalizedStep);
    }

    case DistributionMethod.BELL_CURVE: {
      // Normal Distribution CDF
      // We map the time span [0, span] to Z-scores [-3, 3] (covering 99.7% of curve)
      const getNormalCDF = (t: number) => {
        if (t <= 0) return 0;
        if (t >= span) return 1;
        
        // Map t to z-score
        const z = ((t / span) * 6) - 3; 
        
        // CDF = 0.5 * (1 + erf(z / sqrt(2)))
        return 0.5 * (1 + erf(z / Math.sqrt(2)));
      };

      const startPct = new Decimal(getNormalCDF(currentMonth));
      const endPct = new Decimal(getNormalCDF(currentMonth + 1));
      
      // Normalize range (since we clipped at +/- 3 sigma, actual CDF sum is ~0.997)
      const minVal = new Decimal(getNormalCDF(0));
      const maxVal = new Decimal(getNormalCDF(span));
      const range = maxVal.minus(minVal);
      
      const normalizedStep = endPct.minus(startPct).dividedBy(range);
      return totalDec.times(normalizedStep);
    }

    case DistributionMethod.MILESTONE: {
      if (!item.milestones) return new Decimal(0);
      // currentMonth is relative index (0, 1, 2...)
      // We check if milestones has a key for this specific relative month
      const pct = item.milestones[currentMonth + 1]; // +1 because users usually think Month 1, not Month 0
      if (pct) {
        return totalDec.times(pct).dividedBy(100);
      }
      return new Decimal(0);
    }

    case DistributionMethod.UPFRONT:
      return currentMonth === 0 ? totalDec : new Decimal(0);

    case DistributionMethod.END:
      return currentMonth === span - 1 ? totalDec : new Decimal(0);

    case DistributionMethod.LINEAR:
    default:
      return totalDec.dividedBy(span);
  }
};

/**
 * Core Waterfall Engine
 */
const calculateMonthlyCashflow = (
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): MonthlyFlow[] => {
  const flows: MonthlyFlow[] = [];

  // --- 1. Pre-Calculation Totals ---
  const totalRevenue = revenues.reduce((acc, rev) => {
    return acc.plus(new Decimal(rev.units).times(rev.pricePerUnit));
  }, new Decimal(0)).toNumber();

  const landTotal = costs
    .filter(c => c.category === CostCategory.LAND)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  const constructionSum = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  // --- 2. Initialize Capital Stack State ---
  let equityCommitmentRemaining = new Decimal(settings.capitalStack.equityContribution);
  let cumulativeEquityUsed = new Decimal(0);
  
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);

  // --- 3. Monthly Loop ---
  for (let m = 0; m <= settings.durationMonths; m++) {
    
    // A. Calculate Operational Cashflows (Pre-Finance)
    let monthlyCost = new Decimal(0);
    
    costs.forEach(cost => {
      // Check if cost is active in this month
      if (m >= cost.startDate && m < cost.startDate + cost.span) {
        
        const totalAmount = calculateLineItemTotal(cost, settings, constructionSum, totalRevenue);
        const monthlyBaseValue = distributeValue(totalAmount, m - cost.startDate, cost);
        
        // --- Compounding Escalation Logic ---
        // Formula: Cost * (1 + MonthlyRate)^MonthsElapsed
        // Monthly Rate derived from Annual Rate: (1 + Annual%)^(1/12) - 1
        
        const annualRate = (cost.escalationRate || 0) / 100;
        
        if (annualRate > 0) {
           const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
           // Apply compounding based on how many months have passed since project start (m)
           const compoundingFactor = new Decimal(Math.pow(1 + monthlyRate, m));
           monthlyCost = monthlyCost.plus(monthlyBaseValue.times(compoundingFactor));
        } else {
           monthlyCost = monthlyCost.plus(monthlyBaseValue);
        }
      }
    });

    let monthlyRevenue = new Decimal(0);
    revenues.forEach(rev => {
      if (m === rev.settlementDate) {
        const revTotal = new Decimal(rev.units).times(rev.pricePerUnit);
        const commission = revTotal.times(rev.commissionRate).dividedBy(100);
        
        let gstPayable = new Decimal(0);
        if (settings.useMarginScheme) {
          const margin = revTotal.minus(landTotal); // Simplified per unit
          if (margin.gt(0)) gstPayable = margin.dividedBy(11);
        } else {
          gstPayable = revTotal.dividedBy(11);
        }
        monthlyRevenue = monthlyRevenue.plus(revTotal.minus(commission).minus(gstPayable));
      }
    });

    // B. Interest Calculation (Capitalised to Debt Balances)
    // Monthly Rates
    const seniorRateMonthly = new Decimal(settings.capitalStack.senior.interestRate).dividedBy(100).dividedBy(12);
    const mezzRateMonthly = new Decimal(settings.capitalStack.mezzanine.interestRate).dividedBy(100).dividedBy(12);

    const interestSenior = seniorBalance.times(seniorRateMonthly);
    const interestMezz = mezzBalance.times(mezzRateMonthly);

    // Capitalise interest
    seniorBalance = seniorBalance.plus(interestSenior);
    mezzBalance = mezzBalance.plus(interestMezz);

    // C. Funding Waterfall (Filling the buckets)
    // Costs to be funded this month:
    let fundingNeed = monthlyCost;
    
    let drawEquity = new Decimal(0);
    let drawMezz = new Decimal(0);
    let drawSenior = new Decimal(0);

    // 1. Equity First
    if (fundingNeed.gt(0) && equityCommitmentRemaining.gt(0)) {
      const amount = Decimal.min(fundingNeed, equityCommitmentRemaining);
      drawEquity = amount;
      equityCommitmentRemaining = equityCommitmentRemaining.minus(amount);
      fundingNeed = fundingNeed.minus(amount);
      cumulativeEquityUsed = cumulativeEquityUsed.plus(amount);
    }

    // 2. Mezzanine Second (if limit exists)
    const mezzLimit = settings.capitalStack.mezzanine.limit ? new Decimal(settings.capitalStack.mezzanine.limit) : new Decimal(9999999999);
    const mezzAvailable = mezzLimit.minus(mezzBalance);
    
    if (fundingNeed.gt(0) && mezzAvailable.gt(0)) {
      const amount = Decimal.min(fundingNeed, mezzAvailable);
      drawMezz = amount;
      mezzBalance = mezzBalance.plus(amount);
      fundingNeed = fundingNeed.minus(amount);
    }

    // 3. Senior Debt Last
    if (fundingNeed.gt(0)) {
      drawSenior = fundingNeed;
      seniorBalance = seniorBalance.plus(drawSenior);
      fundingNeed = new Decimal(0);
    }

    // D. Repayment Waterfall (Draining the buckets)
    let repaymentCapacity = monthlyRevenue;
    let repaySenior = new Decimal(0);
    let repayMezz = new Decimal(0);
    let repayEquity = new Decimal(0);

    // 1. Pay Senior Principal & Interest
    if (repaymentCapacity.gt(0) && seniorBalance.gt(0)) {
      const amount = Decimal.min(repaymentCapacity, seniorBalance);
      repaySenior = amount;
      seniorBalance = seniorBalance.minus(amount);
      repaymentCapacity = repaymentCapacity.minus(amount);
    }

    // 2. Pay Mezzanine Principal & Interest
    if (repaymentCapacity.gt(0) && mezzBalance.gt(0)) {
      const amount = Decimal.min(repaymentCapacity, mezzBalance);
      repayMezz = amount;
      mezzBalance = mezzBalance.minus(amount);
      repaymentCapacity = repaymentCapacity.minus(amount);
    }

    // 3. Return to Equity (Profit)
    if (repaymentCapacity.gt(0)) {
      repayEquity = repaymentCapacity;
    }

    // Record the flow
    flows.push({
      month: m,
      label: getMonthLabel(settings.startDate, m),
      
      developmentCosts: monthlyCost.toNumber(),
      netRevenue: monthlyRevenue.toNumber(),
      
      drawDownEquity: drawEquity.toNumber(),
      drawDownMezz: drawMezz.toNumber(),
      drawDownSenior: drawSenior.toNumber(),
      
      repaySenior: repaySenior.toNumber(),
      repayMezz: repayMezz.toNumber(),
      repayEquity: repayEquity.toNumber(),
      
      balanceSenior: seniorBalance.toNumber(),
      balanceMezz: mezzBalance.toNumber(),
      balanceEquity: cumulativeEquityUsed.toNumber(),
      
      interestSenior: interestSenior.toNumber(),
      interestMezz: interestMezz.toNumber(),
      
      netCashflow: monthlyRevenue.minus(monthlyCost).toNumber(),
      cumulativeCashflow: 0 // Calculated elsewhere if needed
    });
  }

  return flows;
};

const calculateNPV = (flows: number[], annualRate: number): number => {
  const monthlyRate = annualRate / 100 / 12;
  let npv = 0;
  for (let i = 0; i < flows.length; i++) {
    npv += flows[i] / Math.pow(1 + monthlyRate, i);
  }
  return npv;
};

const calculateIRR = (flows: number[]): number => {
  let guest = 0.1;
  for (let i = 0; i < 40; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < flows.length; t++) {
      npv += flows[t] / Math.pow(1 + guest, t);
      dnpv -= t * flows[t] / Math.pow(1 + guest, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newGuest = guest - npv / dnpv;
    if (Math.abs(newGuest - guest) < 1e-7) return newGuest * 12 * 100;
    guest = newGuest;
  }
  return 0;
};

export const FinanceEngine = {
  calculateLineItemTotal,
  calculateMonthlyCashflow,
  getMonthLabel,
  calculateNPV,
  calculateIRR
};
