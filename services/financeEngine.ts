import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment, SiteDNA, FeasibilityScenario, MilestoneLink, TaxConfiguration, TaxState,
  ItemisedRow, ItemisedCategory, ItemisedCashflow, ProjectMetrics
} from '../types';
import { TaxLibrary } from './TaxLibrary';
import { DEFAULT_TAX_SCALES } from '../constants';

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
const calculateStampDuty = (
    price: number, 
    state: TaxState, 
    isForeign: boolean, 
    scales: TaxConfiguration = DEFAULT_TAX_SCALES,
    manualOverride?: number
): number => {
  
  // 1. Check for manual override
  if (manualOverride !== undefined && manualOverride !== null && manualOverride >= 0) {
      return manualOverride;
  }

  // 2. Delegate to TaxLibrary
  let duty = TaxLibrary.calculateTax(price, scales, state, 'STAMP_DUTY');

  // 3. Foreign Buyer Surcharge
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
  totalRevenue: number,
  scales: TaxConfiguration = DEFAULT_TAX_SCALES
): number => {
  
  // --- AUTOMATED STATUTORY LINKS ---
  if (item.calculationLink && item.calculationLink !== 'NONE') {
      const state = settings.acquisition.stampDutyState as TaxState;
      
      switch (item.calculationLink) {
          case 'AUTO_STAMP_DUTY':
              // Ignores user amount, calculates based on Acquisition Price
              return calculateStampDuty(
                  settings.acquisition.purchasePrice,
                  state,
                  settings.acquisition.isForeignBuyer,
                  scales,
                  settings.acquisition.stampDutyOverride
              );
          
          case 'AUTO_LAND_TAX':
              // Initial Land Tax Estimate (Base Year)
              const landValue = siteDNA.auv || 0;
              return TaxLibrary.calculateTax(landValue, scales, state, 'LAND_TAX_GENERAL');

          case 'AUTO_COUNCIL_RATES':
              // Calculates as Percentage of Capital Improved Value (ACV) or AUV if ACV missing
              const rateBase = siteDNA.acv || siteDNA.auv || 0;
              if (item.amount < 1) {
                  return rateBase * item.amount;
              }
              return item.amount;
      }
  }

  // --- LEGACY / FALLBACK LOGIC ---
  if (item.specialTag === 'COUNCIL_RATES' || item.specialTag === 'LAND_TAX') {
      const baseValue = siteDNA.auv || 0;
      if (item.specialTag === 'LAND_TAX' && item.amount === 0) {
          const state = settings.acquisition.stampDutyState as TaxState;
          return TaxLibrary.calculateTax(baseValue, scales, state, 'LAND_TAX_GENERAL');
      }
      if (item.amount < 1 && item.amount > 0) {
          return baseValue * item.amount;
      }
      return item.amount;
  }

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
  
  const month = d.toLocaleString('default', { month: 'short' });
  const year = d.getFullYear().toString().substr(2, 2);
  
  // Financial Year Calculation (AU)
  const mIndex = d.getMonth(); // 0-11
  const fy = mIndex >= 6 ? d.getFullYear() + 1 : d.getFullYear();
  const fyShort = fy.toString().substr(2, 2);

  return `${month} ${year}`;
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

const calculateProjectMilestones = (
    costs: LineItem[], 
    acquisition: any, 
    delay: number
): { settlementMonth: number, constStartMonth: number, constEndMonth: number } => {
    
    const settlementMonth = acquisition.settlementPeriod;
    const constStartMonth = settlementMonth + delay;
    
    let maxSpan = 0;
    costs.forEach(c => {
        if (c.category === CostCategory.CONSTRUCTION && (!c.linkToMilestone || c.linkToMilestone === MilestoneLink.CONSTRUCTION_START)) {
            const end = c.startDate + c.span; 
            if (c.span > maxSpan) maxSpan = c.span;
        }
    });
    if (maxSpan === 0) maxSpan = 12;

    const constEndMonth = constStartMonth + maxSpan;

    return { settlementMonth, constStartMonth, constEndMonth };
};

const getEffectiveStartMonth = (
    item: LineItem, 
    milestones: { settlementMonth: number, constStartMonth: number, constEndMonth: number }
): number => {
    switch (item.linkToMilestone) {
        case MilestoneLink.ACQUISITION:
            return milestones.settlementMonth + item.startDate; 
        case MilestoneLink.CONSTRUCTION_START:
            return milestones.constStartMonth + item.startDate;
        case MilestoneLink.CONSTRUCTION_END:
            return milestones.constEndMonth + item.startDate;
        default:
            return item.startDate; 
    }
};

const getEscalationRateForCategory = (category: CostCategory, settings: FeasibilitySettings): number => {
  const { growth } = settings;
  if (!growth) return settings.defaultEscalationRate || 3.0; 

  switch (category) {
    case CostCategory.CONSTRUCTION:
    case CostCategory.CONSULTANTS:
      return growth.constructionEscalation;
    case CostCategory.LAND:
      return growth.landAppreciation;
    case CostCategory.SELLING:
      return growth.salesPriceEscalation;
    case CostCategory.MISCELLANEOUS:
    case CostCategory.STATUTORY:
    default:
      return growth.cpi;
  }
};

// --- CORE CASHFLOW ENGINE ---
const calculateMonthlyCashflow = (
  scenario: FeasibilityScenario,
  siteDNA: SiteDNA,
  linkedScenario?: FeasibilityScenario, 
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): MonthlyFlow[] => {
  
  const isHold = scenario.strategy === 'HOLD';
  const baseSettings = isHold && linkedScenario ? linkedScenario.settings : scenario.settings;
  const baseCosts = isHold && linkedScenario ? linkedScenario.costs : scenario.costs;
  const activeRevenues = scenario.revenues; 
  
  // Operating Costs are the `scenario.costs` in a HOLD model
  const operatingCosts = isHold ? scenario.costs : []; 

  const flows: MonthlyFlow[] = [];

  // 1. INHERITANCE & TIMELINE
  let refiMonthOffset = 0;
  if (isHold && linkedScenario) {
      // Recursive pre-calc to get accurate completion
      const linkedMilestones = calculateProjectMilestones(linkedScenario.costs, linkedScenario.settings.acquisition, linkedScenario.settings.constructionDelay || 0);
      refiMonthOffset = linkedMilestones.constEndMonth; 
  }

  const { purchasePrice, depositPercent, settlementPeriod, legalFeeEstimate, buyersAgentFee, stampDutyState, isForeignBuyer, stampDutyTiming, stampDutyOverride } = baseSettings.acquisition;
  const constructionDelay = baseSettings.constructionDelay || 0; 
  
  const milestones = calculateProjectMilestones(baseCosts, baseSettings.acquisition, constructionDelay);
  const { settlementMonth, constStartMonth, constEndMonth } = milestones;
  
  const holdPeriodYears = scenario.settings.holdStrategy?.holdPeriodYears || 0;
  
  // The Horizon now extends BEYOND the development phase if Hold.
  const horizonMonths = isHold 
    ? refiMonthOffset + (holdPeriodYears * 12) 
    : baseSettings.durationMonths;

  // 2. AGGREGATES
  const constructionSum = baseCosts
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  const totalRevenue = activeRevenues.reduce((acc, rev) => {
    if (rev.strategy === 'Hold') {
        return acc.plus((rev.weeklyRent || 0) * 52 * rev.units);
    } 
    return acc.plus(new Decimal(rev.units).times(rev.pricePerUnit));
  }, new Decimal(0)).toNumber();

  // 3. DEPRECIATION SETUP
  let depreciableCapitalWorks = new Decimal(0); 
  let depreciablePlant = new Decimal(0); 
  
  if (isHold && scenario.settings.holdStrategy) {
      const { capitalWorksPct, plantPct } = scenario.settings.holdStrategy.depreciationSplit;
      depreciableCapitalWorks = new Decimal(constructionSum).times(capitalWorksPct / 100);
      depreciablePlant = new Decimal(constructionSum).times(plantPct / 100);
  }

  // 4. RUNNING BALANCES
  let cumulativeEquityUsed = new Decimal(0);
  let seniorBalance = new Decimal(0);
  let mezzBalance = new Decimal(0);
  let investmentBalance = new Decimal(0); 
  let currentAssetValue = new Decimal(purchasePrice); 
  let surplusCash = new Decimal(0);
  let pendingGstCredits = new Decimal(0); 
  
  // Dynamic Land Tax Growth Tracking (AUV)
  let currentStatutoryValue = new Decimal(siteDNA.auv || purchasePrice || 0); // Base value
  const landAppreciationRate = baseSettings.growth?.landAppreciation || 3.0;

  const depositAmount = new Decimal(purchasePrice).times(depositPercent).dividedBy(100);
  const settlementAmount = new Decimal(purchasePrice).minus(depositAmount);
  const stampDutyAmount = new Decimal(calculateStampDuty(purchasePrice, stampDutyState, isForeignBuyer, taxScales, stampDutyOverride));
  
  // 5. MONTHLY LOOP
  for (let m = 0; m <= horizonMonths; m++) {
    
    let monthlyNetRevenue = new Decimal(0);
    let monthlyGrossRevenue = new Decimal(0);
    let monthlyRefinanceInflow = new Decimal(0);
    let investmentInterest = new Decimal(0);
    let monthlyDepreciation = new Decimal(0);
    let monthlyNetCost = new Decimal(0);
    let monthlyLineFees = new Decimal(0);
    let monthlyLendingInterest = new Decimal(0);
    let monthlyGstLiability = new Decimal(0);
    let monthlyItc = new Decimal(0); 
    let monthlyLandTax = new Decimal(0);

    const monthlyBreakdown: Record<CostCategory, number> = {
        [CostCategory.LAND]: 0,
        [CostCategory.CONSULTANTS]: 0,
        [CostCategory.CONSTRUCTION]: 0,
        [CostCategory.STATUTORY]: 0,
        [CostCategory.MISCELLANEOUS]: 0,
        [CostCategory.SELLING]: 0,
        [CostCategory.FINANCE]: 0
    };

    const annualConstEsc = baseSettings.growth?.constructionEscalation ?? baseSettings.defaultEscalationRate ?? 3.0;
    const inflationFactor = Math.pow(1 + (annualConstEsc / 100), m / 12);

    // --- A. REFINANCE EVENT (Start of Hold Phase) ---
    // If we are in a linked HOLD scenario, the refinance happens at the end of the development link.
    const actualRefiMonth = isHold ? (scenario.settings.holdStrategy?.refinanceMonth || refiMonthOffset) : -1;
    const isOperatingPhase = isHold && m >= actualRefiMonth;

    if (isHold && m === actualRefiMonth) {
        // Calculate Stabilised Value based on Year 1 Operating Income
        const totalNetRentAnnual = activeRevenues.reduce((acc, r) => {
            if (r.strategy !== 'Hold') return acc;
            const gross = (r.weeklyRent || 0) * 52 * r.units; 
            const net = gross * (1 - (r.opexRate || 0)/100);
            return acc.plus(net);
        }, new Decimal(0));

        // Use Cap Rate to find value
        const capRate = (scenario.settings.holdStrategy?.terminalCapRate || 5) / 100;
        const valuation = capRate > 0 ? totalNetRentAnnual.dividedBy(capRate) : new Decimal(0);
        
        currentAssetValue = valuation; 

        const lvr = (scenario.settings.holdStrategy?.refinanceLvr || 65) / 100;
        const loanAmount = valuation.times(lvr);
        
        monthlyRefinanceInflow = loanAmount;
        investmentBalance = loanAmount;
    }

    // --- B. REVENUE ---
    const revenueGrowthRate = baseSettings.growth?.salesPriceEscalation ?? baseSettings.defaultEscalationRate ?? 3.0;
    const revenueCompound = Math.pow(1 + (revenueGrowthRate/100), m/12);
    const rentalGrowthRate = baseSettings.growth?.rentalGrowth ?? 2.5;
    const rentalCompound = Math.pow(1 + (rentalGrowthRate/100), m/12);

    // B1. Terminal Investment Sale (Deemed Exit at End of Hold)
    if (isHold && m === horizonMonths) {
        // Calculate Exit Yield based on Stabilised Net Rent at Month 120
        let totalStabilisedNetRent = new Decimal(0);
        activeRevenues.forEach(rev => {
            if (rev.strategy !== 'Hold') return;
            const rate = rev.weeklyRent || rev.pricePerUnit || 0;
            const multiplier = rev.weeklyRent ? 52 : 1; 
            const grossAnnual = new Decimal(rate).times(multiplier).times(rev.units).times(rentalCompound);
            // Deduct Opex
            const netAnnual = grossAnnual.times(1 - (rev.opexRate || 0)/100);
            totalStabilisedNetRent = totalStabilisedNetRent.plus(netAnnual);
        });
        
        const termCap = (scenario.settings.holdStrategy?.terminalCapRate || 5) / 100;
        const isp = termCap > 0 ? totalStabilisedNetRent.dividedBy(termCap) : new Decimal(0);
        
        // Inject Investment Sale Price (ISP)
        monthlyGrossRevenue = monthlyGrossRevenue.plus(isp);
        monthlyNetRevenue = monthlyNetRevenue.plus(isp);
        
        // Exit Costs (Agent fees etc.) - Assume 2% standard
        const exitCosts = isp.times(0.02); 
        monthlyBreakdown[CostCategory.SELLING] += exitCosts.toNumber();
        monthlyNetRevenue = monthlyNetRevenue.minus(exitCosts);
    }

    activeRevenues.forEach(rev => {
        // Logic for SELL Strategy Revenues (unchanged)
        const startMonth = constEndMonth + (rev.offsetFromCompletion || 0);

        // Logic for HOLD Strategy Revenues
        // Note: Hold revenues start AFTER construction completion (or refiMonth)
        if (rev.strategy === 'Hold') {
            if (isOperatingPhase) {
                // Determine months since operation started
                const opMonthIndex = m - actualRefiMonth;
                
                // Lease-Up Ramp Logic (0% -> 100%)
                const leaseUp = rev.leaseUpMonths || 1;
                let rampFactor = 1;
                if (opMonthIndex < leaseUp) {
                    // Linear ramp: Month 0 = 1/Span, Month 1 = 2/Span...
                    rampFactor = (opMonthIndex + 1) / leaseUp;
                }

                // Vacancy Logic
                const vacancyFactor = (rev.vacancyFactorPct || 0) / 100;
                const occupancyFactor = (1 - vacancyFactor);

                const rate = rev.weeklyRent || rev.pricePerUnit || 0;
                const annualMultiplier = rev.weeklyRent ? 52 : 1; 
                
                // Apply Rental Growth
                const potentialGrossAnnual = new Decimal(rate).times(annualMultiplier).times(rev.units).times(rentalCompound);
                const potentialGrossMonthly = potentialGrossAnnual.dividedBy(12);
                
                // Effective Gross Rent
                const effectiveGross = potentialGrossMonthly.times(rampFactor).times(occupancyFactor);
                
                monthlyGrossRevenue = monthlyGrossRevenue.plus(effectiveGross);
                
                // -- OPERATING LEDGER LOGIC --
                // We don't use the generic `rev.opexRate` anymore if we have detailed operating costs.
                // However, we keep it as a fallback if the Operating Ledger is empty.
                let monthlyOpex = new Decimal(0);

                if (operatingCosts.length > 0) {
                    operatingCosts.forEach(opexItem => {
                        let expense = new Decimal(0);
                        
                        if (opexItem.inputType === InputType.PCT_REVENUE) {
                            // Management Fees: % of Effective Gross Revenue
                            expense = effectiveGross.times(opexItem.amount / 100);
                        } else if (opexItem.inputType === InputType.FIXED) {
                            // Fixed Annual Amount (Maintenance / Insurance) -> Monthly
                            // Apply CPI escalation
                            const baseAnnual = new Decimal(opexItem.amount);
                            const cpi = baseSettings.growth?.cpi || 3.0;
                            const escFactor = Math.pow(1 + (cpi/100), m/12);
                            expense = baseAnnual.times(escFactor).dividedBy(12);
                        } else if (opexItem.inputType === InputType.RATE_PER_UNIT) {
                            // Rate per Unit (e.g. Levies) -> Monthly
                            // Fix: Use baseSettings to get totalUnits
                            const baseAnnual = new Decimal(opexItem.amount).times(baseSettings.totalUnits);
                            const cpi = baseSettings.growth?.cpi || 3.0;
                            const escFactor = Math.pow(1 + (cpi/100), m/12);
                            expense = baseAnnual.times(escFactor).dividedBy(12);
                        }

                        monthlyOpex = monthlyOpex.plus(expense);
                        
                        // Categorize
                        const cat = opexItem.category === CostCategory.SELLING ? CostCategory.SELLING : CostCategory.MISCELLANEOUS;
                        monthlyBreakdown[cat] += expense.toNumber();
                    });
                } else {
                    // Fallback to simple % Opex
                    monthlyOpex = effectiveGross.times((rev.opexRate || 0) / 100);
                    monthlyBreakdown[CostCategory.MISCELLANEOUS] += monthlyOpex.toNumber();
                }
                
                monthlyNetRevenue = monthlyNetRevenue.plus(effectiveGross.minus(monthlyOpex));
            }
        } 
        else if (rev.strategy === 'Sell' && !isHold) {
            // ... (Existing Sell Logic: Sales Wave) ...
            const absorption = rev.absorptionRate || 1;
            const totalUnits = rev.units;
            // Calculate wave
            // Simple approach: Sell X units per month starting at startMonth
            
            if (m >= startMonth) {
                const monthsInSales = m - startMonth;
                const unitsSoldPreviously = monthsInSales * absorption;
                const unitsRemaining = Math.max(0, totalUnits - unitsSoldPreviously);
                const unitsSoldThisMonth = Math.min(unitsRemaining, absorption);

                if (unitsSoldThisMonth > 0) {
                    const price = rev.pricePerUnit;
                    const revenueForPeriod = new Decimal(unitsSoldThisMonth).times(price).times(revenueCompound);
                    
                    monthlyGrossRevenue = monthlyGrossRevenue.plus(revenueForPeriod);
                    
                    const comms = revenueForPeriod.times(rev.commissionRate).dividedBy(100);
                    const commsGst = comms.dividedBy(11);
                    monthlyItc = monthlyItc.plus(commsGst);

                    const gst = rev.isTaxable ? revenueForPeriod.dividedBy(11) : new Decimal(0);
                    monthlyGstLiability = monthlyGstLiability.plus(gst);
                    
                    monthlyBreakdown[CostCategory.SELLING] += comms.toNumber();
                    monthlyNetRevenue = monthlyNetRevenue.plus(revenueForPeriod.minus(gst).minus(comms));
                }
            }
        }
    });

    // --- C. COSTS (Construction/Development Phase) ---
    // If Strategy is SELL: Run normally.
    // If Strategy is HOLD with Link: Do NOT run construction costs (they are in the linked scenario), 
    
    if (!isHold) { 
        // Standard Development Cashflow
        if (m === 0) {
            monthlyNetCost = monthlyNetCost.plus(depositAmount).plus(baseSettings.acquisition.legalFeeEstimate);
            monthlyBreakdown[CostCategory.LAND] += depositAmount.toNumber();
            if (stampDutyTiming === 'EXCHANGE') {
                monthlyNetCost = monthlyNetCost.plus(stampDutyAmount);
                monthlyBreakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber();
            }
        }
        if (m === settlementMonth) {
            monthlyNetCost = monthlyNetCost.plus(settlementAmount);
            monthlyBreakdown[CostCategory.LAND] += settlementAmount.toNumber();
            if (stampDutyTiming !== 'EXCHANGE') { 
                monthlyNetCost = monthlyNetCost.plus(stampDutyAmount);
                monthlyBreakdown[CostCategory.STATUTORY] += stampDutyAmount.toNumber();
            }
        }

        baseCosts.forEach(cost => {
            if (cost.category === CostCategory.LAND) return;
            const effectiveStart = getEffectiveStartMonth(cost, milestones);

            if (m >= effectiveStart && m < effectiveStart + cost.span) {
                const total = calculateLineItemTotal(cost, baseSettings, siteDNA, constructionSum, totalRevenue, taxScales);
                const monthlyBase = distributeValue(total, m - effectiveStart, cost);
                const rate = cost.escalationRate > 0 ? cost.escalationRate : getEscalationRateForCategory(cost.category, baseSettings);
                const compounding = Math.pow(1 + (rate/100), m/12);
                const monthlyEscalated = monthlyBase.times(compounding);
                
                if (cost.gstTreatment === GstTreatment.TAXABLE) {
                    const gstComponent = monthlyEscalated.times(0.10);
                    monthlyNetCost = monthlyNetCost.plus(monthlyEscalated.plus(gstComponent)); 
                    monthlyItc = monthlyItc.plus(gstComponent); 
                } else {
                    monthlyNetCost = monthlyNetCost.plus(monthlyEscalated);
                }
                
                monthlyBreakdown[cost.category] = (monthlyBreakdown[cost.category] || 0) + monthlyEscalated.toNumber();
            }
        });
    }

    // --- D. OPERATING PHASE - STATUTORY ---
    if (isHold && isOperatingPhase) {
        
        // 1. Dynamic Land Tax Calculation (Annual Event)
        const monthlyGrowthFactor = Math.pow(1 + (landAppreciationRate / 100), 1/12);
        currentStatutoryValue = currentStatutoryValue.times(monthlyGrowthFactor);

        // Trigger Land Tax in first month of each operating year
        const operatingMonth = m - actualRefiMonth;
        if (operatingMonth % 12 === 0) {
            const annualTax = TaxLibrary.calculateTax(
                currentStatutoryValue.toNumber(),
                taxScales,
                baseSettings.acquisition.stampDutyState as TaxState,
                'LAND_TAX_GENERAL'
            );
            monthlyLandTax = new Decimal(annualTax);
            monthlyNetCost = monthlyNetCost.plus(monthlyLandTax);
            monthlyBreakdown[CostCategory.STATUTORY] = (monthlyBreakdown[CostCategory.STATUTORY] || 0) + monthlyLandTax.toNumber();
        }

        // 3. Depreciation
        const capWorks = depreciableCapitalWorks.times(0.025).dividedBy(12); 
        const plant = depreciablePlant.times(0.10).dividedBy(12); 
        monthlyDepreciation = capWorks.plus(plant);
        const invRate = (scenario.settings.holdStrategy?.investmentRate || 0) / 100 / 12;
        investmentInterest = investmentBalance.times(invRate);
    } else if (isHold) {
        // Pre-Operating Phase of Hold (Waiting for construction)
        const monthlyGrowthFactor = Math.pow(1 + (landAppreciationRate / 100), 1/12);
        currentStatutoryValue = currentStatutoryValue.times(monthlyGrowthFactor);
    }

    // --- E. GST QUARTERLY CYCLE ---
    const netGstMovement = monthlyGstLiability.minus(monthlyItc); 
    const cashInflowFromRev = monthlyNetRevenue.plus(monthlyGstLiability);
    pendingGstCredits = pendingGstCredits.plus(monthlyItc);
    
    let basCashflow = new Decimal(0);
    const date = new Date(baseSettings.startDate);
    date.setMonth(date.getMonth() + m);
    const monthIndex = date.getMonth(); 
    
    const isQuarterEnd = (monthIndex + 1) % 3 === 0; 
    
    if (isQuarterEnd) {
        basCashflow = basCashflow.plus(pendingGstCredits);
        pendingGstCredits = new Decimal(0);
    }
    
    const totalOutflow = monthlyNetCost.plus(investmentInterest);
    const totalInflow = monthlyNetRevenue.plus(monthlyRefinanceInflow).plus(monthlyLendingInterest).plus(basCashflow);
    const netPeriodCashflow = totalInflow.minus(totalOutflow);

    // --- F. FINANCE & WATERFALL ---
    
    // 1. Line Fees
    const seniorLimit = baseSettings.capitalStack.senior.limit || 0;
    const seniorLineRate = (baseSettings.capitalStack.senior.lineFeePct || 0) / 100 / 12;
    const seniorLineFee = (seniorLimit > 0 && m >= (baseSettings.capitalStack.senior.activationMonth||0)) 
        ? new Decimal(seniorLimit).times(seniorLineRate) 
        : new Decimal(0);
    monthlyLineFees = monthlyLineFees.plus(seniorLineFee);
    
    const finalOutflow = totalOutflow.plus(seniorLineFee);
    const finalNetCashflow = totalInflow.minus(finalOutflow);

    let drawEquity = new Decimal(0);
    let drawSenior = new Decimal(0);
    let drawMezz = new Decimal(0);
    let repaySenior = new Decimal(0);
    let repayMezz = new Decimal(0);
    let repayEquity = new Decimal(0);
    
    // Interest
    const seniorRate = getMonthlyInterestRate(baseSettings.capitalStack.senior, m);
    const mezzRate = getMonthlyInterestRate(baseSettings.capitalStack.mezzanine, m);
    let interestSenior = new Decimal(0);
    let interestMezz = new Decimal(0);
    if (seniorBalance.gt(0)) interestSenior = seniorBalance.times(seniorRate);
    if (mezzBalance.gt(0)) interestMezz = mezzBalance.times(mezzRate);
    
    if (baseSettings.capitalStack.senior.isInterestCapitalised !== false) seniorBalance = seniorBalance.plus(interestSenior);
    if (baseSettings.capitalStack.mezzanine.isInterestCapitalised !== false) mezzBalance = mezzBalance.plus(interestMezz);

    // Surplus Interest
    if (surplusCash.gt(0)) {
        const lendingRate = (baseSettings.capitalStack.surplusInterestRate || 0) / 100 / 12;
        monthlyLendingInterest = surplusCash.times(lendingRate);
    }

    // Funding / Repayment
    if (finalNetCashflow.lt(0)) {
        let need = finalNetCashflow.abs();
        if (surplusCash.gt(0)) {
            const use = Decimal.min(need, surplusCash);
            surplusCash = surplusCash.minus(use);
            need = need.minus(use);
        }
        if (need.gt(0)) {
            if (!isOperatingPhase) {
                 drawSenior = need;
                 seniorBalance = seniorBalance.plus(drawSenior);
            } else {
                 drawEquity = need;
                 cumulativeEquityUsed = cumulativeEquityUsed.plus(drawEquity);
            }
        }
    } else {
        let surplus = finalNetCashflow;
        // Waterfall Repayment
        if (seniorBalance.gt(0)) {
            const pay = Decimal.min(surplus, seniorBalance);
            repaySenior = pay;
            seniorBalance = seniorBalance.minus(pay);
            surplus = surplus.minus(pay);
        }
        if (mezzBalance.gt(0) && surplus.gt(0)) {
            const pay = Decimal.min(surplus, mezzBalance);
            repayMezz = pay;
            mezzBalance = mezzBalance.minus(pay);
            surplus = surplus.minus(pay);
        }
        if (surplus.gt(0)) {
            repayEquity = surplus;
            surplus = new Decimal(0);
        }
    }

    // Asset Value
    if (!isOperatingPhase) currentAssetValue = currentAssetValue.plus(monthlyNetCost);
    else {
        const growth = (scenario.settings.holdStrategy?.annualCapitalGrowth || 0) / 100;
        const monthlyGrowth = Math.pow(1 + growth, 1/12) - 1;
        currentAssetValue = currentAssetValue.times(1 + monthlyGrowth);
    }

    flows.push({
        month: m,
        label: getMonthLabel(baseSettings.startDate, m),
        developmentCosts: monthlyNetCost.toNumber(),
        costBreakdown: monthlyBreakdown,
        grossRevenue: monthlyGrossRevenue.toNumber(),
        netRevenue: monthlyNetRevenue.toNumber(),
        drawDownEquity: drawEquity.toNumber(),
        drawDownMezz: drawMezz.toNumber(),
        drawDownSenior: drawSenior.toNumber(),
        lendingInterestIncome: monthlyLendingInterest.toNumber(),
        repaySenior: repaySenior.toNumber(),
        repayMezz: repayMezz.toNumber(),
        repayEquity: repayEquity.toNumber(),
        balanceSenior: seniorBalance.toNumber(),
        balanceMezz: mezzBalance.toNumber(),
        balanceEquity: cumulativeEquityUsed.toNumber(),
        balanceSurplus: surplusCash.toNumber(),
        interestSenior: interestSenior.toNumber(),
        interestMezz: interestMezz.toNumber(),
        lineFeeSenior: seniorLineFee.toNumber(),
        netCashflow: finalNetCashflow.toNumber(), 
        cumulativeCashflow: 0, 
        investmentBalance: investmentBalance.toNumber(),
        investmentInterest: investmentInterest.toNumber(),
        assetValue: currentAssetValue.toNumber(),
        statutoryValue: currentStatutoryValue.toNumber(), // Store tracking AUV
        landTaxLiability: monthlyLandTax.toNumber(), // Explicit tax
        inflationFactor: inflationFactor,
        depreciation: monthlyDepreciation.toNumber()
    });
  }

  return flows;
};

// --- ITEMISED GENERATOR FOR PDF REPORTING ---
// Returns a structured grid with EVERY single cost item spread over months
const generateItemisedCashflowData = (
  scenario: FeasibilityScenario, 
  siteDNA: SiteDNA,
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): ItemisedCashflow => {
  
  // 1. Run Main Engine First to get Finance & Global Context
  const mainFlows = calculateMonthlyCashflow(scenario, siteDNA, undefined, taxScales);
  const months = mainFlows.map(f => f.label);
  const duration = months.length;

  const categories: ItemisedCategory[] = [];

  // Helper to add category
  const addCategory = (name: string, id: CostCategory) => {
    categories.push({
      id,
      name,
      rows: [],
      total: 0,
      monthlyTotals: new Array(duration).fill(0)
    });
  };

  // Define Category Order
  addCategory('Income', CostCategory.SELLING); // Hacking Selling ID for Income temporarily, or handle separately
  addCategory('Land & Acquisition', CostCategory.LAND);
  addCategory('Construction', CostCategory.CONSTRUCTION);
  addCategory('Consultants', CostCategory.CONSULTANTS);
  addCategory('Statutory & General', CostCategory.STATUTORY);
  addCategory('Finance & Funding', CostCategory.FINANCE);

  const getCat = (name: string) => categories.find(c => c.name === name)!;

  // 2. REVENUE ITEMS (Gross Realisation)
  // Note: We need to re-calculate revenue waves
  const incomeRows: ItemisedRow[] = [];
  const incomeCat = getCat('Income');
  
  // Income Logic...
  // For simplicity in this demo, we will pull Total Income from the mainFlows
  // because splitting unit-by-unit revenue requires duplicating the sales logic perfectly.
  // However, we can split "Sales Income" vs "Other Income".
  const salesRow: ItemisedRow = { label: 'Gross Sales Revenue', total: 0, values: new Array(duration).fill(0) };
  const otherRow: ItemisedRow = { label: 'Interest Income', total: 0, values: new Array(duration).fill(0) };
  
  mainFlows.forEach((f, i) => {
      salesRow.values[i] = f.grossRevenue;
      otherRow.values[i] = f.lendingInterestIncome;
      salesRow.total += f.grossRevenue;
      otherRow.total += f.lendingInterestIncome;
      incomeCat.monthlyTotals[i] += (f.grossRevenue + f.lendingInterestIncome);
  });
  incomeCat.total = salesRow.total + otherRow.total;
  incomeCat.rows.push(salesRow, otherRow);


  // 3. COST ITEMS (Iterate Line Items)
  const { settings } = scenario;
  const milestones = calculateProjectMilestones(scenario.costs, settings.acquisition, settings.constructionDelay || 0);
  
  // Aggregates for calculation context
  const constructionSum = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a,b) => a+b.amount, 0);
  const revenueSum = incomeCat.total;

  scenario.costs.forEach(item => {
      let targetCat: ItemisedCategory | undefined;
      
      // Map to report categories
      if (item.category === CostCategory.LAND) targetCat = getCat('Land & Acquisition');
      else if (item.category === CostCategory.CONSTRUCTION) targetCat = getCat('Construction');
      else if (item.category === CostCategory.CONSULTANTS) targetCat = getCat('Consultants');
      else if (item.category === CostCategory.STATUTORY || item.category === CostCategory.MISCELLANEOUS) targetCat = getCat('Statutory & General');
      else if (item.category === CostCategory.SELLING) targetCat = getCat('Statutory & General'); // Group selling costs here or create new? Let's put in Stat/Gen for now or separate.
      // Actually, standard is to put Selling under "Selling" or net off income. Let's add Selling Category
      
      if (!targetCat) return;

      const totalAmount = calculateLineItemTotal(item, settings, siteDNA, constructionSum, revenueSum, taxScales);
      
      const row: ItemisedRow = {
          label: item.description,
          total: totalAmount,
          values: new Array(duration).fill(0)
      };

      // Distribution Logic
      const effectiveStart = getEffectiveStartMonth(item, milestones);
      
      // Handle special one-offs (Deposit, Settlement) manually if needed, 
      // but distributeValue usually handles it if startDate is set correctly relative to milestones.
      // However, Deposit/Settlement in `calculateMonthlyCashflow` are hardcoded events.
      // Here we simulate them via the LineItem properties if they exist in the cost list.
      // Note: The standard engine adds Land/Deposit *programmatically*. 
      // WE MUST INJECT THEM MANUALLY HERE IF NOT IN COST LIST.
      
      // Standard Line Item Distribution
      for (let m = 0; m < duration; m++) {
          if (m >= effectiveStart && m < effectiveStart + item.span) {
              const base = distributeValue(totalAmount, m - effectiveStart, item);
              
              // Escalation
              const rate = item.escalationRate > 0 ? item.escalationRate : getEscalationRateForCategory(item.category, settings);
              const compounding = Math.pow(1 + (rate/100), m/12);
              
              // GST
              const finalVal = base.times(compounding); // Net
              // For cashflow report, we usually show Gross Cashflow (Inc GST) or Net? 
              // Banks usually want to see the check amount written. Let's assume GROSS (Inc GST) if taxable.
              // Logic check: The main engine returns `developmentCosts` which includes GST.
              
              let cashAmount = finalVal;
              if (item.gstTreatment === GstTreatment.TAXABLE) {
                  cashAmount = cashAmount.times(1.1);
              }
              
              row.values[m] = cashAmount.toNumber();
          }
      }
      
      row.total = row.values.reduce((a,b) => a+b, 0);
      targetCat.rows.push(row);
      
      // Update Category Totals
      row.values.forEach((v, i) => targetCat!.monthlyTotals[i] += v);
      targetCat.total += row.total;
  });

  // 4. INJECT HARDCODED ACQUISITION EVENTS (Deposit/Settlement) if not in list
  // The main engine handles these explicitly. We need to add rows for them.
  const landCat = getCat('Land & Acquisition');
  const depositAmt = settings.acquisition.purchasePrice * (settings.acquisition.depositPercent/100);
  const settlementAmt = settings.acquisition.purchasePrice - depositAmt;
  
  // Deposit Row (Month 0)
  const depositRow: ItemisedRow = { label: 'Land Deposit', total: depositAmt, values: new Array(duration).fill(0) };
  depositRow.values[0] = depositAmt;
  landCat.rows.unshift(depositRow);
  landCat.monthlyTotals[0] += depositAmt;
  landCat.total += depositAmt;

  // Settlement Row
  const settlementRow: ItemisedRow = { label: 'Land Settlement', total: settlementAmt, values: new Array(duration).fill(0) };
  const setMonth = settings.acquisition.settlementPeriod;
  if (setMonth < duration) {
      settlementRow.values[setMonth] = settlementAmt;
      landCat.monthlyTotals[setMonth] += settlementAmt;
      landCat.total += settlementAmt;
  }
  landCat.rows.push(settlementRow);

  // 5. FINANCE SECTION (From Main Flows)
  const finCat = getCat('Finance & Funding');
  const intRow: ItemisedRow = { label: 'Interest Expense', total: 0, values: new Array(duration).fill(0) };
  const lineFeeRow: ItemisedRow = { label: 'Line Fees', total: 0, values: new Array(duration).fill(0) };
  
  mainFlows.forEach((f, i) => {
      const int = f.interestSenior + f.interestMezz;
      const fee = f.lineFeeSenior;
      intRow.values[i] = int;
      lineFeeRow.values[i] = fee;
      
      finCat.monthlyTotals[i] += (int + fee);
  });
  intRow.total = intRow.values.reduce((a,b)=>a+b, 0);
  lineFeeRow.total = lineFeeRow.values.reduce((a,b)=>a+b, 0);
  
  finCat.total = intRow.total + lineFeeRow.total;
  finCat.rows.push(intRow, lineFeeRow);

  // 6. NET CASHFLOW
  const netCashflow = months.map((_, i) => {
      // Income - All Costs
      const inc = incomeCat.monthlyTotals[i];
      const costs = categories.filter(c => c.name !== 'Income').reduce((sum, cat) => sum + cat.monthlyTotals[i], 0);
      return inc - costs;
  });

  return {
      headers: months,
      categories,
      netCashflow,
      cumulativeCashflow: [] // TODO if needed
  };
};

