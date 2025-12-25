
import { ReportModel, TaxConfiguration } from '../types';
import { Site, FeasibilityScenario } from '../types-v2';
import { FinanceEngine } from './financeEngine';
import { DEFAULT_TAX_SCALES } from '../constants';

export const ReportService = {
  /**
   * Generates the Single Source of Truth for a given scenario.
   * All PDF reports and UI summaries must consume this model.
   */
  runFeasibility(
    scenario: FeasibilityScenario, 
    site: Site, 
    linkedScenario?: FeasibilityScenario,
    taxScales: TaxConfiguration = DEFAULT_TAX_SCALES
  ): ReportModel {
    
    // 1. Calculate Monthly Flows (The Engine)
    const monthlyFlows = FinanceEngine.calculateMonthlyCashflow(
        scenario, 
        site, 
        linkedScenario, 
        taxScales
    );

    // 2. Calculate Itemised Flows (For Report Tables)
    const itemisedCashflow = FinanceEngine.generateItemisedCashflowData(
        scenario, 
        site,
        monthlyFlows,
        taxScales
    );

    // 3. Calculate Item Summaries (For P&L) - Precise Net/GST Calculation per Item
    const itemSummaries = FinanceEngine.calculateLineItemSummaries(
        scenario,
        site,
        taxScales
    );

    // 4. Generate GST Audit Trail (For Detailed Tax Reporting)
    const gstAudit = FinanceEngine.generateGstAuditTrail(
        scenario,
        site,
        taxScales
    );

    // 5. Calculate Metrics (Using Canonical Logic)
    const metrics = FinanceEngine.calculateProjectMetrics(monthlyFlows, scenario.settings, site);

    // 6. Construct Report Model
    return {
        timestamp: new Date().toISOString(),
        basis: {
            pricesIncludeGST: true,
            gstMethod: 'FULL_GST' 
        },
        metrics: metrics,
        itemSummaries: itemSummaries,
        gstAudit: gstAudit,
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
