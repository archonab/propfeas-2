import Decimal from 'decimal.js';
import { 
  LineItem, RevenueItem, MonthlyFlow, DistributionMethod, 
  InputType, CostCategory, DebtLimitMethod, EquityMode, InterestRateMode, FeeBase, CapitalTier, GstTreatment, MilestoneLink, TaxConfiguration, TaxState,
  ItemisedRow, ItemisedCategory, ItemisedCashflow, ProjectMetrics, LineItemSummary, GstAuditEntry
} from '../types';
import { Site, FeasibilityScenario, FeasibilitySettings } from '../types-v2';
import { TaxLibrary } from './TaxLibrary';
import { DEFAULT_TAX_SCALES } from '../constants';

// --- Internal Pure Pipeline Helpers ---

export const getMonthLabel = (startDate: string, monthIndex: number): string => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + monthIndex);
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

export const distributeValue = (total: number, relativeMonth: number, item: LineItem): Decimal => {
    if (relativeMonth < 0 || relativeMonth >= item.span) return new Decimal(0);
    const span = item.span;
    let factor = 0;
    switch (item.method) {
        case DistributionMethod.LINEAR: factor = 1 / span; break;
        case DistributionMethod.UPFRONT: factor = relativeMonth === 0 ? 1 : 0; break;
        case DistributionMethod.END: factor = relativeMonth === span - 1 ? 1 : 0; break;
        case DistributionMethod.S_CURVE:
            const k = 12; 
            const x0 = 0.5; 
            const s = (t: number) => 1 / (1 + Math.exp(-k * (t - x0)));
            const start = s(relativeMonth / span);
            const end = s((relativeMonth + 1) / span);
            const totalCurve = s(1) - s(0);
            factor = (end - start) / totalCurve;
            break;
        default: factor = 1 / span;
    }
    return new Decimal(total).mul(factor);
};

export const calculateLineItemTotal = (
  item: LineItem, 
  settings: FeasibilitySettings, 
  site: Site, 
  constructionTotal: number, 
  estimatedRevenue: number, 
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): number => {
    if (item.calculationLink === 'AUTO_STAMP_DUTY') {
        return calculateStampDuty(site.acquisition.purchasePrice, site.acquisition.stampDutyState, site.acquisition.isForeignBuyer, taxScales, site.acquisition.stampDutyOverride);
    }
    
    if (item.calculationLink === 'AUTO_LAND_TAX') {
        const baseValue = site.identity.auv || 0;
        return TaxLibrary.calculateTax(baseValue, taxScales, site.acquisition.stampDutyState, 'LAND_TAX_GENERAL');
    }

    let driverValue = 0;
    switch (item.inputType) {
        case InputType.FIXED: return item.amount;
        case InputType.PCT_CONSTRUCTION: driverValue = constructionTotal; return (driverValue * item.amount) / 100;
        case InputType.PCT_REVENUE: driverValue = estimatedRevenue; return (driverValue * item.amount) / 100;
        case InputType.RATE_PER_SQM: driverValue = site.identity.landArea; return driverValue * item.amount;
        case InputType.RATE_PER_UNIT: driverValue = settings.totalUnits; return driverValue * item.amount;
        default: return item.amount;
    }
};

export const calculateStampDuty = (price: number, state: TaxState, isForeign: boolean, scales: TaxConfiguration = DEFAULT_TAX_SCALES, override?: number): number => {
    if (override !== undefined && override !== null) return override;
    const baseDuty = TaxLibrary.calculateTax(price, scales, state, 'STAMP_DUTY');
    return isForeign ? baseDuty + (price * 0.08) : baseDuty;
};

export const calculateIRR = (flows: number[]): number | null => {
    const totalIn = flows.filter(f => f > 0).reduce((a, b) => a + b, 0);
    const totalOut = Math.abs(flows.filter(f => f < 0).reduce((a, b) => a + b, 0));
    
    // Feastudy Rule: If you don't return at least the principal, IRR is N/A
    if (totalIn <= totalOut || totalOut === 0) return null;

    let guess = 0.1;
    const maxIterations = 50;
    const precision = 1e-7;

    for (let i = 0; i < maxIterations; i++) {
        let f = 0;
        let df = 0;
        for (let t = 0; t < flows.length; t++) {
            const factor = Math.pow(1 + guess, t);
            f += flows[t] / factor;
            df -= (t * flows[t]) / (factor * (1 + guess));
        }
        if (Math.abs(f) < precision) return guess;
        if (df === 0) break;
        guess = guess - f / df;
    }
    return (guess > -1 && guess < 20) ? guess : null;
};

