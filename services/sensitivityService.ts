
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, SensitivityVariable, SiteDNA, FeasibilityScenario, ScenarioStatus, SensitivityRow } from '../types';
import { FinanceEngine } from './financeEngine';

export interface SensitivityCell {
  xVar: number; 
  yVar: number; 
  margin: number;
  profit: number;
}

const FIXED_TIMESTAMP = "2024-01-01T00:00:00.000Z";

// In-memory cache
const MATRIX_CACHE = new Map<string, SensitivityCell[][]>();

// Helper to apply variance (Pure)
export const applyVariance = (
  type: SensitivityVariable,
  varianceValue: number, 
  settings: FeasibilitySettings,
  costs: LineItem[],
  revenues: RevenueItem[]
): { settings: FeasibilitySettings; costs: LineItem[]; revenues: RevenueItem[] } => {
  
  let newSettings = JSON.parse(JSON.stringify(settings));
  let newCosts = costs.map(c => ({...c}));
  let newRevenues = revenues.map(r => ({...r}));

  switch (type) {
    case 'revenue': {
      const multiplier = 1 + (varianceValue / 100);
      newRevenues = newRevenues.map(r => ({
        ...r,
        pricePerUnit: r.pricePerUnit * multiplier
      }));
      break;
    }
    case 'cost': {
      const multiplier = 1 + (varianceValue / 100);
      newCosts = newCosts.map(c => {
        if (c.category === CostCategory.CONSTRUCTION) {
          const newItem = { ...c, amount: c.amount * multiplier };
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
      const delay = varianceValue;
      newSettings.durationMonths = settings.durationMonths + delay;
      newCosts = newCosts.map(c => {
        if (c.category === CostCategory.CONSTRUCTION) {
          return { ...c, span: c.span + delay };
        }
        return c;
      });
      break;
    }
    case 'interest': {
      newSettings.capitalStack.senior.interestRate += varianceValue;
      newSettings.capitalStack.mezzanine.interestRate += varianceValue;
      break;
    }
    case 'land': {
      const multiplier = 1 + (varianceValue / 100);
      newSettings.acquisition.purchasePrice = settings.acquisition.purchasePrice * multiplier;
      break;
    }
  }

  return { settings: newSettings, costs: newCosts, revenues: newRevenues };
};

// Pure Synchronous Matrix Calculation
export const calculateMatrixSync = (
    settings: FeasibilitySettings,
    baseCosts: LineItem[],
    baseRevenues: RevenueItem[],
    xAxis: SensitivityVariable,
    yAxis: SensitivityVariable,
    stepsX: number[],
    stepsY: number[],
    siteDNA: SiteDNA
): SensitivityCell[][] => {
    const matrix: SensitivityCell[][] = [];

    for (const yVal of stepsY) {
      const row: SensitivityCell[] = [];
      const yScenario = applyVariance(yAxis, yVal, settings, baseCosts, baseRevenues);

      for (const xVal of stepsX) {
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
          createdAt: FIXED_TIMESTAMP, // Deterministic
          updatedAt: FIXED_TIMESTAMP, // Deterministic
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
};

export const SensitivityService = {
  /**
   * Generates a matrix of financial outcomes.
   * Supports caching and optional Web Worker execution.
   */
  generateMatrix: async (
    settings: FeasibilitySettings,
    baseCosts: LineItem[],
    baseRevenues: RevenueItem[],
    xAxis: SensitivityVariable,
    yAxis: SensitivityVariable,
    stepsX: number[],
    stepsY: number[],
    siteDNA: SiteDNA,
    options: { runInWorker?: boolean } = {}
  ): Promise<SensitivityCell[][]> => {
    
    // 1. Check Cache
    const cacheKey = JSON.stringify({ settings, costs: baseCosts, revenues: baseRevenues, xAxis, yAxis, stepsX, stepsY, siteDNA });
    if (MATRIX_CACHE.has(cacheKey)) {
        return MATRIX_CACHE.get(cacheKey)!;
    }

    let result: SensitivityCell[][];

    // 2. Worker Execution
    if (options.runInWorker && typeof Worker !== 'undefined') {
        try {
            const worker = new Worker(new URL('./sensitivity.worker.ts', import.meta.url), { type: 'module' });
            
            result = await new Promise<SensitivityCell[][]>((resolve, reject) => {
                worker.onmessage = (e) => {
                    resolve(e.data);
                    worker.terminate();
                };
                worker.onerror = (e) => {
                    console.warn("Worker error, falling back to sync", e);
                    worker.terminate();
                    resolve(calculateMatrixSync(settings, baseCosts, baseRevenues, xAxis, yAxis, stepsX, stepsY, siteDNA));
                };
                worker.postMessage({ settings, costs: baseCosts, revenues: baseRevenues, xAxis, yAxis, stepsX, stepsY, siteDNA });
            });
        } catch (e) {
            console.warn("Worker instantiation failed, running sync", e);
            result = calculateMatrixSync(settings, baseCosts, baseRevenues, xAxis, yAxis, stepsX, stepsY, siteDNA);
        }
    } else {
        // 3. Sync Execution
        await new Promise(r => setTimeout(r, 0)); 
        result = calculateMatrixSync(settings, baseCosts, baseRevenues, xAxis, yAxis, stepsX, stepsY, siteDNA);
    }

    // 4. Update Cache
    MATRIX_CACHE.set(cacheKey, result);
    return result;
  },

  /**
   * Generates a 1-Dimensional Sensitivity Table.
   */
  generateSensitivityTable(
    variable: SensitivityVariable,
    settings: FeasibilitySettings,
    costs: LineItem[],
    revenues: RevenueItem[],
    siteDNA: SiteDNA
  ): SensitivityRow[] {
    
    let steps: number[] = [];
    if (variable === 'duration') steps = [-3, 0, 3, 6, 9, 12];
    else if (variable === 'interest') steps = [-0.5, 0, 0.5, 1.0, 1.5, 2.0];
    else steps = [-20, -10, -5, 0, 5, 10, 20];

    const rows: SensitivityRow[] = [];

    for (const step of steps) {
        const variant = applyVariance(variable, step, settings, costs, revenues);
        
        let variableValue = 0;
        let varianceLabel = '';

        switch (variable) {
            case 'land':
                variableValue = variant.settings.acquisition.purchasePrice;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'cost':
                variableValue = variant.costs.filter(c => c.category === CostCategory.CONSTRUCTION).reduce((a,b) => a+b.amount, 0);
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'revenue':
                variableValue = variant.revenues.reduce((a,b) => a + (b.units * b.pricePerUnit), 0);
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step}%` : `${step}%`);
                break;
            case 'duration':
                variableValue = variant.settings.durationMonths;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step} Mo` : `${step} Mo`);
                break;
            case 'interest':
                variableValue = variant.settings.capitalStack.senior.interestRate;
                varianceLabel = step === 0 ? 'Base Case' : (step > 0 ? `+${step.toFixed(1)}%` : `${step.toFixed(1)}%`);
                break;
        }

        const tempScenario: FeasibilityScenario = {
            id: 'temp-risk',
            name: 'Risk Run',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
            isBaseline: false,
            status: ScenarioStatus.DRAFT,
            strategy: 'SELL',
            settings: variant.settings,
            costs: variant.costs,
            revenues: variant.revenues
        };

        const flows = FinanceEngine.calculateMonthlyCashflow(tempScenario, siteDNA);
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
