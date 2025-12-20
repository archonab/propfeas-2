
import Decimal from 'decimal.js';
import { LineItem, RevenueItem, FeasibilitySettings, MonthlyFlow, DistributionMethod, InputType, CostCategory } from '../types';

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

const getMonthLabel = (startDate: string, offset: number): string => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
};

const distributeValue = (total: number, currentMonth: number, span: number, method: DistributionMethod): Decimal => {
  const totalDec = new Decimal(total);
  if (span <= 0) return new Decimal(0);

  switch (method) {
    case DistributionMethod.S_CURVE: {
      const k = 10; // Steepness
      const x0 = 0.5; // Midpoint
      
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

const calculateMonthlyCashflow = (
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): MonthlyFlow[] => {
  const flows: MonthlyFlow[] = [];
  let cumulativeDebt = new Decimal(0);

  // 1. Calculate Revenue Baseline
  const totalRevenue = revenues.reduce((acc, rev) => {
    return acc.plus(new Decimal(rev.units).times(rev.pricePerUnit));
  }, new Decimal(0)).toNumber();

  // 2. Calculate Construction Baseline (for dependent items)
  const constructionSum = costs
    .filter(c => c.category === CostCategory.CONSTRUCTION)
    .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)).toNumber();

  for (let m = 0; m <= settings.durationMonths; m++) {
    let monthlyOutflow = new Decimal(0);
    let monthlyInflow = new Decimal(0);

    // Process Costs
    costs.forEach(cost => {
      if (m >= cost.startDate && m < cost.startDate + cost.span) {
        const totalAmount = calculateLineItemTotal(cost, settings, constructionSum, totalRevenue);
        const monthlyValue = distributeValue(totalAmount, m - cost.startDate, cost.span, cost.method);
        
        // Apply Escalation
        const yearsElapsed = Math.floor(m / 12);
        const escalationRate = cost.escalationRate || 0;
        const escalationFactor = new Decimal(1).plus(new Decimal(escalationRate).dividedBy(100)).pow(yearsElapsed);
        
        monthlyOutflow = monthlyOutflow.plus(monthlyValue.times(escalationFactor));
      }
    });

    // Process Revenue Settlements
    revenues.forEach(rev => {
      if (m === rev.settlementDate) {
        const revTotal = new Decimal(rev.units).times(rev.pricePerUnit);
        const commission = revTotal.times(rev.commissionRate).dividedBy(100);
        monthlyInflow = monthlyInflow.plus(revTotal.minus(commission));
      }
    });

    // Interest Calculation
    const monthlyInterestRate = new Decimal(settings.interestRate).dividedBy(100).dividedBy(12);
    const interestCharge = cumulativeDebt.times(monthlyInterestRate);
    
    monthlyOutflow = monthlyOutflow.plus(interestCharge);
    
    const netMonthly = monthlyInflow.minus(monthlyOutflow);
    cumulativeDebt = cumulativeDebt.minus(netMonthly);

    flows.push({
      month: m,
      label: getMonthLabel(settings.startDate, m),
      outflow: monthlyOutflow.toNumber(),
      inflow: monthlyInflow.toNumber(),
      net: netMonthly.toNumber(),
      cumulative: -cumulativeDebt.toNumber(),
      interest: interestCharge.toNumber(),
      debtBalance: cumulativeDebt.toNumber()
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
