
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

  const constructionSum = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  // MARGIN SCHEME BASE: Sum of NON-TAXABLE Land Costs
  // Used for: GST = (Sales - LandBase) / 11
  const marginLandBase = costs
    .filter(c => c.category === CostCategory.LAND && !c.isTaxable)
    .reduce((acc, c) => acc.plus(calculateLineItemTotal(c, settings, constructionSum, totalRevenue)), new Decimal(0));

  // --- 2. Initialize Capital Stack State ---
  let equityCommitmentRemaining = new Decimal(settings.capitalStack.equityContribution);
  let cumulativeEquityUsed = new Decimal(0);
  
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);

  // ITC LAG STATE: GST paid in Month M is refunded in Month M+1
  let pendingITCRefund = new Decimal(0);

  // --- 3. Monthly Loop ---
  for (let m = 0; m <= settings.durationMonths; m++) {
    
    // A. Calculate Operational Cashflows (Pre-Finance)
    let monthlyNetCost = new Decimal(0);
    let monthlyGSTPaid = new Decimal(0);
    
    costs.forEach(cost => {
      // Check if cost is active in this month
      if (m >= cost.startDate && m < cost.startDate + cost.span) {
        
        const totalAmount = calculateLineItemTotal(cost, settings, constructionSum, totalRevenue);
        const monthlyBaseValue = distributeValue(totalAmount, m - cost.startDate, cost);
        
        // --- Compounding Escalation Logic ---
        let monthlyEscalated = monthlyBaseValue;
        const annualRate = (cost.escalationRate || 0) / 100;
        
        if (annualRate > 0) {
           const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
           const compoundingFactor = new Decimal(Math.pow(1 + monthlyRate, m));
           monthlyEscalated = monthlyBaseValue.times(compoundingFactor);
        }
        
        monthlyNetCost = monthlyNetCost.plus(monthlyEscalated);

        // Calculate GST Outflow for this month (to be refunded next month)
        if (cost.isTaxable) {
          const gstRate = (settings.gstRate || 10) / 100;
          monthlyGSTPaid = monthlyGSTPaid.plus(monthlyEscalated.times(gstRate));
        }
      }
    });

    let monthlyNetRevenue = new Decimal(0);
    revenues.forEach(rev => {
      if (m === rev.settlementDate) {
        const revTotal = new Decimal(rev.units).times(rev.pricePerUnit);
        const commission = revTotal.times(rev.commissionRate).dividedBy(100);
        
        let gstLiability = new Decimal(0);
        if (settings.useMarginScheme) {
          // Margin Scheme: GST = (Sales - Allocatable Land Base) / 11
          // Allocatable Land Base = Total Land Base * (Units Settling / Total Units)
          const totalUnits = settings.totalUnits || 1;
          const allocatedLandBase = marginLandBase.times(rev.units).dividedBy(totalUnits);
          
          const margin = revTotal.minus(allocatedLandBase);
          if (margin.gt(0)) {
            gstLiability = margin.dividedBy(11);
          }
        } else {
          // Standard Scheme: GST = Sales / 11
          gstLiability = revTotal.dividedBy(11);
        }
        monthlyNetRevenue = monthlyNetRevenue.plus(revTotal.minus(commission).minus(gstLiability));
      }
    });

    // B. Interest Calculation (Capitalised to Debt Balances)
    // Interest Rate Monthly
    const seniorRateMonthly = new Decimal(settings.capitalStack.senior.interestRate).dividedBy(100).dividedBy(12);
    const mezzRateMonthly = new Decimal(settings.capitalStack.mezzanine.interestRate).dividedBy(100).dividedBy(12);

    // Line Fees
    const seniorLineFeeRate = new Decimal(settings.capitalStack.senior.lineFee || 0).dividedBy(100).dividedBy(12);
    const seniorLimit = new Decimal(settings.capitalStack.senior.limit || 0);
    const seniorLineFee = seniorLimit.gt(0) ? seniorLimit.times(seniorLineFeeRate) : new Decimal(0);

    const mezzLineFeeRate = new Decimal(settings.capitalStack.mezzanine.lineFee || 0).dividedBy(100).dividedBy(12);
    const mezzLineFee = (settings.capitalStack.mezzanine.limit) 
        ? new Decimal(settings.capitalStack.mezzanine.limit).times(mezzLineFeeRate) 
        : new Decimal(0);

    const interestSenior = seniorBalance.times(seniorRateMonthly).plus(seniorLineFee);
    const interestMezz = mezzBalance.times(mezzRateMonthly).plus(mezzLineFee);

    // C. Capitalisation vs Servicing
    // If NOT capitalised, interest adds to the cash funding requirement for the month.
    let financeFundingNeed = new Decimal(0);

    if (settings.capitalStack.senior.isInterestCapitalised !== false) { 
        seniorBalance = seniorBalance.plus(interestSenior);
    } else {
        financeFundingNeed = financeFundingNeed.plus(interestSenior);
    }

    if (settings.capitalStack.mezzanine.isInterestCapitalised !== false) {
        mezzBalance = mezzBalance.plus(interestMezz);
    } else {
        financeFundingNeed = financeFundingNeed.plus(interestMezz);
    }

    // D. Funding Waterfall (Filling the buckets)
    
    // CASH FLOW CALCULATION
    // Outflows: Net Costs + GST Paid This Month + Non-Capitalised Interest
    const totalOutflow = monthlyNetCost.plus(monthlyGSTPaid).plus(financeFundingNeed);
    
    // Inflows: Net Revenue + GST Input Tax Credits (Refund from Previous Month)
    const totalInflow = monthlyNetRevenue.plus(pendingITCRefund);
    
    // Store GST Paid this month to be the Refund for Next Month
    pendingITCRefund = monthlyGSTPaid;

    // Net Position for the Month
    const netPeriodCashflow = totalInflow.minus(totalOutflow);

    let fundingNeed = new Decimal(0);
    let repaymentCapacity = new Decimal(0);

    // Determine if we need to Draw Funds or can Repay Funds
    if (netPeriodCashflow.lt(0)) {
       fundingNeed = netPeriodCashflow.abs();
    } else {
       repaymentCapacity = netPeriodCashflow;
    }

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

    // E. Repayment Waterfall (Draining the buckets)
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
      
      // We report Net Cost for the table/chart as is standard, but the funding logic used Gross
      developmentCosts: monthlyNetCost.toNumber(), 
      netRevenue: monthlyNetRevenue.toNumber(),
      
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
      
      // True Net Cashflow after finance movements (excluding debt draw/repay)
      netCashflow: netPeriodCashflow.toNumber(),
      cumulativeCashflow: 0 
    });
  }

  return flows;
};

