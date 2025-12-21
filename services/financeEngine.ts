
import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment, SiteDNA, FeasibilityScenario
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
    const surchargeRate = state === 'QLD' ? 0.07 : 0.08;
    duty += (price * surchargeRate);
  }

  return duty;
};

// --- EXPORTED HELPERS ---

export const calculateLineItemTotal = (
  item: LineItem, 
  settings: FeasibilitySettings, 
  siteDNA: SiteDNA,
  constructionSum: number, 
  totalRevenue: number
): number => {
  const val = new Decimal(item.amount);
  switch (item.inputType) {
    case InputType.PCT_REVENUE:
      return val.dividedBy(100).times(totalRevenue).toNumber();
    case InputType.PCT_CONSTRUCTION:
      return val.dividedBy(100).times(constructionSum).toNumber();
    case InputType.RATE_PER_UNIT:
      return val.times(settings.totalUnits).toNumber();
    case InputType.RATE_PER_SQM:
      return val.times(siteDNA.landArea || 0).toNumber();
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

const getMonthlyInterestRate = (tier: CapitalTier, currentMonth: number): Decimal => {
  let annualRate = 0;
  if (tier.rateMode === InterestRateMode.SINGLE) {
    annualRate = tier.interestRate;
  } else {
    const activeRate = [...tier.variableRates]
      .sort((a, b) => a.month - b.month)
      .reverse()
      .find(r => r.month <= currentMonth);
    annualRate = activeRate ? activeRate.rate : tier.interestRate;
  }
  return new Decimal(annualRate).dividedBy(100).dividedBy(12);
};

const calculateConstructionCompletionMonth = (costs: LineItem[], constructionPhaseStart: number): number => {
  let maxMonth = constructionPhaseStart;
  costs.forEach(c => {
    if (c.category === CostCategory.CONSTRUCTION) {
      const start = constructionPhaseStart + c.startDate;
      const end = start + c.span;
      if (end > maxMonth) maxMonth = end;
    }
  });
  return maxMonth;
};

// Main Cashflow Engine
const calculateMonthlyCashflow = (
  scenario: FeasibilityScenario,
  siteDNA: SiteDNA,
  linkedScenario?: FeasibilityScenario // The "Development Basis" scenario for Hold models
): MonthlyFlow[] => {
  
  // -- SCENARIO LINKING (GOLDEN THREAD) --
  // If this is a HOLD scenario with a linked SELL scenario, we inherit the development costs and acquisition settings.
  // We also merge any local 'operating' costs defined in the HOLD scenario itself.
  const activeSettings = linkedScenario ? { ...scenario.settings, acquisition: linkedScenario.settings.acquisition } : scenario.settings;
  
  // Merge costs: Use Linked Scenario for Development (Base) + Local Scenario for Operating/Holding
  // This allows the user to add "Operating Expenses" in the HOLD scenario without losing the construction costs from the SELL scenario.
  let activeCosts = linkedScenario ? [...linkedScenario.costs] : [...scenario.costs];
  
  if (linkedScenario) {
      // Append costs from the current HOLD scenario (assuming these are Operating/Statutory costs)
      activeCosts = [...activeCosts, ...scenario.costs];
  }

  const activeRevenues = scenario.revenues;

  const flows: MonthlyFlow[] = [];

  // Calculate Aggregates for % allocations
  const totalRevenue = activeRevenues.reduce((acc, rev) => {
    if (rev.strategy === 'Hold') {
       // For Hold, Revenue base for cost alloc is usually gross annual rent * multiplier or similar, but simplified here to just rent.
       // Ideally we use the linked scenario's sales revenue if available for PCT_REVENUE costs like agents.
       return acc.plus((rev.weeklyRent || 0) * 52 * rev.units);
    } else {
       return acc.plus(new Decimal(rev.units).times(rev.pricePerUnit));
    }
  }, new Decimal(0)).toNumber();

  const constructionSum = activeCosts
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  // Timeline & Phases
  const { purchasePrice, depositPercent, settlementPeriod, legalFeeEstimate, buyersAgentFee, stampDutyState, isForeignBuyer } = activeSettings.acquisition;
  const constructionDelay = activeSettings.constructionDelay || 0; 
  const constructionPhaseStart = settlementPeriod + constructionDelay;
  const constructionEndMonth = calculateConstructionCompletionMonth(activeCosts, constructionPhaseStart);

  // Hold Strategy Settings
  const isHold = scenario.strategy === 'HOLD';
  const holdPeriodYears = activeSettings.holdStrategy?.holdPeriodYears || 0;
  const horizonMonths = isHold && holdPeriodYears > 0 
    ? constructionEndMonth + (holdPeriodYears * 12) 
    : activeSettings.durationMonths;

  // Initial Costs
  const depositAmount = new Decimal(purchasePrice).times(depositPercent).dividedBy(100);
  const settlementAmount = new Decimal(purchasePrice).minus(depositAmount);
  const stampDutyAmount = new Decimal(calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer));
  const buyersAgentAmount = new Decimal(purchasePrice).times(buyersAgentFee || 0).dividedBy(100);
  const legalFeeAmount = new Decimal(legalFeeEstimate);

  // Determine Land Base for Margin Scheme (if applicable)
  const marginLandBase = activeSettings.useMarginScheme ? new Decimal(purchasePrice) : new Decimal(0);

  // -- DEBT SETUP --
  const getFee = (tier: CapitalTier, limit: Decimal) => {
    if (tier.establishmentFeeBase === FeeBase.FIXED) return new Decimal(tier.establishmentFee);
    return limit.times(tier.establishmentFee).dividedBy(100);
  };

  const getDynamicLimit = (tier: CapitalTier) => {
    const rawLimit = tier.limit || 0;
    if (tier.limitMethod === DebtLimitMethod.LVR) return new Decimal(totalRevenue).times(rawLimit).dividedBy(100);
    // Note: For LTC, we really need the dynamic TDC including interest, but we estimate pre-interest here for limits
    if (tier.limitMethod === DebtLimitMethod.LTC) return new Decimal(constructionSum + purchasePrice).times(rawLimit).dividedBy(100);
    return new Decimal(rawLimit > 0 ? rawLimit : 9999999999);
  };

  const seniorLimit = getDynamicLimit(activeSettings.capitalStack.senior);
  const mezzLimit = getDynamicLimit(activeSettings.capitalStack.mezzanine);
  const seniorEstabFee = getFee(activeSettings.capitalStack.senior, seniorLimit);
  const mezzEstabFee = getFee(activeSettings.capitalStack.mezzanine, mezzLimit);

  // -- EQUITY SETUP --
  const equityConfig = activeSettings.capitalStack.equity;
  
  // -- DEPRECIATION SETUP (For Hold) --
  let depreciableCapitalWorks = new Decimal(0);
  let depreciablePlant = new Decimal(0);
  if (activeSettings.holdStrategy && activeSettings.holdStrategy.depreciationSplit) {
      const capWorksPct = new Decimal(activeSettings.holdStrategy.depreciationSplit.capitalWorksPct || 0).dividedBy(100);
      const plantPct = new Decimal(activeSettings.holdStrategy.depreciationSplit.plantPct || 0).dividedBy(100);
      depreciableCapitalWorks = new Decimal(constructionSum).times(capWorksPct);
      depreciablePlant = new Decimal(constructionSum).times(plantPct);
  }

  // Running Balances
  let cumulativeEquityUsed = new Decimal(0);
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);
  let investmentBalance = new Decimal(0); // For Refinance Loan
  let surplusBalance = new Decimal(0);
  let pendingITCRefund = new Decimal(0); // GST credits waiting for next month
  let currentAssetValue = new Decimal(purchasePrice); // Start at Land Value
  let unpaidSeniorFee = seniorEstabFee;
  let unpaidMezzFee = mezzEstabFee;
  let runningCumulativeCashflow = new Decimal(0);

  // --- MONTHLY LOOP ---
  for (let m = 0; m <= horizonMonths; m++) {
    
    // 1. Inflows (Sales or Rent)
    let monthlyNetRevenue = new Decimal(0);
    let monthlyGrossRevenue = new Decimal(0);
    let monthlyRefinanceInflow = new Decimal(0);
    let investmentInterest = new Decimal(0);
    let monthlyDepreciation = new Decimal(0);

    const monthlyBreakdown: Record<CostCategory, number> = {
        [CostCategory.LAND]: 0,
        [CostCategory.CONSULTANTS]: 0,
        [CostCategory.CONSTRUCTION]: 0,
        [CostCategory.STATUTORY]: 0,
        [CostCategory.MISCELLANEOUS]: 0, // Outgoings often go here
        [CostCategory.SELLING]: 0,       // Management/Leasing Fees go here
        [CostCategory.FINANCE]: 0
    };

    // --- REFINANCE EVENT (Specific to HOLD) ---
    // At the designated refinance month, we value the asset based on yield and draw a new Investment Loan
    if (activeSettings.holdStrategy && m === activeSettings.holdStrategy.refinanceMonth) {
        // Calculate Valuation: Sum of (Net Rent / Cap Rate) for all rental items
        const totalHoldValuation = activeRevenues
            .filter(r => r.strategy === 'Hold')
            .reduce((acc, r) => {
                const grossAnnualRent = new Decimal(r.weeklyRent || 0).times(52).times(r.units);
                // Standard deduction for valuation usually allows for management/vacancy, here we use the user's Opex Rate as a proxy for 'Net'
                const netAnnualRent = grossAnnualRent.times(1 - (r.opexRate || 0) / 100);
                const capRate = (r.capRate || 5) / 100;
                const val = capRate > 0 ? netAnnualRent.dividedBy(capRate) : new Decimal(0);
                return acc.plus(val);
            }, new Decimal(0));
        
        if (totalHoldValuation.gt(0)) {
            currentAssetValue = totalHoldValuation; // Update asset value to 'As Completed' valuation
            const refiAmount = totalHoldValuation.times((activeSettings.holdStrategy.refinanceLvr || 65) / 100);
            
            // This inflow effectively pays out the development debt in the waterfall below
            monthlyRefinanceInflow = refiAmount; 
            investmentBalance = refiAmount;
        }
    }

    // --- OPERATING PHASE LOGIC (Post-Refi) ---
    if (activeSettings.holdStrategy && m >= activeSettings.holdStrategy.refinanceMonth) {
        
        // Investment Loan Interest
        const annualInvRate = activeSettings.holdStrategy.investmentRate || 0;
        const monthlyInvRate = new Decimal(annualInvRate).dividedBy(100).dividedBy(12);
        investmentInterest = investmentBalance.times(monthlyInvRate);

        // Capital Growth
        const annualGrowth = activeSettings.holdStrategy.annualCapitalGrowth || 0;
        if (annualGrowth > 0) {
            const monthlyGrowthRate = Math.pow(1 + (annualGrowth/100), 1/12) - 1;
            currentAssetValue = currentAssetValue.times(1 + monthlyGrowthRate);
        }

        // Depreciation (Non-Cash)
        const monthlyCapWorksDep = depreciableCapitalWorks.times(0.025).dividedBy(12);
        const monthlyPlantDep = depreciablePlant.times(0.10).dividedBy(12);
        monthlyDepreciation = monthlyCapWorksDep.plus(monthlyPlantDep);
    }

    // --- REVENUE CALCULATION ---
    activeRevenues.forEach(rev => {
      if (rev.strategy === 'Hold') {
         const rentStart = constructionEndMonth + (rev.offsetFromCompletion || 0); 
         if (m >= rentStart) {
            // Is this the exit month?
            if (m === horizonMonths && holdPeriodYears > 0) {
               // Calculate Investment Sale Price (ISP)
               const grossAnnualRent = new Decimal(rev.weeklyRent || 0).times(52).times(rev.units);
               const netAnnualRent = grossAnnualRent.times(1 - (rev.opexRate || 0) / 100); // Net Rent
               const terminalCap = (activeSettings.holdStrategy?.terminalCapRate || 5) / 100;
               const exitValue = terminalCap > 0 ? netAnnualRent.dividedBy(terminalCap) : new Decimal(0);
               
               // Inject Sale Proceeds
               monthlyGrossRevenue = monthlyGrossRevenue.plus(exitValue);
               monthlyNetRevenue = monthlyNetRevenue.plus(exitValue);
               
               // Sales costs on exit? Standard 2%
               const exitFees = exitValue.times(0.02);
               monthlyBreakdown[CostCategory.SELLING] += exitFees.toNumber();
               monthlyNetRevenue = monthlyNetRevenue.minus(exitFees);

            } else if (m < horizonMonths) {
                // Monthly Rent
                const grossAnnualRent = new Decimal(rev.weeklyRent || 0).times(52).times(rev.units);
                const monthlyGross = grossAnnualRent.dividedBy(12);
                
                // Lease Up Logic
                const monthsSinceOpen = m - rentStart;
                let occupancyRate = 1;
                if (rev.leaseUpDuration && rev.leaseUpDuration > 0) {
                    occupancyRate = Math.min(1, monthsSinceOpen / rev.leaseUpDuration);
                }
                const realizedGross = monthlyGross.times(occupancyRate);
                monthlyGrossRevenue = monthlyGrossRevenue.plus(realizedGross);

                // --- HOLDING COSTS INJECTION ---
                // 1. Management Fees (Standard 6%)
                const managementFee = realizedGross.times(0.06);
                // 2. Leasing Fees (Approx 2% spread annually)
                const leasingFee = realizedGross.times(0.02);
                // 3. Outgoings (User Opex Rate)
                const outgoings = realizedGross.times((rev.opexRate || 0) / 100);

                // Map to Categories for Report
                monthlyBreakdown[CostCategory.SELLING] += managementFee.plus(leasingFee).toNumber(); // Map Mgmt to Selling/Admin
                monthlyBreakdown[CostCategory.MISCELLANEOUS] += outgoings.toNumber(); // Map Opex to Misc

                const totalOperatingCosts = managementFee.plus(leasingFee).plus(outgoings);
                
                // GST on Commercial Rent vs Resi? Assuming Resi BTR (Input Taxed).
                
                monthlyNetRevenue = monthlyNetRevenue.plus(realizedGross.minus(totalOperatingCosts));
            }
         }
      } else {
        // Sell Strategy Revenue (Settlements)
        const settleStart = constructionEndMonth + (rev.offsetFromCompletion || 0); 
        const span = Math.max(1, rev.settlementSpan || 1); 
        const settleEnd = settleStart + span;

        if (m >= settleStart && m < settleEnd) {
            const totalGrossVal = new Decimal(rev.units).times(rev.pricePerUnit);
            const monthlyGross = totalGrossVal.dividedBy(span);
            monthlyGrossRevenue = monthlyGrossRevenue.plus(monthlyGross);
            
            const monthlyCommission = monthlyGross.times(rev.commissionRate).dividedBy(100);
            monthlyBreakdown[CostCategory.SELLING] += monthlyCommission.toNumber();
            
            let gstLiability = new Decimal(0);
            if (rev.isTaxable) {
                if (activeSettings.useMarginScheme) {
                    const totalUnits = activeSettings.totalUnits || 1;
                    const allocatedLandBase = marginLandBase.times(rev.units).dividedBy(totalUnits).dividedBy(span);
                    const margin = monthlyGross.minus(allocatedLandBase);
                    if (margin.gt(0)) gstLiability = margin.dividedBy(11);
                } else {
                    gstLiability = monthlyGross.dividedBy(11);
                }
            }
            monthlyNetRevenue = monthlyNetRevenue.plus(monthlyGross.minus(monthlyCommission).minus(gstLiability));
        }
      }
    });

    // 2. Development Costs (Outflows)
    let monthlyNetCost = new Decimal(0);
    let monthlyGSTPaid = new Decimal(0);
    let periodDeposit = new Decimal(0);
    let periodSettlementDebt = new Decimal(0);

    // Month 0: Exchange
    if (m === 0) {
       periodDeposit = depositAmount;
       monthlyNetCost = monthlyNetCost.plus(periodDeposit).plus(legalFeeAmount);
       monthlyBreakdown[CostCategory.LAND] += periodDeposit.toNumber();
       monthlyBreakdown[CostCategory.CONSULTANTS] += legalFeeAmount.toNumber(); 
       monthlyGSTPaid = monthlyGSTPaid.plus(legalFeeAmount.times(0.1));
    }

    // Settlement Month: Completion of Acquisition
    if (m === settlementPeriod) {
       periodSettlementDebt = settlementAmount.plus(stampDutyAmount);
       monthlyNetCost = monthlyNetCost.plus(periodSettlementDebt).plus(buyersAgentAmount);
       monthlyBreakdown[CostCategory.LAND] += settlementAmount.toNumber();
       monthlyBreakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber(); 
       monthlyBreakdown[CostCategory.CONSULTANTS] += buyersAgentAmount.toNumber(); 
       monthlyGSTPaid = monthlyGSTPaid.plus(buyersAgentAmount.times(0.1));
    }

    // Process Line Items (Construction & Operating)
    activeCosts.forEach(cost => {
      if (cost.category === CostCategory.LAND) return; // Handled above

      let monthlyBaseValue = new Decimal(0);
      const isDynamicAgentFee = (cost.specialTag === 'AGENT_FEE' || cost.specialTag === 'LEGAL_SALES') && cost.inputType === InputType.PCT_REVENUE;

      let effectiveStartMonth = cost.startDate;
      if (cost.category === CostCategory.CONSTRUCTION) {
         effectiveStartMonth += constructionPhaseStart;
      }

      if (isDynamicAgentFee) {
         // Agent fees processed in Revenue loop generally, but if added as cost item:
         if (monthlyGrossRevenue.gt(0)) {
            monthlyBaseValue = monthlyGrossRevenue.times(cost.amount).dividedBy(100);
         }
      } else if (m >= effectiveStartMonth && m < effectiveStartMonth + cost.span) {
         const totalAmount = calculateLineItemTotal(cost, activeSettings, siteDNA, constructionSum, totalRevenue);
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
          const gstRate = (activeSettings.gstRate || 10) / 100;
          monthlyGSTPaid = monthlyGSTPaid.plus(monthlyEscalated.times(gstRate));
        }
      }
    });

    // Pay Loan Fees at Month 0
    if (m === 0) {
      monthlyNetCost = monthlyNetCost.plus(unpaidSeniorFee).plus(unpaidMezzFee);
      monthlyBreakdown[CostCategory.FINANCE] += (unpaidSeniorFee.toNumber() + unpaidMezzFee.toNumber());
    }

    // 3. Finance Calculations
    const seniorRate = getMonthlyInterestRate(activeSettings.capitalStack.senior, m);
    const mezzRate = getMonthlyInterestRate(activeSettings.capitalStack.mezzanine, m);
    
    // Line Fees
    const seniorLineFeeRate = new Decimal(activeSettings.capitalStack.senior.lineFee || 0).dividedBy(100).dividedBy(12);
    const seniorActive = m >= (activeSettings.capitalStack.senior.activationMonth || 0);
    const seniorLineFee = (seniorActive && seniorLimit.lt(9999999999)) ? seniorLimit.times(seniorLineFeeRate) : new Decimal(0);

    const mezzLineFeeRate = new Decimal(activeSettings.capitalStack.mezzanine.lineFee || 0).dividedBy(100).dividedBy(12);
    const mezzActive = m >= (activeSettings.capitalStack.mezzanine.activationMonth || 0);
    const mezzLineFee = (mezzActive && mezzLimit.lt(9999999999)) ? mezzLimit.times(mezzLineFeeRate) : new Decimal(0);

    // Interest Calc
    const interestSenior = seniorBalance.times(seniorRate).plus(seniorLineFee);
    const interestMezz = mezzBalance.times(mezzRate).plus(mezzLineFee);

    // Surplus Interest
    const lendingRate = new Decimal(activeSettings.capitalStack.surplusInterestRate || 0).dividedBy(100).dividedBy(12);
    const lendingInterestIncome = surplusBalance.times(lendingRate);

    // Capitalisation Logic
    let financeFundingNeed = new Decimal(0);

    if (seniorBalance.gt(0)) {
        if (activeSettings.capitalStack.senior.isInterestCapitalised !== false) { 
            seniorBalance = seniorBalance.plus(interestSenior);
        } else {
            financeFundingNeed = financeFundingNeed.plus(interestSenior);
        }
    }

    if (mezzBalance.gt(0)) {
        if (activeSettings.capitalStack.mezzanine.isInterestCapitalised !== false) {
            mezzBalance = mezzBalance.plus(interestMezz);
        } else {
            financeFundingNeed = financeFundingNeed.plus(interestMezz);
        }
    }

    financeFundingNeed = financeFundingNeed.plus(investmentInterest);

    // 4. Net Position for Month
    const totalOutflow = monthlyNetCost.plus(monthlyGSTPaid).plus(financeFundingNeed);
    const totalInflow = monthlyNetRevenue.plus(pendingITCRefund).plus(lendingInterestIncome).plus(monthlyRefinanceInflow);
    pendingITCRefund = monthlyGSTPaid; // GST paid this month is claimed next month

    const netPeriodCashflow = totalInflow.minus(totalOutflow);
    runningCumulativeCashflow = runningCumulativeCashflow.plus(netPeriodCashflow);
    
    // 5. Funding & Waterfall
    let fundingNeed = new Decimal(0);
    let repaymentCapacity = new Decimal(0);
    let drawEquity = new Decimal(0);
    let drawMezz = new Decimal(0);
    let drawSenior = new Decimal(0);

    if (netPeriodCashflow.lt(0)) {
       // Deficit - Need Funding
       fundingNeed = netPeriodCashflow.abs();
       
       // a. Use Injection Specifics (Deposit/Settlement specific logic)
       if (periodDeposit.gt(0)) {
          drawEquity = drawEquity.plus(periodDeposit);
          cumulativeEquityUsed = cumulativeEquityUsed.plus(periodDeposit);
          fundingNeed = fundingNeed.minus(Decimal.min(fundingNeed, periodDeposit));
          // If surplus from deposit, add to surplus balance
          if (periodDeposit.gt(fundingNeed)) surplusBalance = surplusBalance.plus(periodDeposit.minus(fundingNeed));
       }

       if (periodSettlementDebt.gt(0)) {
          // Force draw senior for settlement regardless of waterfall
          drawSenior = drawSenior.plus(periodSettlementDebt);
          seniorBalance = seniorBalance.plus(periodSettlementDebt);
          fundingNeed = fundingNeed.minus(Decimal.min(fundingNeed, periodSettlementDebt));
       }

       // b. Use Surplus Cash
       if (fundingNeed.gt(0) && surplusBalance.gt(0)) {
         const fromSurplus = Decimal.min(surplusBalance, fundingNeed);
         surplusBalance = surplusBalance.minus(fromSurplus);
         fundingNeed = fundingNeed.minus(fromSurplus);
       }
    } else {
       // Surplus - Repay Debt or Distribute
       repaymentCapacity = netPeriodCashflow;
    }

    if (fundingNeed.gt(0)) {
        // Stop drawing construction debt after Refi
        const allowDebtDraw = !activeSettings.holdStrategy || m < activeSettings.holdStrategy.refinanceMonth; 

        if (allowDebtDraw) {
             // 1. Mezzanine
             const mezzAvailable = mezzLimit.minus(mezzBalance);
             if (mezzAvailable.gt(0)) {
                const amount = Decimal.min(fundingNeed, mezzAvailable);
                drawMezz = amount;
                mezzBalance = mezzBalance.plus(amount);
                fundingNeed = fundingNeed.minus(amount);
             }

             // 2. Senior
             if (fundingNeed.gt(0)) {
                drawSenior = drawSenior.plus(fundingNeed);
                seniorBalance = seniorBalance.plus(fundingNeed);
                fundingNeed = new Decimal(0);
             }
        }

        // 3. Equity (Fallback)
        if (fundingNeed.gt(0)) {
            // Apply Equity Mode Logic (Simplified here to "Just Pay It")
            drawEquity = drawEquity.plus(fundingNeed);
            cumulativeEquityUsed = cumulativeEquityUsed.plus(fundingNeed);
            fundingNeed = new Decimal(0);
        }
    }

    let repaySenior = new Decimal(0);
    let repayMezz = new Decimal(0);
    let repayEquity = new Decimal(0);

    if (repaymentCapacity.gt(0)) {
        // Waterfall Repayment
        // 1. Senior Debt
        if (seniorBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, seniorBalance);
            repaySenior = amount;
            seniorBalance = seniorBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        // 2. Mezzanine Debt
        if (repaymentCapacity.gt(0) && mezzBalance.gt(0)) {
            const amount = Decimal.min(repaymentCapacity, mezzBalance);
            repayMezz = amount;
            mezzBalance = mezzBalance.minus(amount);
            repaymentCapacity = repaymentCapacity.minus(amount);
        }
        // 3. Investment Debt (At exit)
        if (m === horizonMonths && investmentBalance.gt(0) && repaymentCapacity.gt(0)) {
             const amount = Decimal.min(repaymentCapacity, investmentBalance);
             investmentBalance = investmentBalance.minus(amount);
             repaymentCapacity = repaymentCapacity.minus(amount);
        }
        // 4. Equity / Profit Distribution
        if (repaymentCapacity.gt(0)) {
            repayEquity = repaymentCapacity;
        }
    }

    // Asset Value Update (Accumulate Cost during dev, then Growth during hold)
    if (!activeSettings.holdStrategy || m <= activeSettings.holdStrategy.refinanceMonth) {
        currentAssetValue = currentAssetValue.plus(monthlyNetCost);
    }

    flows.push({
      month: m,
      label: getMonthLabel(activeSettings.startDate, m),
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
      cumulativeCashflow: runningCumulativeCashflow.toNumber(),
      investmentBalance: investmentBalance.toNumber(),
      investmentInterest: investmentInterest.toNumber(),
      assetValue: currentAssetValue.toNumber(),
      depreciation: monthlyDepreciation.toNumber()
    });
  }

  return flows;
};