export const annualiseMonthlyRate = (monthlyRate: number): number => {
    return Math.pow(1 + monthlyRate, 12) - 1;
};

export const calculateProjectMetrics = (cashflow: MonthlyFlow[], settings: FeasibilitySettings, site: Site): ProjectMetrics => {
  const grossRealisation = cashflow.reduce((acc, c) => acc + c.grossRevenue + c.lendingInterestIncome, 0);
  const gstOnSales = cashflow.reduce((acc, c) => acc + c.gstOnSales, 0);
  const netRealisation = grossRealisation - gstOnSales;
  
  const totalFinanceCost = cashflow.reduce((acc, curr) => acc + curr.interestSenior + curr.interestMezz + curr.lineFeeSenior, 0);
  const devCostsNet = cashflow.reduce((acc, c) => acc + c.developmentCosts, 0);
  const totalCostNet = devCostsNet + totalFinanceCost;
  
  const gstInputCredits = cashflow.reduce((acc, c) => acc + c.gstOnCosts, 0);
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
  
  const equityMonthlyIRR = calculateIRR(equityFlows);
  const equityIRR = equityMonthlyIRR !== null ? annualiseMonthlyRate(equityMonthlyIRR) * 100 : null;
  
  const projectFlows = cashflow.map(f => (f.netRevenue + f.lendingInterestIncome) - (f.developmentCosts / 1.1));
  const projectMonthlyIRR = calculateIRR(projectFlows);
  const projectIRR = projectMonthlyIRR !== null ? annualiseMonthlyRate(projectMonthlyIRR) * 100 : null;

  const landArea = site.identity.landArea || 1; 
  const purchasePrice = site.acquisition.purchasePrice;
  const gfa = site.identity.totalGFA || 0;
  const nsa = site.identity.totalNSA || 0;
  const constructionCostTotal = cashflow.reduce((acc, c) => acc + (c.costBreakdown[CostCategory.CONSTRUCTION] || 0), 0);

  return {
      grossRealisation, gstOnSales, netRealisation, totalCostGross, gstInputCredits, totalCostNet,
      netProfit: exactProfit, marginOnCost: devMarginPct, totalDevelopmentCost: totalCostNet,
      grossRevenue: grossRealisation, netRevenue: netRealisation, totalFinanceCost,
      devMarginPct, marginBeforeInterest, marginOnEquity, equityIRR, projectIRR,
      gstCollected: gstOnSales, netGstPayable: gstOnSales - gstInputCredits,
      peakDebtAmount, peakDebtMonthIndex, peakDebtDate, peakEquity, residualLandValue: 0,
      ratios: {
          landCostPerSqm: purchasePrice / landArea,
          tdcPerSqm: totalCostNet / landArea,
          revenuePerSqm: nsa > 0 ? netRealisation / nsa : 0,
          profitPerUnit: settings.totalUnits > 0 ? exactProfit / settings.totalUnits : 0
      },
      benchmarks: {
          constructionEfficiency: gfa > 0 ? constructionCostTotal / gfa : 0,
          salesRealisation: nsa > 0 ? netRealisation / nsa : 0,
          landValuePerSqm: purchasePrice / landArea,
          areaEfficiency: gfa > 0 ? (nsa / gfa) * 100 : 0
      }
  };
};

