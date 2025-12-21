
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory } from '../types';
import { FinanceEngine } from './financeEngine';

export interface SensitivityCell {
  xVar: number; // Revenue change %
  yVar: number; // Cost change %
  margin: number;
  profit: number;
}

export const SensitivityService = {
  /**
   * Generates a matrix of financial outcomes by varying Revenue (X) and Construction Costs (Y).
   * Runs the FinanceEngine for each permutation.
   */
  generateMatrix(
    settings: FeasibilitySettings,
    baseCosts: LineItem[],
    baseRevenues: RevenueItem[],
    steps: number[] = [-15, -10, -5, 0, 5, 10, 15]
  ): SensitivityCell[][] {
    
    // Pre-calculate base construction indices to avoid repeated searching in the loop
    const constructionIndices = baseCosts
      .map((c, i) => c.category === CostCategory.CONSTRUCTION ? i : -1)
      .filter(i => i !== -1);

    const matrix: SensitivityCell[][] = [];

    // Loop Y-Axis (Construction Cost Variations)
    // We reverse steps for Y so +15% is at the top (visually intuitive for charts usually) 
    // or standard matrix order. Let's do standard top-to-bottom increasing cost? 
    // Usually tables read Top (+15%) to Bottom (-15%) or vice versa. 
    // Let's stick to the array order for now.
    
    for (const costVar of steps) {
      const row: SensitivityCell[] = [];
      const costMultiplier = 1 + (costVar / 100);

      // Create mutated costs
      // Optimization: Only deep clone the specific lines we change, shallow copy the array structure
      const scenarioCosts = baseCosts.map((c, i) => {
        // If it's a construction item, apply modifier
        if (c.category === CostCategory.CONSTRUCTION) {
          return { ...c, amount: c.amount * costMultiplier };
        }
        return c;
      });

      // Loop X-Axis (Revenue Variations)
      for (const revVar of steps) {
        const revMultiplier = 1 + (revVar / 100);

        // Create mutated revenues
        const scenarioRevenues = baseRevenues.map(r => ({
          ...r,
          pricePerUnit: r.pricePerUnit * revMultiplier
        }));

        // Run Engine
        const flows = FinanceEngine.calculateMonthlyCashflow(settings, scenarioCosts, scenarioRevenues);

        // Extract Metrics
        const totalOut = flows.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
        const totalIn = flows.reduce((acc, curr) => acc + curr.netRevenue, 0);
        const profit = totalIn - totalOut;
        const margin = totalOut > 0 ? (profit / totalOut) * 100 : 0;

        row.push({
          xVar: revVar,
          yVar: costVar,
          margin,
          profit
        });
      }
      matrix.push(row);
    }

    return matrix;
  }
};