// Report Stats Aggregator
const calculateReportStats = (scenario: FeasibilityScenario, siteDNA: SiteDNA) => {
  const { settings, costs, revenues } = scenario;
  const totalRevenueGross = revenues.reduce((acc, rev) => {
      if (rev.strategy === 'Hold') {
          // For Hold Stats: Use the Net Rent + Terminal Value logic approx
          const grossAnnualRent = (rev.weeklyRent || 0) * 52 * rev.units;
          const netAnnualRent = grossAnnualRent * (1 - (rev.opexRate || 0) / 100);
          const capRate = (rev.capRate || 5) / 100;
          const terminalValue = capRate > 0 ? netAnnualRent / capRate : 0;
          return acc + terminalValue; // This is the "Gross Realisation" of the asset
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

  const { purchasePrice, stampDutyState, isForeignBuyer, buyersAgentFee, legalFeeEstimate } = settings.acquisition;
  const duty = calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer);
  const agentFee = purchasePrice * (buyersAgentFee/100);
  const legalFee = legalFeeEstimate;

  grossCostsByCategory[CostCategory.LAND] += purchasePrice;
  grossCostsByCategory[CostCategory.STATUTORY] += duty;
  grossCostsByCategory[CostCategory.CONSULTANTS] += (agentFee + legalFee);
  
  totalItc += (agentFee * 0.1) + (legalFee * 0.1);

  const constructionTotal = costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((acc, c) => acc + c.amount, 0); 
  
  costs.forEach(item => {
    if (item.category === CostCategory.LAND) return; 
    const netAmount = calculateLineItemTotal(item, settings, siteDNA, constructionTotal, totalRevenueGross);
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
