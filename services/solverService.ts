
import { FeasibilitySettings, LineItem, RevenueItem, CostCategory, DistributionMethod, InputType } from '../types';
import { FinanceEngine } from './financeEngine';

// Victorian Stamp Duty Calculator Helper
// Replicates the logic from VictorianInputs to ensure the solver accounts for acquisition costs correctly
const calculateStampDuty = (landValue: number): number => {
  let stampDuty = 0;
  if (landValue > 960000) {
    stampDuty = landValue * 0.055;
  } else if (landValue > 480000) {
    stampDuty = 20370 + (landValue - 480000) * 0.06;
  } else if (landValue > 130000) {
    stampDuty = 2870 + (landValue - 130000) * 0.05;
  } else if (landValue > 25000) {
    stampDuty = 350 + (landValue - 25000) * 0.024;
  } else {
    stampDuty = landValue * 0.014;
  }
  return stampDuty;
};

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
   * Uses Binary Search to handle the circular reference of Land -> Duty -> Loan -> Interest -> Cost -> Margin.
   */
  solveForResidualLandValue(
    targetValue: number, // e.g., 20 for 20%
    targetType: 'margin' | 'irr',
    settings: FeasibilitySettings,
    currentCosts: LineItem[],
    revenues: RevenueItem[]
  ): SolveResult {
    
    // 1. Identification
    // Find the Land Line Item
    const landItemIndex = currentCosts.findIndex(c => c.category === CostCategory.LAND);
    if (landItemIndex === -1) {
      throw new Error("No 'Land Purchasing' line item found in costs.");
    }

    // Find the Stamp Duty Line Item (optional, but recommended for accuracy)
    // We look for Statutory category with "Duty" in description, or just the first Statutory item if specific one not found
    const dutyItemIndex = currentCosts.findIndex(c => 
      c.category === CostCategory.STATUTORY && 
      (c.description.toLowerCase().includes('duty') || c.description.toLowerCase().includes('stamp'))
    );

    // 2. Binary Search Setup
    let min = 0;
    let max = 100_000_000; // Cap at $100M to prevent infinite loops on crazy scenarios
    let bestGuess = 0;
    let bestMetric = -999;
    
    // Revenue is static for RLV calculations usually (unless based on % costs, but we assume fixed G.R. for Land RLV)
    // However, FinanceEngine handles dynamic revenue inputs if they exist.

    // 3. Iteration Loop
    // We want to find the Land Value where Metric == Target
    // If Result Metric > Target, we can afford MORE for land.
    // If Result Metric < Target, we must pay LESS for land.
    
    let iterations = 0;
    const maxIterations = 40; // High precision
    const tolerance = 0.01; // 0.01% tolerance

    while (iterations < maxIterations) {
      const mid = (min + max) / 2;
      
      // A. Construct Simulation Costs
      const simCosts = currentCosts.map(c => ({...c})); // Deepish copy
      
      // Update Land Price
      simCosts[landItemIndex].amount = mid;
      
      // Update Stamp Duty (Auto-calculate based on VIC logic)
      if (dutyItemIndex !== -1) {
        simCosts[dutyItemIndex].amount = calculateStampDuty(mid);
      }

      // B. Run Engine
      const cashflow = FinanceEngine.calculateMonthlyCashflow(settings, simCosts, revenues);

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
      // Note: As Land Price INCREASES, Profit/Margin/IRR DECREASES. Inverse relationship.
      
      if (achieved > targetValue) {
        // We are making more than target, so we can pay MORE for land.
        min = mid;
        bestGuess = mid;
        bestMetric = achieved;
      } else {
        // We are making less than target, so we must pay LESS for land.
        max = mid;
      }
      
      // Optimization: Early exit if we are extremely close
      if (Math.abs(achieved - targetValue) < tolerance) {
        bestGuess = mid;
        break;
      }

      iterations++;
    }

    return {
      landValue: Math.floor(bestGuess), // Round down to nearest dollar for clean numbers
      stampDuty: calculateStampDuty(bestGuess),
      achievedMetric: bestMetric,
      iterations,
      success: true
    };
  }
};
