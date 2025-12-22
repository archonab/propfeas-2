
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, SensitivityVariable, SiteDNA, FeasibilityScenario, ScenarioStatus, SensitivityRow } from '../types';
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

      // 3. Shift Revenue Settlement (handled automatically by offsetFromCompletion)
      break;
    }

    case 'interest': {
      // Variance is Absolute Percentage (e.g. 1.0 = +1.00% rate increase)
      newSettings.capitalStack.senior.interestRate += varianceValue;
      newSettings.capitalStack.mezzanine.interestRate += varianceValue;
      break;
    }

    case 'land': {
      // Variance is % (e.g. 10 = +10% Purchase Price)
      const multiplier = 1 + (varianceValue / 100);
      const newPrice = newSettings.acquisition.purchasePrice * multiplier;
      newSettings.acquisition.purchasePrice = newPrice;
      // Stamp Duty & Agent Fees will auto-recalc in FinanceEngine based on this new price
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
        const finalScenarioParts = applyVariance(
            xAxis, 
            xVal, 
            yScenario.settings, 
            yScenario.costs, 
            yScenario.revenues
        );

        const tempScenario: FeasibilityScenario = {
          id: 'temp-sensitivity',
          name: 'Sensitivity Run',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isBaseline: false,
          status: ScenarioStatus.DRAFT,
          strategy: 'SELL',
          settings: finalScenarioParts.settings,
          costs: finalScenarioParts.costs,
          revenues: finalScenarioParts.revenues
        };

        const flows = FinanceEngine.calculateMonthlyCashflow(tempScenario, siteDNA);

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
  },

  /**
   * Generates a 1-Dimensional Sensitivity Table for a specific variable.
   * Returns rows detailing TDC, Profit, Margin, IRR.
   */
  generateSensitivityTable(
    variable: SensitivityVariable,
    settings: FeasibilitySettings,
    costs: LineItem[],
    revenues: RevenueItem[],
    siteDNA: SiteDNA
  ): SensitivityRow[] {
    
    // Define steps based on variable
    let steps: number[] = [];
    if (variable === 'duration') {
      steps = [-3, 0, 3, 6, 9, 12]; // Months
    } else if (variable === 'interest') {
      steps = [-0.5, 0, 0.5, 1.0, 1.5, 2.0]; // Absolute %
    } else {
      steps = [-20, -10, -5, 0, 5, 10, 20]; // Percentage
    }

    const rows: SensitivityRow[] = [];

    for (const step of steps) {
        // 1. Create variant
        const variant = applyVariance(variable, step, settings, costs, revenues);
        
        // 2. Determine Display Value for the variable
        let variableValue = 0;
        let varianceLabel = '';

        switch (variable) {
            case 'land':
                variableValue = variant.settings.acquisition.purchasePrice;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'cost':
                // Sum Construction
                variableValue = variant.costs
                    .filter(c => c.category === CostCategory.CONSTRUCTION)
                    .reduce((a,b) => a+b.amount, 0);
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'revenue':
                // Est. Gross Revenue
                variableValue = variant.revenues.reduce((a,b) => a + (b.units * b.pricePerUnit), 0);
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'duration':
                variableValue = variant.settings.durationMonths;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step} Months` : `${step} Months`);
                break;
            case 'interest':
                variableValue = variant.settings.capitalStack.senior.interestRate;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step.toFixed(1)}%` : `${step.toFixed(1)}%`);
                break;
        }

        // 3. Run Engine
        const tempScenario: FeasibilityScenario = {
            id: 'temp-risk',
            name: 'Risk Run',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isBaseline: false,
            status: ScenarioStatus.DRAFT,
            strategy: 'SELL',
            settings: variant.settings,
            costs: variant.costs,
            revenues: variant.revenues
        };

        const flows = FinanceEngine.calculateMonthlyCashflow(tempScenario, siteDNA);

        // 4. Calculate Metrics
        const totalOut = flows.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
        const totalIn = flows.reduce((acc, curr) => acc + curr.netRevenue, 0);
        const profit = totalIn - totalOut;
        const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;
        
        const equityFlows = flows.map(f => f.repayEquity - f.drawDownEquity);
        const irr = FinanceEngine.calculateIRR(equityFlows);

        rows.push({
            varianceLabel,
            variableValue,
            devCost: totalOut,
            netProfit: profit,
            margin,
            irr,
            isBaseCase: step === 0
        });
    }

    return rows;
  }
};
