
import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment, LineItemTag
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

// --- STAMP DUTY CALCULATOR ---
const calculateStampDuty = (price: number, state: 'VIC' | 'NSW' | 'QLD', isForeign: boolean): number => {
  let duty = 0;
  
  if (state === 'VIC') {
    // VIC FY24 Rates
    if (price > 960000) {
      duty = price * 0.055;
    } else if (price > 480000) {
      duty = 20370 + (price - 480000) * 0.06;
    } else if (price > 130000) {
      duty = 2870 + (price - 130000) * 0.05;
    } else if (price > 25000) {
      duty = 350 + (price - 25000) * 0.024;
    } else {
      duty = price * 0.014;
    }
  } else if (state === 'NSW') {
    // Simplified NSW Rates
    if (price > 3505000) {
      duty = 178742 + (price - 3505000) * 0.07; // Premium Duty
    } else if (price > 1168000) {
      duty = 46972 + (price - 1168000) * 0.055;
    } else {
      duty = price * 0.04; // Roughly
    }
  } else {
    // QLD simplified
    duty = price * 0.035; 
  }

  // Foreign Purchaser Additional Duty (FPAD)
  if (isForeign) {
    // VIC: 8%, NSW: 8%, QLD: 7%
    const surchargeRate = state === 'QLD' ? 0.07 : 0.08;
    duty += (price * surchargeRate);
  }

  return duty;
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
    case InputType.RATE_PER_SQM:
      return val.times(settings.site.landArea || 0).toNumber();
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
 * Updated for Acquisition Split Logic & Project Phasing
 */
const calculateMonthlyCashflow = (
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): MonthlyFlow[] => {
  const flows: MonthlyFlow[] = [];

  // --- 1. Pre-Calculation & Totals ---
  
  const totalRevenue = revenues.reduce((acc, rev) => {
    let itemValue = new Decimal(0);
    if (rev.strategy === 'Hold') {
       const grossRent = (rev.weeklyRent || 0) * 52;
       const netRent = grossRent * (1 - (rev.opexRate || 0) / 100);
       const capRate = (rev.capRate || 5) / 100;
       const terminalValue = capRate > 0 ? netRent / capRate : 0;
       itemValue = new Decimal(terminalValue).times(rev.units);
    } else {
       itemValue = new Decimal(rev.units).times(rev.pricePerUnit);
    }
    return acc.plus(itemValue);
  }, new Decimal(0)).toNumber();

  const constructionSum = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  // Smart Deal Structure Calculations
  const { purchasePrice, depositPercent, settlementPeriod, legalFeeEstimate, buyersAgentFee, stampDutyState, isForeignBuyer } = settings.acquisition;
  const constructionDelay = settings.constructionDelay || 0; 
  
  // Phase Start Months: Construction items start AFTER Settlement + Pre-Const Gap
  const constructionPhaseStart = settlementPeriod + constructionDelay;

  const depositAmount = new Decimal(purchasePrice).times(depositPercent).dividedBy(100);
  const settlementAmount = new Decimal(purchasePrice).minus(depositAmount);
  const stampDutyAmount = new Decimal(calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer));
  const buyersAgentAmount = new Decimal(purchasePrice).times(buyersAgentFee || 0).dividedBy(100);
  const legalFeeAmount = new Decimal(legalFeeEstimate);

  // Total Development Cost Calculation 
  // Add Generic Costs (Excluding LAND, as we handle it via Deal Structure)
  let totalDevCostPreInterest = new Decimal(0);
  costs.forEach(c => {
    if (c.category !== CostCategory.LAND) {
      totalDevCostPreInterest = totalDevCostPreInterest.plus(calculateLineItemTotal(c, settings, constructionSum, totalRevenue));
    }
  });

  // Add Deal Structure Costs (Acquisition specific)
  totalDevCostPreInterest = totalDevCostPreInterest.plus(purchasePrice).plus(stampDutyAmount).plus(buyersAgentAmount).plus(legalFeeAmount);

  // Margin Land Base (For GST)
  const marginLandBase = settings.useMarginScheme ? new Decimal(purchasePrice) : new Decimal(0);

  // --- 2. Establishment Fees & Limits ---
  const getFee = (tier: CapitalTier, limit: Decimal) => {
    if (tier.establishmentFeeBase === FeeBase.FIXED) return new Decimal(tier.establishmentFee);
    return limit.times(tier.establishmentFee).dividedBy(100);
  };

  const getDynamicLimit = (tier: CapitalTier) => {
    const rawLimit = tier.limit || 0;
    if (tier.limitMethod === DebtLimitMethod.LVR) return new Decimal(totalRevenue).times(rawLimit).dividedBy(100);
    if (tier.limitMethod === DebtLimitMethod.LTC) return new Decimal(totalDevCostPreInterest).times(rawLimit).dividedBy(100);
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

  switch(equityConfig.mode) {
    case EquityMode.SUM_OF_MONEY:
      equityPool = new Decimal(equityConfig.initialContribution);
      break;
    case EquityMode.PCT_LAND:
      equityPool = new Decimal(purchasePrice).times(equityConfig.percentageInput).dividedBy(100);
      break;
    case EquityMode.PCT_TOTAL_COST:
      equityPool = totalDevCostPreInterest.times(equityConfig.percentageInput).dividedBy(100);
      break;
    case EquityMode.INSTALMENTS:
      equityPool = equityConfig.instalments.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
      break;
    case EquityMode.PCT_MONTHLY:
      equityPool = new Decimal(999999999999); 
      break;
  }
  
  if (equityConfig.mode !== EquityMode.PCT_MONTHLY) {
    totalEquityCommitted = equityPool; 
  }

  let cumulativeEquityUsed = new Decimal(0);
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);
  let surplusBalance = new Decimal(0);
  let pendingITCRefund = new Decimal(0);

  let unpaidSeniorFee = seniorEstabFee;
  let unpaidMezzFee = mezzEstabFee;

  let runningCumulativeCashflow = new Decimal(0);

  for (let m = 0; m <= settings.durationMonths; m++) {
    
    // --- STEP A: REVENUE ---
    let monthlyNetRevenue = new Decimal(0);
    let monthlyGrossRevenue = new Decimal(0); 
    const monthlyBreakdown: Record<CostCategory, number> = {
        [CostCategory.LAND]: 0,
        [CostCategory.CONSULTANTS]: 0,
        [CostCategory.CONSTRUCTION]: 0,
        [CostCategory.STATUTORY]: 0,
        [CostCategory.MISCELLANEOUS]: 0,
        [CostCategory.SELLING]: 0,
        [CostCategory.FINANCE]: 0
    };

    revenues.forEach(rev => {
      // (Simplified logic for brevity - matches previous implementations)
      if (rev.strategy === 'Hold') {
         // ... Hold logic ...
         const settlementStart = rev.settlementDate; 
         if (m >= settlementStart) {
            const grossAnnualRent = new Decimal(rev.weeklyRent || 0).times(52).times(rev.units);
            const monthlyGross = grossAnnualRent.dividedBy(12);
            const monthsSinceOpen = m - settlementStart;
            let occupancyRate = 1;
            if (rev.leaseUpDuration && rev.leaseUpDuration > 0) {
                occupancyRate = Math.min(1, monthsSinceOpen / rev.leaseUpDuration);
            }
            const realizedGross = monthlyGross.times(occupancyRate);
            monthlyGrossRevenue = monthlyGrossRevenue.plus(realizedGross);
            const opex = realizedGross.times((rev.opexRate || 0) / 100);
            const netRent = realizedGross.minus(opex);
            let gstLiability = new Decimal(0);
            if (rev.isTaxable) gstLiability = realizedGross.dividedBy(11);
            monthlyNetRevenue = monthlyNetRevenue.plus(netRent).minus(gstLiability);
         }
         if (m === settings.durationMonths) {
             const grossAnnualRent = new Decimal(rev.weeklyRent || 0).times(52).times(rev.units);
             const netAnnualRent = grossAnnualRent.times(1 - (rev.opexRate || 0) / 100);
             const capRate = (rev.capRate || 5) / 100;
             const terminalValue = capRate > 0 ? netAnnualRent.dividedBy(capRate) : new Decimal(0);
             monthlyGrossRevenue = monthlyGrossRevenue.plus(terminalValue);
             monthlyNetRevenue = monthlyNetRevenue.plus(terminalValue);
         }
      } else {
        if (m === rev.settlementDate) {
            const revTotal = new Decimal(rev.units).times(rev.pricePerUnit);
            monthlyGrossRevenue = monthlyGrossRevenue.plus(revTotal);
            const commission = revTotal.times(rev.commissionRate).dividedBy(100);
            monthlyBreakdown[CostCategory.SELLING] += commission.toNumber();
            let gstLiability = new Decimal(0);
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
      }
    });

    // --- STEP B: COSTS (Deal Structure + Generic) ---
    let monthlyNetCost = new Decimal(0);
    let monthlyGSTPaid = new Decimal(0);
    
    // Explicit Deal Flow Tracking for Funding Enforcement
    let periodDeposit = new Decimal(0);
    let periodSettlementDebt = new Decimal(0); // Balance + Duty

    // 1. Inject Deal Flows
    // Month 0: Deposit + Legal
    if (m === 0) {
       periodDeposit = depositAmount;
       
       monthlyNetCost = monthlyNetCost.plus(periodDeposit).plus(legalFeeAmount);
       monthlyBreakdown[CostCategory.LAND] += periodDeposit.toNumber();
       monthlyBreakdown[CostCategory.CONSULTANTS] += legalFeeAmount.toNumber(); 
       
       // Legal usually Taxable
       monthlyGSTPaid = monthlyGSTPaid.plus(legalFeeAmount.times(0.1));
    }

    // Month X: Settlement Balance + Duty + Agent
    if (m === settlementPeriod) {
       // Explicitly identifying debt-funded portion (Land + Duty)
       periodSettlementDebt = settlementAmount.plus(stampDutyAmount);
       
       monthlyNetCost = monthlyNetCost.plus(periodSettlementDebt).plus(buyersAgentAmount);
       
       monthlyBreakdown[CostCategory.LAND] += settlementAmount.toNumber();
       monthlyBreakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber(); 
       monthlyBreakdown[CostCategory.CONSULTANTS] += buyersAgentAmount.toNumber(); 

       // Duty is GST Free. Buyers Agent is Taxable.
       monthlyGSTPaid = monthlyGSTPaid.plus(buyersAgentAmount.times(0.1));
    }

    // 2. Generic Costs (Skipping LAND category)
    costs.forEach(cost => {
      if (cost.category === CostCategory.LAND) return; // Strict skip

      let monthlyBaseValue = new Decimal(0);
      const isDynamicAgentFee = (cost.specialTag === 'AGENT_FEE' || cost.specialTag === 'LEGAL_SALES') && cost.inputType === InputType.PCT_REVENUE;

      let effectiveStartMonth = cost.startDate;
      // TIMELINE LINK: Shift all construction costs by Settlement + Delay
      if (cost.category === CostCategory.CONSTRUCTION) {
         effectiveStartMonth += constructionPhaseStart;
      }

      if (isDynamicAgentFee) {
         if (monthlyGrossRevenue.gt(0)) {
            monthlyBaseValue = monthlyGrossRevenue.times(cost.amount).dividedBy(100);
         }
      } else if (m >= effectiveStartMonth && m < effectiveStartMonth + cost.span) {
         const totalAmount = calculateLineItemTotal(cost, settings, constructionSum, totalRevenue);
         monthlyBaseValue = distributeValue(totalAmount, m - effectiveStartMonth, cost);
      }

      if (monthlyBaseValue.gt(0)) {
        let monthlyEscalated = monthlyBaseValue;
        if (!isDynamicAgentFee) {
            const annualRate = (cost.escalationRate || 0) / 100;
            if (annualRate > 0) {
               const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
               const compoundingFactor = new Decimal(Math.pow(1 + monthlyRate, m));
               monthlyEscalated = monthlyBaseValue.times(compoundingFactor);
            }
        }
        monthlyNetCost = monthlyNetCost.plus(monthlyEscalated);
        monthlyBreakdown[cost.category] = (monthlyBreakdown[cost.category] || 0) + monthlyEscalated.toNumber();

        if (cost.gstTreatment === GstTreatment.TAXABLE) {
          const gstRate = (settings.gstRate || 10) / 100;
          monthlyGSTPaid = monthlyGSTPaid.plus(monthlyEscalated.times(gstRate));
        }
      }
    });

    if (m === 0) {
      monthlyNetCost = monthlyNetCost.plus(unpaidSeniorFee).plus(unpaidMezzFee);
      monthlyBreakdown[CostCategory.FINANCE] += (unpaidSeniorFee.toNumber() + unpaidMezzFee.toNumber());
    }

    // --- STEP C: FUNDING ---
    const seniorRate = getMonthlyInterestRate(settings.capitalStack.senior, m);
    const mezzRate = getMonthlyInterestRate(settings.capitalStack.mezzanine, m);
    
    const seniorLineFeeRate = new Decimal(settings.capitalStack.senior.lineFee || 0).dividedBy(100).dividedBy(12);
    const seniorActive = m >= (settings.capitalStack.senior.activationMonth || 0);
    const seniorLineFee = (seniorActive && seniorLimit.lt(9999999999)) ? seniorLimit.times(seniorLineFeeRate) : new Decimal(0);

    const mezzLineFeeRate = new Decimal(settings.capitalStack.mezzanine.lineFee || 0).dividedBy(100).dividedBy(12);
    const mezzActive = m >= (settings.capitalStack.mezzanine.activationMonth || 0);
    const mezzLineFee = (mezzActive && mezzLimit.lt(9999999999)) ? mezzLimit.times(mezzLineFeeRate) : new Decimal(0);

    const interestSenior = seniorBalance.times(seniorRate).plus(seniorLineFee);
    const interestMezz = mezzBalance.times(mezzRate).plus(mezzLineFee);

    const lendingRate = new Decimal(settings.capitalStack.surplusInterestRate || 0).dividedBy(100).dividedBy(12);
    const lendingInterestIncome = surplusBalance.times(lendingRate);

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

    const totalOutflow = monthlyNetCost.plus(monthlyGSTPaid).plus(financeFundingNeed);
    const totalInflow = monthlyNetRevenue.plus(pendingITCRefund).plus(lendingInterestIncome);
    
    pendingITCRefund = monthlyGSTPaid;

    const netPeriodCashflow = totalInflow.minus(totalOutflow);
    runningCumulativeCashflow = runningCumulativeCashflow.plus(netPeriodCashflow);
    
    // --- FUNDING WATERFALL (With Explicit Intervention) ---
    
    let fundingNeed = new Decimal(0);
    let repaymentCapacity = new Decimal(0);

    let drawEquity = new Decimal(0);
    let drawMezz = new Decimal(0);
    let drawSenior = new Decimal(0);

    if (netPeriodCashflow.lt(0)) {
       fundingNeed = netPeriodCashflow.abs();
       
       // 1. Mandatory Equity Draw (Deposit)
       if (periodDeposit.gt(0)) {
          drawEquity = drawEquity.plus(periodDeposit);
          cumulativeEquityUsed = cumulativeEquityUsed.plus(periodDeposit);
          
          // If the project had revenue, reduce the 'need', otherwise just consider it funded.
          if (fundingNeed.gt(0)) {
             const usedForDeficit = Decimal.min(fundingNeed, periodDeposit);
             fundingNeed = fundingNeed.minus(usedForDeficit);
             // Any excess deposit injection goes to surplus (unlikely if cost is high, but strictly accounting)
             const excessInjection = periodDeposit.minus(usedForDeficit);
             surplusBalance = surplusBalance.plus(excessInjection);
          } else {
             // Revenue covered cost, but we injected equity anyway? 
             // In Deal Structure, yes, Deposit is Equity Injection.
             surplusBalance = surplusBalance.plus(periodDeposit);
          }
       }

       // 2. Mandatory Senior Draw (Settlement + Duty)
       if (periodSettlementDebt.gt(0)) {
          drawSenior = drawSenior.plus(periodSettlementDebt);
          seniorBalance = seniorBalance.plus(periodSettlementDebt);
          
          if (fundingNeed.gt(0)) {
             const usedForDeficit = Decimal.min(fundingNeed, periodSettlementDebt);
             fundingNeed = fundingNeed.minus(usedForDeficit);
             const excessDraw = periodSettlementDebt.minus(usedForDeficit);
             surplusBalance = surplusBalance.plus(excessDraw);
          } else {
             surplusBalance = surplusBalance.plus(periodSettlementDebt);
          }
       }

       // 3. Use Surplus for Remaining Need
       if (fundingNeed.gt(0) && surplusBalance.gt(0)) {
         const fromSurplus = Decimal.min(surplusBalance, fundingNeed);
         surplusBalance = surplusBalance.minus(fromSurplus);
         fundingNeed = fundingNeed.minus(fromSurplus);
       }
    } else {
       repaymentCapacity = netPeriodCashflow;
    }

    // 4. Standard Waterfall for Remaining Need
    if (fundingNeed.gt(0)) {
        if (equityConfig.mode === EquityMode.PCT_MONTHLY) {
            const pariPassuPct = new Decimal(equityConfig.percentageInput).dividedBy(100);
            const targetEquityDraw = fundingNeed.times(pariPassuPct);
            drawEquity = drawEquity.plus(targetEquityDraw);
            cumulativeEquityUsed = cumulativeEquityUsed.plus(targetEquityDraw);
            fundingNeed = fundingNeed.minus(targetEquityDraw);

        } else if (equityConfig.mode === EquityMode.INSTALMENTS) {
             const injection = equityConfig.instalments.find(i => i.month === m);
             if (injection) {
                 const amount = new Decimal(injection.amount);
                 drawEquity = drawEquity.plus(amount); 
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
            // Sum of Money / % Land / % Total Cost all act as a pool cap
            const available = totalEquityCommitted.minus(cumulativeEquityUsed);
            if (available.gt(0)) {
                const amount = Decimal.min(available, fundingNeed);
                drawEquity = drawEquity.plus(amount);
                cumulativeEquityUsed = cumulativeEquityUsed.plus(amount);
                fundingNeed = fundingNeed.minus(amount);
            }
        }
    }

    const mezzAvailable = mezzLimit.minus(mezzBalance);
    if (fundingNeed.gt(0) && mezzAvailable.gt(0)) {
      const amount = Decimal.min(fundingNeed, mezzAvailable);
      drawMezz = amount;
      mezzBalance = mezzBalance.plus(amount);
      fundingNeed = fundingNeed.minus(amount);
    }

    if (fundingNeed.gt(0)) {
      drawSenior = drawSenior.plus(fundingNeed);
      seniorBalance = seniorBalance.plus(fundingNeed);
      fundingNeed = new Decimal(0);
    }

    // Repayment Logic
    let repaySenior = new Decimal(0);
    let repayMezz = new Decimal(0);
    let repayEquity = new Decimal(0);

    if (repaymentCapacity.gt(0)) {
        if (seniorBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, seniorBalance);
            repaySenior = amount;
            seniorBalance = seniorBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        if (repaymentCapacity.gt(0) && mezzBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, mezzBalance);
            repayMezz = amount;
            mezzBalance = mezzBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        if (repaymentCapacity.gt(0)) {
            repayEquity = repaymentCapacity;
        }
    }

    flows.push({
      month: m,
      label: getMonthLabel(settings.startDate, m),
      developmentCosts: monthlyNetCost.toNumber(),
      costBreakdown: monthlyBreakdown,
      grossRevenue: monthlyGrossRevenue.toNumber(),
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
      cumulativeCashflow: runningCumulativeCashflow.toNumber()
    });
  }

  return flows;
};

// ... keep existing stats/report functions ...
const calculateReportStats = (settings: FeasibilitySettings, costs: LineItem[], revenues: RevenueItem[]) => {
  const totalRevenueGross = revenues.reduce((acc, rev) => {
      if (rev.strategy === 'Hold') {
          const grossAnnualRent = (rev.weeklyRent || 0) * 52 * rev.units;
          const durationYears = (settings.durationMonths - rev.settlementDate) / 12;
          const totalRent = durationYears > 0 ? grossAnnualRent * durationYears : 0;
          const netAnnualRent = grossAnnualRent * (1 - (rev.opexRate || 0) / 100);
          const capRate = (rev.capRate || 5) / 100;
          const terminalValue = capRate > 0 ? netAnnualRent / capRate : 0;
          return acc + totalRent + terminalValue;
      }
      return acc + (rev.units * rev.pricePerUnit);
  }, 0);

  let gstCollected = 0;
  if (settings.useMarginScheme) {
    const margin = Math.max(0, totalRevenueGross - settings.acquisition.purchasePrice);
    gstCollected = margin / 11;
  } else {
    gstCollected = totalRevenueGross / 11;
  }

  const netRealisation = totalRevenueGross - gstCollected;
  let totalItc = 0;
  const grossCostsByCategory: Record<string, number> = {};
  Object.values(CostCategory).forEach(cat => grossCostsByCategory[cat] = 0);

  // Add structured costs
  const { purchasePrice, stampDutyState, isForeignBuyer, buyersAgentFee, legalFeeEstimate } = settings.acquisition;
  const duty = calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer);
  const agentFee = purchasePrice * (buyersAgentFee/100);
  const legalFee = legalFeeEstimate;

  grossCostsByCategory[CostCategory.LAND] += purchasePrice;
  grossCostsByCategory[CostCategory.STATUTORY] += duty;
  grossCostsByCategory[CostCategory.CONSULTANTS] += (agentFee + legalFee);
  
  // ITC on structured costs
  totalItc += (agentFee * 0.1) + (legalFee * 0.1);

  // Add generic costs
  const constructionTotal = costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((acc, c) => acc + c.amount, 0); // Simplified for stats
  
  costs.forEach(item => {
    if (item.category === CostCategory.LAND) return; // Skip old items
    const netAmount = calculateLineItemTotal(item, settings, constructionTotal, totalRevenueGross);
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
  calculateIRR,
  calculateStampDuty
};