export const calculateMonthlyCashflow = (
  scenario: FeasibilityScenario, 
  site: Site, 
  linkedScenario?: FeasibilityScenario, 
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): MonthlyFlow[] => {
    const horizon = scenario.settings.durationMonths;
    const flows: MonthlyFlow[] = [];
    
    // --- 1. RESOLVE HARD COST BASIS (Ex Finance) ---
    const constructionTotal = scenario.costs
        .filter(c => c.category === CostCategory.CONSTRUCTION)
        .reduce((a, b) => a + b.amount, 0);
    const estTotalRevenue = scenario.revenues.reduce((a, b) => a + (b.units * b.pricePerUnit), 0);

    const budgetedHardCosts = scenario.costs
        .filter(c => c.category !== CostCategory.FINANCE)
        .reduce((acc, item) => {
            return acc + calculateLineItemTotal(item, scenario.settings, site, constructionTotal, estTotalRevenue, taxScales);
        }, 0);

    const duty = calculateStampDuty(site.acquisition.purchasePrice, site.acquisition.stampDutyState, site.acquisition.isForeignBuyer, taxScales, site.acquisition.stampDutyOverride);
    const agentFee = site.acquisition.purchasePrice * ((site.acquisition.buyersAgentFee || 0) / 100);
    const acquisitionTotal = site.acquisition.purchasePrice + duty + agentFee + (site.acquisition.legalFeeEstimate || 0);

    const hardCostBasis = budgetedHardCosts + acquisitionTotal;

    // --- 2. RESOLVE DEBT LIMITS ---
    const resolveLimit = (tier: CapitalTier) => {
        if (tier.limitMethod === DebtLimitMethod.LTC) {
            return new Decimal(hardCostBasis).mul((tier.limit || 0) / 100);
        }
        // FIX: Default to hardCostBasis if no limit specified to prevent trillion-dollar fees
        return new Decimal(tier.limit || hardCostBasis); 
    };

    const seniorCeiling = resolveLimit(scenario.settings.capitalStack.senior);
    const mezzCeiling = resolveLimit(scenario.settings.capitalStack.mezzanine);
    const equityLimit = new Decimal(scenario.settings.capitalStack.equity.initialContribution);

    let seniorBal = new Decimal(0);
    let mezzBal = new Decimal(0);
    let equityBal = new Decimal(0);

    for (let m = 0; m <= horizon; m++) {
        let grossRev = 0;
        let sellingCosts = 0;
        let devSpend = 0;
        let gstCosts = 0;
        const breakdown: Record<string, number> = {};

        // 1. Process Revenue
        scenario.revenues.forEach(rev => {
            const startMonth = scenario.settings.constructionDelay + (site.acquisition.settlementPeriod || 0) + rev.offsetFromCompletion;
            if (m >= startMonth && m < startMonth + rev.settlementSpan) {
                const monthlyRev = (rev.units * rev.pricePerUnit) / rev.settlementSpan;
                grossRev += monthlyRev;
                sellingCosts += monthlyRev * (rev.commissionRate / 100);
            }
        });

        // 2. Process Costs
        scenario.costs.forEach(cost => {
            let effectiveStart = cost.startDate;
            if (cost.category === CostCategory.CONSTRUCTION) {
                effectiveStart += (site.acquisition.settlementPeriod || 0) + (scenario.settings.constructionDelay || 0);
            }

            if (m >= effectiveStart && m < effectiveStart + cost.span) {
                const total = calculateLineItemTotal(cost, scenario.settings, site, constructionTotal, estTotalRevenue, taxScales);
                const monthly = distributeValue(total, m - effectiveStart, cost).toNumber();
                devSpend += monthly;
                if (cost.gstTreatment === GstTreatment.TAXABLE) gstCosts += monthly * 0.1;
                breakdown[cost.category] = (breakdown[cost.category] || 0) + monthly;
            }
        });

        // 3. Statutory & Land Acquisition (Implicit)
        if (m === 0) {
            const deposit = site.acquisition.purchasePrice * (site.acquisition.depositPercent / 100);
            devSpend += deposit;
            breakdown[CostCategory.LAND] = (breakdown[CostCategory.LAND] || 0) + deposit;
        }
        if (m === site.acquisition.settlementPeriod) {
            const settlement = site.acquisition.purchasePrice * (1 - site.acquisition.depositPercent / 100);
            devSpend += settlement;
            breakdown[CostCategory.LAND] = (breakdown[CostCategory.LAND] || 0) + settlement;
        }

        const netRev = grossRev - sellingCosts;
        const totalOutflow = devSpend + gstCosts;
        let netCash = netRev - totalOutflow;

        let dEquity = 0, rEquity = 0, dSenior = 0, rSenior = 0, dMezz = 0, rMezz = 0;
        let intSn = 0, intMz = 0, lineFee = 0;

        intSn = seniorBal.mul(scenario.settings.capitalStack.senior.interestRate / 100 / 12).toNumber();
        intMz = mezzBal.mul(scenario.settings.capitalStack.mezzanine.interestRate / 100 / 12).toNumber();
        
        if (m >= (scenario.settings.capitalStack.senior.activationMonth || 0)) {
            lineFee = seniorCeiling.mul((scenario.settings.capitalStack.senior.lineFeePct || 0) / 100 / 12).toNumber();
        }

        if (scenario.settings.capitalStack.senior.isInterestCapitalised) {
            const capRoom = Decimal.max(0, seniorCeiling.sub(seniorBal));
            const actualCap = Decimal.min(intSn, capRoom);
            seniorBal = seniorBal.add(actualCap);
            netCash -= (intSn - actualCap.toNumber());
        }

        if (scenario.settings.capitalStack.mezzanine.isInterestCapitalised) {
            const capRoom = Decimal.max(0, mezzCeiling.sub(mezzBal));
            const actualCap = Decimal.min(intMz, capRoom);
            mezzBal = mezzBal.add(actualCap);
            netCash -= (intMz - actualCap.toNumber());
        }

        if (netCash < 0) {
            let deficit = Math.abs(netCash) + lineFee;
            
            const eqAvail = Decimal.max(0, equityLimit.sub(equityBal));
            const eqDraw = Decimal.min(deficit, eqAvail);
            dEquity = eqDraw.toNumber();
            equityBal = equityBal.add(eqDraw);
            deficit -= dEquity;

            if (deficit > 0) {
                const snAvail = Decimal.max(0, seniorCeiling.sub(seniorBal));
                const snDraw = Decimal.min(deficit, snAvail);
                dSenior = snDraw.toNumber();
                seniorBal = seniorBal.add(snDraw);
                deficit -= dSenior;
            }

            if (deficit > 0) {
                const mzAvail = Decimal.max(0, mezzCeiling.sub(mezzBal));
                const mzDraw = Decimal.min(deficit, mzAvail);
                dMezz = mzDraw.toNumber();
                mezzBal = mezzBal.add(mzDraw);
                deficit -= dMezz;
            }

            if (deficit > 0) {
                dEquity += deficit;
                equityBal = equityBal.add(deficit);
            }
        } else {
            let surplus = netCash - lineFee;
            
            const snPay = Decimal.min(surplus, seniorBal);
            rSenior = snPay.toNumber();
            seniorBal = seniorBal.sub(snPay);
            surplus -= rSenior;

            const mzPay = Decimal.min(surplus, mezzBal);
            rMezz = mzPay.toNumber();
            mezzBal = mezzBal.sub(mzPay);
            surplus -= rMezz;

            rEquity = surplus;
            equityBal = equityBal.sub(rEquity);
        }

        flows.push({
            monthIndex: m,
            label: getMonthLabel(scenario.settings.startDate, m),
            grossRevenue: grossRev,
            gstOnSales: grossRev / 11,
            netRevenue: netRev,
            developmentCosts: devSpend,
            gstOnCosts: gstCosts,
            netCashflow: netCash,
            drawDownSenior: dSenior,
            repaySenior: rSenior,
            balanceSenior: seniorBal.toNumber(),
            interestSenior: intSn,
            lineFeeSenior: lineFee,
            drawDownMezz: dMezz,
            repayMezz: rMezz,
            balanceMezz: mezzBal.toNumber(),
            interestMezz: intMz,
            drawDownEquity: dEquity,
            repayEquity: rEquity,
            balanceEquity: equityBal.toNumber(),
            lendingInterestIncome: 0,
            costBreakdown: breakdown,
            investmentInterest: 0,
            depreciation: 0,
            landTaxLiability: 0,
            statutoryValue: site.identity.auv || 0,
            assetValue: site.acquisition.purchasePrice + (m * 10000), 
            inflationFactor: 1
        });
    }
    return flows;
};