const calculateReportStats = (
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
) => {
  // 1. Revenue Stats
  const totalRevenueGross = revenues.reduce((acc, rev) => {
    return acc + (rev.units * rev.pricePerUnit);
  }, 0);

  // We need construction total to calculate some land costs if they are % based (rare for land, but good for robustness)
  const fixedConstruction = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION && c.inputType === InputType.FIXED)
    .reduce((acc, c) => acc + c.amount, 0);

  // Land Total for Margin Scheme calculation (Must be NON-TAXABLE items only)
  const landBaseForMargin = costs
    .filter(c => c.category === CostCategory.LAND && !c.isTaxable)
    .reduce((acc, c) => acc + calculateLineItemTotal(c, settings, fixedConstruction, totalRevenueGross), 0);

  let gstCollected = 0;
  if (settings.useMarginScheme) {
    // GST is 1/11th of the Margin (Sales - LandBase)
    const margin = Math.max(0, totalRevenueGross - landBaseForMargin);
    gstCollected = margin / 11;
  } else {
    gstCollected = totalRevenueGross / 11;
  }

  const netRealisation = totalRevenueGross - gstCollected;

  // 2. Cost Stats (Calculated Gross & ITC)
  let totalItc = 0;
  const grossCostsByCategory: Record<string, number> = {};
  
  // Initialize categories to 0
  Object.values(CostCategory).forEach(cat => grossCostsByCategory[cat] = 0);

  costs.forEach(item => {
    // Calculate Net Amount (as per inputs)
    const netAmount = calculateLineItemTotal(item, settings, fixedConstruction, totalRevenueGross);
    
    // Calculate GST component (10% or setting)
    const gstRate = (settings.gstRate || 10) / 100;
    const gst = item.isTaxable ? netAmount * gstRate : 0;
    
    // Report shows Gross Amount
    const grossAmount = netAmount + gst;

    if (item.isTaxable) {
      totalItc += gst;
    }

    grossCostsByCategory[item.category] = (grossCostsByCategory[item.category] || 0) + grossAmount;
  });

  return {
    totalRevenueGross,
    gstCollected,
    netRealisation,
    grossCostsByCategory,
    totalItc
  };
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
  calculateReportStats,
  getMonthLabel,
  calculateNPV,
  calculateIRR
};