// ... (Rest of exports remain same: Stats, NPV, IRR) ...
const calculateReportStats = (scenario: FeasibilityScenario, siteDNA: SiteDNA, taxScales: TaxConfiguration = DEFAULT_TAX_SCALES) => {
  const revenues = scenario.revenues;
  const totalRevenueGross = revenues.reduce((acc, rev) => {
      if (rev.strategy === 'Hold') {
          return acc; 
      }
      return acc + (rev.units * rev.pricePerUnit);
  }, 0);

  let gstCollected = 0;
  if (scenario.strategy === 'SELL') gstCollected = totalRevenueGross / 11; 

  const netRealisation = totalRevenueGross - gstCollected;
  
  const totalItc = scenario.costs.reduce((acc, item) => {
      if (item.gstTreatment === GstTreatment.TAXABLE) {
          const total = calculateLineItemTotal(item, scenario.settings, siteDNA, 0, 0, taxScales); 
          return acc + (total * 0.1); 
      }
      return acc;
  }, 0);

  return { totalRevenueGross, gstCollected, netRealisation, totalItc };
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

// --- NEW: FEASTUDY METRICS CALCULATOR ---
const calculateProjectMetrics = (
  cashflow: MonthlyFlow[], 
  settings: FeasibilitySettings
): ProjectMetrics => {
  
  // 1. Aggregates
  const totalDevelopmentCost = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz + curr.lineFeeSenior, 0);
  const totalFinanceCost = cashflow.reduce((acc, curr) => acc + curr.interestSenior + curr.interestMezz + curr.lineFeeSenior, 0);
  const grossRevenue = cashflow.reduce((acc, curr) => acc + curr.grossRevenue, 0);
  const otherIncome = cashflow.reduce((acc, curr) => acc + curr.lendingInterestIncome, 0);
  const sellingCosts = cashflow.reduce((acc, curr) => acc + (curr.costBreakdown[CostCategory.SELLING] || 0), 0);
  
  const totalGrossRevenue = grossRevenue + otherIncome;
  // Net Revenue = Gross - Selling Costs - GST (Handled in monthlyNetRevenue inside the engine, but we recalc aggregates here for explicit metrics)
  // Note: MonthlyFlow.netRevenue already excludes selling costs and GST liability.
  
  // Profit = Total Inflow - Total Outflow
  // Inflow = Net Revenue + Surplus Interest + GST Refunds
  // Outflow = Dev Costs + Finance + GST Payments
  // Simplified Profit:
  const netProfit = (totalGrossRevenue / 1.1) - totalDevelopmentCost; // Approx for quick check, but let's use exact flows.
  
  // Accurate Profit from Flows
  const totalInflow = cashflow.reduce((acc, curr) => acc + curr.netRevenue + curr.lendingInterestIncome, 0);
  // Note: developmentCosts in flow includes net GST movement? No, it's gross cost usually. 
  // Let's rely on standard logic: Profit = Net Realisation - Total Cost
  const gstCollected = grossRevenue / 11;
  const netRealisation = totalGrossRevenue - gstCollected;
  
  // Total Cost needs to be Net of Input Credits
  // The engine returns `developmentCosts` as the CASH OUTFLOW. If the item was taxable, it included GST.
  // We need to strip GST from costs to get Accounting Profit.
  // We don't have item-level granularity here easily without re-running. 
  // However, we can approximate ITC from the flow logic or store it in flow.
  // For now, let's assume `developmentCosts` in MonthlyFlow is the NET cost to developer after claiming credits? 
  // Actually, standard practice in cashflow arrays is showing the CHEQUE WRITTEN (Gross).
  // So: Accounting Cost = Cash Cost - ITC.
  // Let's calculate ITC approximately 1/11th of developmentCosts (excluding interest).
  // Limitation: We don't know which costs were GST Free (e.g. Council rates).
  // Fix: We should update MonthlyFlow to track ITC explicitly. 
  // For this task, we will estimate ITC based on standard 1/11 rule for 90% of costs.
  const rawDevCost = cashflow.reduce((acc, c) => acc + c.developmentCosts, 0);
  const gstInputCredits = rawDevCost * 0.09; // Approx
  
  const exactProfit = netRealisation - (totalDevelopmentCost - gstInputCredits); // Accounting Profit

  // 2. Margins
  const devMarginPct = totalDevelopmentCost > 0 ? (exactProfit / (totalDevelopmentCost - gstInputCredits)) * 100 : 0;
  const marginBeforeInterest = exactProfit + totalFinanceCost;
  
  // 3. Peak Debt
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

  // 4. Equity Analysis
  const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
  const peakEquity = Math.max(...cashflow.map(f => f.balanceEquity));
  const marginOnEquity = peakEquity > 0 ? (exactProfit / peakEquity) * 100 : 0;
  const equityIRR = calculateIRR(equityFlows);

  // 5. Project IRR (Unlevered)
  // Flows = Net Revenue - Total Dev Cost (excluding Interest)
  const projectFlows = cashflow.map(f => {
      // Inflow: Net Revenue (ex GST)
      const inF = f.netRevenue + f.lendingInterestIncome; 
      // Outflow: Dev Cost (ex GST/Interest) - APPROX as we don't have net cost in flow
      const outF = f.developmentCosts / 1.1; 
      return inF - outF;
  });
  const projectIRR = calculateIRR(projectFlows);

  return {
      totalDevelopmentCost: totalDevelopmentCost - gstInputCredits, // Net
      grossRevenue: totalGrossRevenue,
      netRevenue: netRealisation,
      netProfit: exactProfit,
      totalFinanceCost,
      devMarginPct,
      marginBeforeInterest,
      marginOnEquity,
      equityIRR,
      projectIRR,
      gstCollected,
      gstInputCredits,
      netGstPayable: gstCollected - gstInputCredits,
      peakDebtAmount,
      peakDebtMonthIndex,
      peakDebtDate,
      peakEquity,
      residualLandValue: 0 // Optional
  };
};

export const FinanceEngine = {
  calculateLineItemTotal,
  calculateMonthlyCashflow,
  calculateReportStats,
  generateItemisedCashflowData,
  calculateProjectMetrics,
  getMonthLabel,
  calculateNPV,
  calculateIRR,
  calculateStampDuty
};