export const generateItemisedCashflowData = (
  scenario: FeasibilityScenario, 
  site: Site, 
  monthlyFlows: MonthlyFlow[],
  taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
): ItemisedCashflow => {
    const categories: ItemisedCategory[] = [];
    
    // Get totals for relative calcs
    const constructionSum = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a, b) => a + b.amount, 0);
    const estTotalRev = scenario.revenues.reduce((a, b) => a + (b.units * b.pricePerUnit), 0);

    Object.values(CostCategory).forEach(catName => {
        const rows: ItemisedRow[] = [];
        
        if (catName === CostCategory.LAND) {
            const depositAmount = site.acquisition.purchasePrice * (site.acquisition.depositPercent / 100);
            const depositRowValues = new Array(monthlyFlows.length).fill(0);
            if (depositRowValues.length > 0) depositRowValues[0] = depositAmount;
            rows.push({ label: 'Land Deposit', values: depositRowValues, total: depositAmount });

            const settlementAmount = site.acquisition.purchasePrice * (1 - site.acquisition.depositPercent / 100);
            const settlementMonth = site.acquisition.settlementPeriod || 0;
            const settlementRowValues = new Array(monthlyFlows.length).fill(0);
            if (settlementMonth < settlementRowValues.length) settlementRowValues[settlementMonth] = settlementAmount;
            rows.push({ label: 'Land Settlement', values: settlementRowValues, total: settlementAmount });
        }

        scenario.costs.filter(c => c.category === catName).forEach(cost => {
            // FIX: Recalculate the SPECIFIC item's flow for this row to show individual fee distribution
            const totalItemAmount = calculateLineItemTotal(cost, scenario.settings, site, constructionSum, estTotalRev, taxScales);
            
            const rowValues = monthlyFlows.map((_, m) => {
                let effectiveStart = cost.startDate;
                if (cost.category === CostCategory.CONSTRUCTION) {
                    effectiveStart += (site.acquisition.settlementPeriod || 0) + (scenario.settings.constructionDelay || 0);
                }

                if (m >= effectiveStart && m < effectiveStart + cost.span) {
                    return distributeValue(totalItemAmount, m - effectiveStart, cost).toNumber();
                }
                return 0;
            });

            rows.push({ 
                label: cost.description, 
                values: rowValues, 
                total: rowValues.reduce((a, b) => a + b, 0) 
            });
        });

        if (rows.length > 0) {
            const catDisplayName = catName === CostCategory.LAND ? 'Land & Acquisition' : catName;
            categories.push({ name: catDisplayName as any, rows });
        }
    });

    return { headers: monthlyFlows.map(f => f.label), categories };
};

