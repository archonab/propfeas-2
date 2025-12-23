
import { 
  LineItem, 
  CostCategory, 
  ProjectBudget, 
  BudgetLineItem, 
  VendorPlaceholder
} from '../types';
import { Site, FeasibilitySettings } from '../types-v2';
import { FinanceEngine } from './financeEngine';

export const BudgetService = {
  /**
   * Promotes a feasibility scenario to an active project budget.
   * Replicates the "Golden Thread" by locking the baseline and mapping items.
   */
  async promoteFeasibilityToBudget(
    scenarioId: string,
    settings: FeasibilitySettings,
    costs: LineItem[],
    constructionTotal: number,
    totalRevenue: number,
    site: Site
  ): Promise<ProjectBudget> {
    console.log(`Promoting Scenario ${scenarioId} to Live Budget...`);

    // 1. Identify Consultants for Vendor Placeholders
    const vendors: VendorPlaceholder[] = costs
      .filter(c => c.category === CostCategory.CONSULTANTS)
      .map(c => ({
        id: `VEND-${c.id}`,
        role: c.description,
        category: c.category,
        suggestedBudget: FinanceEngine.calculateLineItemTotal(c, settings, site, constructionTotal, totalRevenue)
      }));

    // 2. Map Costs to Budget Line Items
    const budgetItems: BudgetLineItem[] = costs.map(c => {
      const calculatedAmount = FinanceEngine.calculateLineItemTotal(c, settings, site, constructionTotal, totalRevenue);
      return {
        ...c,
        originalBudget: calculatedAmount,
        committedCost: 0,
        actualCost: 0,
        forecastCost: calculatedAmount // Initially forecast matches original budget
      } as BudgetLineItem;
    });

    // 3. Create the Project Budget Document
    const projectBudget: ProjectBudget = {
      id: `PROJ-${Date.now()}`,
      sourceScenarioId: scenarioId,
      projectName: settings.projectName || "Untitled Project",
      baselineDate: new Date().toISOString(),
      lineItems: budgetItems,
      vendors: vendors
    };

    return projectBudget;
  }
};
