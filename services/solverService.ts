
import { FeasibilitySettings, LineItem, RevenueItem, SiteDNA } from '../types';
import { FinanceEngine } from './financeEngine';

interface SolveResult {
  landValue: number;
  stampDuty: number;
  achievedMetric: number;
  iterations: number;
  success: boolean;
}

export const SolverService = {
  /**
   * Solves for the maximum Land Purchase Price to achieve a target margin or IRR.
   * Modifies settings.acquisition.purchasePrice and lets FinanceEngine handle dependent costs (Duty, Agent Fees).
   */
  solveForResidualLandValue(
    targetValue: number, // e.g., 20 for 20%
    targetType: 'margin' | 'irr',
    settings: FeasibilitySettings,
    costs: LineItem[],
    revenues: RevenueItem[],
    siteDNA: SiteDNA
  ): SolveResult {
    
    // 1. Binary Search Setup
    let min = 0;
    let max = 200_000_000; // Cap at $200M
    let bestGuess = 0;
    let bestMetric = -999;
    
    let iterations = 0;
    const maxIterations = 40; // High precision
    const tolerance = 0.05; // Tolerance

    while (iterations < maxIterations) {
      const mid = (min + max) / 2;
      
      // A. Construct Simulation Settings
      // We create a copy of settings with the guessed purchase price
      const simSettings: FeasibilitySettings = {
        ...settings,
        acquisition: {
          ...settings.acquisition,
          purchasePrice: mid
        }
      };

      // B. Run Engine
      // The engine automatically calculates Stamp Duty, Buyer's Agent Fee, and Loan Establishment Fees based on the new price
      const cashflow = FinanceEngine.calculateMonthlyCashflow(simSettings, siteDNA, costs, revenues);

      // C. Calculate Metrics
      const totalOut = cashflow.reduce((acc, curr) => acc + curr.developmentCosts + curr.interestSenior + curr.interestMezz, 0);
      const totalIn = cashflow.reduce((acc, curr) => acc + curr.netRevenue, 0);
      const profit = totalIn - totalOut;

      let achieved = 0;
      if (targetType === 'margin') {
        // Developer Margin = Profit / Total Costs
        achieved = totalOut > 0 ? (profit / totalOut) * 100 : -100;
      } else {
        // IRR
        const equityFlows = cashflow.map(f => f.repayEquity - f.drawDownEquity);
        achieved = FinanceEngine.calculateIRR(equityFlows);
      }

      // D. Check & Adjust
      // As Land Price INCREASES -> Profit/Margin/IRR DECREASES.
      if (achieved > targetValue) {
        // We are making MORE than target, so we can afford to pay MORE for land.
        min = mid;
        bestGuess = mid;
        bestMetric = achieved;
      } else {
        // We are making LESS than target, so we must pay LESS for land.
        max = mid;
      }
      
      // Optimization: Early exit if we are extremely close
      if (Math.abs(achieved - targetValue) < tolerance) {
        bestGuess = mid;
        break;
      }

      iterations++;
    }

    const finalPrice = Math.floor(bestGuess);
    const finalDuty = FinanceEngine.calculateStampDuty(
        finalPrice, 
        settings.acquisition.stampDutyState, 
        settings.acquisition.isForeignBuyer
    );

    return {
      landValue: finalPrice,
      stampDuty: finalDuty,
      achievedMetric: bestMetric,
      iterations,
      success: true
    };
  }
};
