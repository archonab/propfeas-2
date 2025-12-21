
import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment
} from '../types';

// Helper: Error Function for Bell Curve
const erf = (x: number) => {
  var sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  var a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741, a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  var t = 1.0 / (1.0 + p*x);
  var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
  return sign*y;
};

// --- EXPORTED HELPERS (Used by Engine & UI Charts) ---

// Helper: Calculate Line Item Nominal Total
export const calculateLineItemTotal = (item: LineItem, settings: FeasibilitySettings, constructionSum: number, totalRevenue: number): number => {
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

export const getMonthLabel = (startDate: string, offset: number): string => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
};

// Distribution Curve Logic (Standard S-Curve etc)
export const distributeValue = (total: number, currentMonth: number, item: LineItem): Decimal => {
  const totalDec = new Decimal(total);
  const span = item.span;
  const method = item.method;
  
  if (span <= 0) return new Decimal(0);

  switch (method) {
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
      const range = maxVal.minus(minVal);
      const normalizedStep = endPct.minus(startPct).dividedBy(range);
      return totalDec.times(normalizedStep);
    }
    case DistributionMethod.BELL_CURVE: {
      const getNormalCDF = (t: number) => {
        if (t <= 0) return 0;
        if (t >= span) return 1;
        const z = ((t / span) * 6) - 3; 
        return 0.5 * (1 + erf(z / Math.sqrt(2)));
      };
      const startPct = new Decimal(getNormalCDF(currentMonth));
      const endPct = new Decimal(getNormalCDF(currentMonth + 1));
      const minVal = new Decimal(getNormalCDF(0));
      const maxVal = new Decimal(getNormalCDF(span));
      const range = maxVal.minus(minVal);
      const normalizedStep = endPct.minus(startPct).dividedBy(range);
      return totalDec.times(normalizedStep);
    }
    case DistributionMethod.MILESTONE: {
      if (!item.milestones) return new Decimal(0);
      const pct = item.milestones[currentMonth + 1];
      if (pct) return totalDec.times(pct).dividedBy(100);
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

// --- INTERNAL ENGINE HELPERS ---

// Helper: Get Interest Rate for a specific month (Single vs Variable)
const getMonthlyInterestRate = (tier: CapitalTier, currentMonth: number): Decimal => {
  let annualRate = 0;
  
  if (tier.rateMode === InterestRateMode.SINGLE) {
    annualRate = tier.interestRate;
  } else {
    // Variable: Find the latest rate that is active for this month
    const activeRate = [...tier.variableRates]
      .sort((a, b) => a.month - b.month)
      .reverse()
      .find(r => r.month <= currentMonth);
      
    annualRate = activeRate ? activeRate.rate : tier.interestRate;
  }

  return new Decimal(annualRate).dividedBy(100).dividedBy(12);
};

/**
 * CORE CASHFLOW ENGINE
 * Updated for Feastudy 7.0 parity
 */
const calculateMonthlyCashflow = (
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): MonthlyFlow[] => {
  const flows: MonthlyFlow[] = [];

  // --- 1. Pre-Calculation & Totals ---
  const totalRevenue = revenues.reduce((acc, rev) => {
    return acc.plus(new Decimal(rev.units).times(rev.pricePerUnit));
  }, new Decimal(0)).toNumber();

  const constructionSum = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  // Total Development Cost (Pre-Interest) for Equity Calculations
  const totalDevCostPreInterest = costs
    .reduce((acc, c) => acc.plus(calculateLineItemTotal(c, settings, constructionSum, totalRevenue)), new Decimal(0))
    .toNumber();

  const totalLandCost = costs
    .filter(c => c.category === CostCategory.LAND)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  const marginLandBase = costs
    // Logic check: Margin Base usually includes Land that was acquired GST-Free or via Margin Scheme
    .filter(c => c.category === CostCategory.LAND && (c.gstTreatment === GstTreatment.GST_FREE || c.gstTreatment === GstTreatment.MARGIN_SCHEME))
    .reduce((acc, c) => acc.plus(calculateLineItemTotal(c, settings, constructionSum, totalRevenue)), new Decimal(0));

  // --- 2. Establishment Fees & Limits ---
  const getFee = (tier: CapitalTier, limit: Decimal) => {
    if (tier.establishmentFeeBase === FeeBase.FIXED) return new Decimal(tier.establishmentFee);
    return limit.times(tier.establishmentFee).dividedBy(100);
  };

  const getDynamicLimit = (tier: CapitalTier) => {
    const rawLimit = tier.limit || 0;
    if (tier.limitMethod === DebtLimitMethod.LVR) return new Decimal(totalRevenue).times(rawLimit).dividedBy(100);
    if (tier.limitMethod === DebtLimitMethod.LTC) return new Decimal(totalDevCostPreInterest).times(rawLimit).dividedBy(100); // Approximation using pre-interest
    return new Decimal(rawLimit > 0 ? rawLimit : 9999999999);
  };

  const seniorLimit = getDynamicLimit(settings.capitalStack.senior);
  const mezzLimit = getDynamicLimit(settings.capitalStack.mezzanine);

  const seniorEstabFee = getFee(settings.capitalStack.senior, seniorLimit);
  const mezzEstabFee = getFee(settings.capitalStack.mezzanine, mezzLimit);

  // --- 3. Equity Setup ---
  const equityConfig = settings.capitalStack.equity;
  let equityPool = new Decimal(0);
  let totalEquityCommitted = new Decimal(0);

  // Pre-calculate Total Equity Commitment based on Mode
  switch(equityConfig.mode) {
    case EquityMode.SUM_OF_MONEY:
      equityPool = new Decimal(equityConfig.initialContribution);
      break;
    case EquityMode.PCT_LAND:
      equityPool = new Decimal(totalLandCost).times(equityConfig.percentageInput).dividedBy(100);
      break;
    case EquityMode.PCT_TOTAL_COST:
      equityPool = new Decimal(totalDevCostPreInterest).times(equityConfig.percentageInput).dividedBy(100);
      break;
    case EquityMode.INSTALMENTS:
      equityPool = equityConfig.instalments.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
      break;
    case EquityMode.PCT_MONTHLY:
      // Pari Passu - We simulate a large pool, but the restriction happens per month
      equityPool = new Decimal(999999999999); 
      break;
  }
  
  // For fixed pool modes, we track availability
  if (equityConfig.mode !== EquityMode.PCT_MONTHLY) {
    totalEquityCommitted = equityPool; 
  }

  let cumulativeEquityUsed = new Decimal(0);
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);
  let surplusBalance = new Decimal(0); // Offset account / Cash at bank
  let pendingITCRefund = new Decimal(0); // BAS Lag

  // Apply Establishment Fees to Balance at Month 0 (Simulated)
  let unpaidSeniorFee = seniorEstabFee;
  let unpaidMezzFee = mezzEstabFee;

  // --- 4. Monthly Loop ---
  for (let m = 0; m <= settings.durationMonths; m++) {
    
    // A. Operational Cashflows
    let monthlyNetCost = new Decimal(0);
    let monthlyGSTPaid = new Decimal(0);
    
    // Process Costs
    costs.forEach(cost => {
      if (m >= cost.startDate && m < cost.startDate + cost.span) {
        const totalAmount = calculateLineItemTotal(cost, settings, constructionSum, totalRevenue);
        const monthlyBaseValue = distributeValue(totalAmount, m - cost.startDate, cost);
        
        let monthlyEscalated = monthlyBaseValue;
        const annualRate = (cost.escalationRate || 0) / 100;
        if (annualRate > 0) {
           const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
           const compoundingFactor = new Decimal(Math.pow(1 + monthlyRate, m));
           monthlyEscalated = monthlyBaseValue.times(compoundingFactor);
        }
        
        monthlyNetCost = monthlyNetCost.plus(monthlyEscalated);

        // GST Logic: Only add GST if TAXABLE. 
        // GST Free, Input Taxed, Margin Scheme on cost side implies NO GST to pay/claim on the cashflow.
        if (cost.gstTreatment === GstTreatment.TAXABLE) {
          const gstRate = (settings.gstRate || 10) / 100;
          monthlyGSTPaid = monthlyGSTPaid.plus(monthlyEscalated.times(gstRate));
        }
      }
    });

    // Add Estab Fees to "Cost" in Month 0 (to trigger funding)
    if (m === 0) {
      monthlyNetCost = monthlyNetCost.plus(unpaidSeniorFee).plus(unpaidMezzFee);
    }

    // Process Revenue
    let monthlyNetRevenue = new Decimal(0);
    revenues.forEach(rev => {
      if (m === rev.settlementDate) {
        const revTotal = new Decimal(rev.units).times(rev.pricePerUnit);
        const commission = revTotal.times(rev.commissionRate).dividedBy(100);
        let gstLiability = new Decimal(0);
        
        // Revenue GST Logic
        if (rev.isTaxable) {
          if (settings.useMarginScheme) {
            const totalUnits = settings.totalUnits || 1;
            const allocatedLandBase = marginLandBase.times(rev.units).dividedBy(totalUnits);
            const margin = revTotal.minus(allocatedLandBase);
            if (margin.gt(0)) gstLiability = margin.dividedBy(11);
          } else {
            gstLiability = revTotal.dividedBy(11);
          }
        }
        monthlyNetRevenue = monthlyNetRevenue.plus(revTotal.minus(commission).minus(gstLiability));
      }
    });

    // B. Interest Calculation
    const seniorRate = getMonthlyInterestRate(settings.capitalStack.senior, m);
    const mezzRate = getMonthlyInterestRate(settings.capitalStack.mezzanine, m);
    
    // Line Fees
    const seniorLineFeeRate = new Decimal(settings.capitalStack.senior.lineFee || 0).dividedBy(100).dividedBy(12);
    const seniorActive = m >= (settings.capitalStack.senior.activationMonth || 0);
    const seniorLineFee = (seniorActive && seniorLimit.lt(9999999999)) ? seniorLimit.times(seniorLineFeeRate) : new Decimal(0);

    const mezzLineFeeRate = new Decimal(settings.capitalStack.mezzanine.lineFee || 0).dividedBy(100).dividedBy(12);
    const mezzActive = m >= (settings.capitalStack.mezzanine.activationMonth || 0);
    const mezzLineFee = (mezzActive && mezzLimit.lt(9999999999)) ? mezzLimit.times(mezzLineFeeRate) : new Decimal(0);

    const interestSenior = seniorBalance.times(seniorRate).plus(seniorLineFee);
    const interestMezz = mezzBalance.times(mezzRate).plus(mezzLineFee);

    // C. Surplus Interest
    const lendingRate = new Decimal(settings.capitalStack.surplusInterestRate || 0).dividedBy(100).dividedBy(12);
    const lendingInterestIncome = surplusBalance.times(lendingRate);

    // D. Capitalisation
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

    // E. Funding Waterfall
    const totalOutflow = monthlyNetCost.plus(monthlyGSTPaid).plus(financeFundingNeed);
    const totalInflow = monthlyNetRevenue.plus(pendingITCRefund).plus(lendingInterestIncome);
    
    pendingITCRefund = monthlyGSTPaid; // Refund next month

    const netPeriodCashflow = totalInflow.minus(totalOutflow);
    
    let fundingNeed = new Decimal(0);
    let repaymentCapacity = new Decimal(0);

    if (netPeriodCashflow.lt(0)) {
       fundingNeed = netPeriodCashflow.abs();
       
       // Use Surplus first
       if (surplusBalance.gt(0)) {
         const fromSurplus = Decimal.min(surplusBalance, fundingNeed);
         surplusBalance = surplusBalance.minus(fromSurplus);
         fundingNeed = fundingNeed.minus(fromSurplus);
       }
    } else {
       repaymentCapacity = netPeriodCashflow;
    }

    let drawEquity = new Decimal(0);
    let drawMezz = new Decimal(0);
    let drawSenior = new Decimal(0);

    // --- UPGRADED EQUITY LOGIC (Pari Passu & Phasing) ---
    if (fundingNeed.gt(0)) {
        if (equityConfig.mode === EquityMode.PCT_MONTHLY) {
            // Pari Passu Mode:
            // Developer must contribute X% of the deficit. 
            // Debt covers the remainder.
            const pariPassuPct = new Decimal(equityConfig.percentageInput).dividedBy(100);
            const targetEquityDraw = fundingNeed.times(pariPassuPct);
            
            // Note: If we had a hard "Total Equity Cap" even for Pari Passu, we would check totalEquityCommitted here.
            // Currently assuming "pay as you go" implies availability.
            drawEquity = targetEquityDraw;
            cumulativeEquityUsed = cumulativeEquityUsed.plus(drawEquity);
            
            // Determine remainder for debt
            fundingNeed = fundingNeed.minus(drawEquity);

        } else if (equityConfig.mode === EquityMode.INSTALMENTS) {
             // Specific Injection Dates
             const injection = equityConfig.instalments.find(i => i.month === m);
             if (injection) {
                 const amount = new Decimal(injection.amount);
                 drawEquity = amount; 
                 cumulativeEquityUsed = cumulativeEquityUsed.plus(amount);
                 
                 if (amount.gte(fundingNeed)) {
                     const excess = amount.minus(fundingNeed);
                     surplusBalance = surplusBalance.plus(excess);
                     fundingNeed = new Decimal(0);
                 } else {
                     fundingNeed = fundingNeed.minus(amount);
                 }
             }
        } else {
            // Pool Based (Upfront, % Land, % Total Cost)
            // Available Equity = TotalCommitted - Used
            const available = totalEquityCommitted.minus(cumulativeEquityUsed);
            if (available.gt(0)) {
                drawEquity = Decimal.min(available, fundingNeed);
                fundingNeed = fundingNeed.minus(drawEquity);
                cumulativeEquityUsed = cumulativeEquityUsed.plus(drawEquity);
            }
        }
    }

    // --- DEBT LOGIC ---
    // 2. Mezzanine
    const mezzAvailable = mezzLimit.minus(mezzBalance);
    if (fundingNeed.gt(0) && mezzAvailable.gt(0)) {
      const amount = Decimal.min(fundingNeed, mezzAvailable);
      drawMezz = amount;
      mezzBalance = mezzBalance.plus(amount);
      fundingNeed = fundingNeed.minus(amount);
    }

    // 3. Senior Debt
    if (fundingNeed.gt(0)) {
      drawSenior = fundingNeed;
      seniorBalance = seniorBalance.plus(drawSenior);
      fundingNeed = new Decimal(0);
    }

    // F. Repayment Waterfall
    let repaySenior = new Decimal(0);
    let repayMezz = new Decimal(0);
    let repayEquity = new Decimal(0);

    if (repaymentCapacity.gt(0)) {
        // 1. Pay Senior
        if (seniorBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, seniorBalance);
            repaySenior = amount;
            seniorBalance = seniorBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        // 2. Pay Mezz
        if (repaymentCapacity.gt(0) && mezzBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, mezzBalance);
            repayMezz = amount;
            mezzBalance = mezzBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        // 3. Pay Equity (standard waterfall pays equity back last)
        if (repaymentCapacity.gt(0)) {
            repayEquity = repaymentCapacity;
        }
    }

    // Record Flow
    flows.push({
      month: m,
      label: getMonthLabel(settings.startDate, m),
      developmentCosts: monthlyNetCost.toNumber(),
      netRevenue: monthlyNetRevenue.toNumber(),
      drawDownEquity: drawEquity.toNumber(),
      drawDownMezz: drawMezz.toNumber(),
      drawDownSenior: drawSenior.toNumber(),
      lendingInterestIncome: lendingInterestIncome.toNumber(),
      repaySenior: repaySenior.toNumber(),
      repayMezz: repayMezz.toNumber(),
      repayEquity: repayEquity.toNumber(),
      balanceSenior: seniorBalance.toNumber(),
      balanceMezz: mezzBalance.toNumber(),
      balanceEquity: cumulativeEquityUsed.toNumber(),
      balanceSurplus: surplusBalance.toNumber(),
      interestSenior: interestSenior.toNumber(),
      interestMezz: interestMezz.toNumber(),
      netCashflow: netPeriodCashflow.toNumber(),
      cumulativeCashflow: 0
    });
  }

  return flows;
};

// ... keep existing stats/report functions ...
const calculateReportStats = (settings: FeasibilitySettings, costs: LineItem[], revenues: RevenueItem[]) => {
  const totalRevenueGross = revenues.reduce((acc, rev) => acc + (rev.units * rev.pricePerUnit), 0);
  const fixedConstruction = costs.filter(c => c.category === CostCategory.CONSTRUCTION && c.inputType === InputType.FIXED).reduce((acc, c) => acc + c.amount, 0);
  const landBaseForMargin = costs.filter(c => c.category === CostCategory.LAND && (c.gstTreatment === GstTreatment.GST_FREE || c.gstTreatment === GstTreatment.MARGIN_SCHEME)).reduce((acc, c) => acc + calculateLineItemTotal(c, settings, fixedConstruction, totalRevenueGross), 0);

  let gstCollected = 0;
  if (settings.useMarginScheme) {
    const margin = Math.max(0, totalRevenueGross - landBaseForMargin);
    gstCollected = margin / 11;
  } else {
    gstCollected = totalRevenueGross / 11;
  }

  const netRealisation = totalRevenueGross - gstCollected;
  let totalItc = 0;
  const grossCostsByCategory: Record<string, number> = {};
  Object.values(CostCategory).forEach(cat => grossCostsByCategory[cat] = 0);

  costs.forEach(item => {
    const netAmount = calculateLineItemTotal(item, settings, fixedConstruction, totalRevenueGross);
    const gstRate = (settings.gstRate || 10) / 100;
    const gst = (item.gstTreatment === GstTreatment.TAXABLE) ? netAmount * gstRate : 0;
    const grossAmount = netAmount + gst;
    totalItc += gst;
    grossCostsByCategory[item.category] = (grossCostsByCategory[item.category] || 0) + grossAmount;
  });

  return { totalRevenueGross, gstCollected, netRealisation, grossCostsByCategory, totalItc };
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
    let npv = 0, dnpv = 0;
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
