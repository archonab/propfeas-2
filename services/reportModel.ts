
import { FeasibilityScenario, SiteDNA, ReportModel, TaxConfiguration } from '../types';
import { FinanceEngine } from './financeEngine';
import { DEFAULT_TAX_SCALES } from '../constants';

export const ReportService = {
  /**
   * Generates the Single Source of Truth for a given scenario.
   * All PDF reports and UI summaries must consume this model.
   */
  runFeasibility(
    scenario: FeasibilityScenario, 
    siteDNA: SiteDNA, 
    linkedScenario?: FeasibilityScenario,
    taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
  ): ReportModel {
    
    // 1. Calculate Monthly Flows (The Engine)
    const monthlyFlows = FinanceEngine.calculateMonthlyCashflow(
        scenario, 
        siteDNA, 
        linkedScenario, 
        taxScales
    );

    // 2. Calculate Itemised Flows (For Report Tables)
    // Note: generateItemisedCashflowData has been updated to include implicit land costs
    const itemisedCashflow = FinanceEngine.generateItemisedCashflowData(
        scenario, 
        siteDNA, 
        taxScales
    );

    // 3. Calculate Metrics (Using Canonical Logic)
    const metrics = FinanceEngine.calculateProjectMetrics(monthlyFlows, scenario.settings);

    // 4. Construct Report Model
    return {
        timestamp: new Date().toISOString(),
        basis: {
            pricesIncludeGST: true,
            gstMethod: 'FULL_GST' 
        },
        metrics: metrics,
        reconciliation: {
            totalCostGross: metrics.totalCostGross,
            gstInputCredits: metrics.gstInputCredits,
            totalCostNet: metrics.totalCostNet,
            grossRealisation: metrics.grossRealisation,
            gstPayable: metrics.gstCollected,
            netRealisation: metrics.netRealisation,
            netProfit: metrics.netProfit
        },
        cashflow: {
            monthly: monthlyFlows,
            itemised: itemisedCashflow
        }
    };
  }
};
