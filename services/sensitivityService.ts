import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, SensitivityVariable, SiteDNA, FeasibilityScenario, ScenarioStatus } from '../types';
import { FinanceEngine } from './financeEngine';

export interface SensitivityCell {
  xVar: number; // Value change (%, Months, or %)
  yVar: number; // Value change
  margin: number;
  profit: number;
}

// Helper to apply variance to a fresh set of data
const applyVariance = (
  type: SensitivityVariable,
  varianceValue: number, // % for rev/cost, Months for duration, absolute % for interest
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): { settings: FeasibilitySettings; costs: LineItem[]; revenues: RevenueItem[] } => {
  
  // Deep Copy inputs
  let newSettings = JSON.parse(JSON.stringify(settings));
  let newCosts = costs.map(c => ({...c}));
  let newRevenues = revenues.map(r => ({...r}));

  switch (type) {
    case 'revenue': {
      // Variance is % (e.g., 10 = +10%)
      const multiplier = 1 + (varianceValue / 100);
      newRevenues = newRevenues.map(r => ({
        ...r,
        pricePerUnit: r.pricePerUnit * multiplier
      }));
      break;
    }

    case 'cost': {
      // Variance is % (e.g., 10 = +10%)
      const multiplier = 1 + (varianceValue / 100);
      newCosts = newCosts.map(c => {
        if (c.category === CostCategory.CONSTRUCTION) {
          const newItem = { ...c, amount: c.amount * multiplier };
          
          // Compound Escalation Shock:
          // If cost increases > 0%, we assume inflation is rising, so we bump escalation rate too.
          // Rule: Add 0.5% escalation for every 10% cost increase (approx)
          if (varianceValue > 0) {
             newItem.escalationRate = (newItem.escalationRate || 0) + 0.5;
          }
          return newItem;
        }
        return c;
      });
      break;
    }

    case 'duration': {
      // Variance is Absolute Months (e.g., 3 = +3 months delay)
      const delay = varianceValue;
      const originalDuration = settings.durationMonths;
      
      // 1. Extend Project Duration
      newSettings.durationMonths = originalDuration + delay;

      // 2. Stretch Construction S-Curves
      // We scale the span proportionally
      newCosts = newCosts.map(c => {
        if (c.category === CostCategory.CONSTRUCTION) {
          return {
             ...c,
             span: c.span + delay
          };
        }
        return c;
      });

      // 3. Shift Revenue Settlement
      // Revenue items use `offsetFromCompletion` logic. 
      // Since Construction span is extended above, the calculated Construction Completion Month increases.
      // Therefore, Revenue items automatically shift out without needing modification here.
      break;
    }

    case 'interest': {
      // Variance is Absolute Percentage (e.g. 1.0 = +1.00% rate increase)
      newSettings.capitalStack.senior.interestRate += varianceValue;
      newSettings.capitalStack.mezzanine.interestRate += varianceValue;
      break;
    }
  }

  return { settings: newSettings, costs: newCosts, revenues: newRevenues };
};

export const SensitivityService = {
  /**
   * Generates a matrix of financial outcomes.
   * Fully flexible X and Y axes.
   */
  generateMatrix(
    settings: FeasibilitySettings,
    baseCosts: LineItem[],
    baseRevenues: RevenueItem[],
    xAxis: SensitivityVariable,
    yAxis: SensitivityVariable,
    stepsX: number[],
    stepsY: number[],
    siteDNA: SiteDNA
  ): SensitivityCell[][] {
    
    const matrix: SensitivityCell[][] = [];

    // Loop Y-Axis
    for (const yVal of stepsY) {
      const row: SensitivityCell[] = [];

      // 1. Apply Y-Axis Variance to Base Data
      const yScenario = applyVariance(yAxis, yVal, settings, baseCosts, baseRevenues);

      // Loop X-Axis
      for (const xVal of stepsX) {
        // 2. Apply X-Axis Variance to the Y-Scenario Data
        // This ensures compound effect (e.g. Higher Cost AND Delayed Time)
        const finalScenarioParts = applyVariance(
            xAxis, 
            xVal, 
            yScenario.settings, 
            yScenario.costs, 
            yScenario.revenues
        );

        // Construct a temporary scenario object for the engine
        const tempScenario: FeasibilityScenario = {
          id: 'temp-sensitivity',
          name: 'Sensitivity Run',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isBaseline: false,
          status: ScenarioStatus.DRAFT,
          strategy: 'SELL', // Default assumption for matrix, though could be inferred
          settings: finalScenarioParts.settings,
          costs: finalScenarioParts.costs,
          revenues: finalScenarioParts.revenues
        };

        // 3. Run Engine
        const flows = FinanceEngine.calculateMonthlyCashflow(
            tempScenario,
            siteDNA
        );

        // 4. Extract Metrics
        const totalOut = flows.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
        const totalIn = flows.reduce((acc, curr) => acc + curr.netRevenue, 0);
        const profit = totalIn - totalOut;
        const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;

        row.push({
          xVar: xVal,
          yVar: yVal,
          margin,
          profit
        });
      }
      matrix.push(row);
    }

    return matrix;
  }
};