export const calculateLineItemSummaries = (scenario: FeasibilityScenario, site: Site, taxScales: TaxConfiguration = DEFAULT_TAX_SCALES): LineItemSummary[] => {
    const constructionTotal = scenario.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a, b) => a + b.amount, 0);
    const estTotalRev = scenario.revenues.reduce((a, b) => a + (b.units * b.pricePerUnit), 0);
    
    return scenario.costs.map(c => {
        const net = calculateLineItemTotal(c, scenario.settings, site, constructionTotal, estTotalRev, taxScales);
        const gst = c.gstTreatment === GstTreatment.TAXABLE ? net * 0.1 : 0;
        return {
            id: c.id,
            category: c.category,
            description: c.description,
            netAmount: net,
            gstAmount: gst,
            grossAmount: net + gst,
            isImplicit: false
        };
    });
};

export const generateGstAuditTrail = (scenario: FeasibilityScenario, site: Site, taxScales: TaxConfiguration = DEFAULT_TAX_SCALES): GstAuditEntry[] => [];
export const calculateNPV = (flows: number[], rate: number) => 0;
export const getImplicitAcquisitionCosts = (price: number, state: TaxState, isForeign: boolean) => 0;

const buildTimeline = (scenario: FeasibilityScenario, site: Site) => {
    return Array.from({ length: scenario.settings.durationMonths + 1 }, (_, i) => ({
        index: i,
        label: getMonthLabel(scenario.settings.startDate, i)
    }));
};

const calcCostSchedule = (scenario: FeasibilityScenario, site: Site, timeline: any[], linkedScenario?: any, taxScales?: any) => [];
const calcRevenueSchedule = (scenario: any, site: any, timeline: any[]) => [];
const calcTaxSchedule = (scenario: any, site: any, timeline: any[]) => [];
const calcFundingSchedule = (scenario: any, site: any, timeline: any[], schedules: any) => [];

export const FinanceEngine = {
  calculateLineItemTotal, calculateMonthlyCashflow, generateItemisedCashflowData,
  calculateProjectMetrics, calculateLineItemSummaries, generateGstAuditTrail, getMonthLabel, calculateNPV,
  calculateIRR, calculateStampDuty, getImplicitAcquisitionCosts, annualiseMonthlyRate, distributeValue,
  _internal: { buildTimeline, calcCostSchedule, calcRevenueSchedule, calcTaxSchedule, calcFundingSchedule }
};