
import { describe, it, expect } from 'vitest';
import { safeParseScenario, FeasibilitySettingsSchema, LineItemSchema } from '../schemas';
import { createDefaultScenario } from '../constants';
import { FeasibilityScenario, CostCategory, InputType, DistributionMethod, GstTreatment } from '../types';

describe('Runtime Schema Validation', () => {
  
  describe('FeasibilityScenario Validation', () => {
    it('should validate a correct default scenario', () => {
      const scenario = createDefaultScenario();
      const result = safeParseScenario(scenario);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject a scenario with missing required fields', () => {
      const scenario = createDefaultScenario();
      // @ts-ignore
      delete scenario.settings.acquisition.purchasePrice;
      
      const result = safeParseScenario(scenario);
      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
      // Expect error in settings.acquisition.purchasePrice
      // @ts-ignore
      expect(result.errors?.settings?.acquisition?.purchasePrice).toBeDefined();
    });

    it('should reject invalid enums', () => {
      const scenario = createDefaultScenario();
      // @ts-ignore
      scenario.strategy = 'INVALID_STRATEGY';
      
      const result = safeParseScenario(scenario);
      expect(result.ok).toBe(false);
    });
  });

  describe('FeasibilitySettings Constraints', () => {
    it('should reject negative duration', () => {
      const settings = createDefaultScenario().settings;
      settings.durationMonths = -5;
      
      const result = FeasibilitySettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it('should reject negative purchase price', () => {
        const settings = createDefaultScenario().settings;
        settings.acquisition.purchasePrice = -10000;
        
        const result = FeasibilitySettingsSchema.safeParse(settings);
        expect(result.success).toBe(false);
    });

    it('should reject negative deposit percent', () => {
        const settings = createDefaultScenario().settings;
        settings.acquisition.depositPercent = -10;
        
        const result = FeasibilitySettingsSchema.safeParse(settings);
        expect(result.success).toBe(false);
    });

    it('should reject deposit percent > 100', () => {
        const settings = createDefaultScenario().settings;
        settings.acquisition.depositPercent = 120;
        
        const result = FeasibilitySettingsSchema.safeParse(settings);
        expect(result.success).toBe(false);
    });
  });

  describe('LineItem Constraints', () => {
    it('should reject span < 1', () => {
        const item = {
            id: '1', code: 'C1', category: CostCategory.CONSTRUCTION, description: 'Test',
            inputType: InputType.FIXED, amount: 100, startDate: 0, 
            span: 0, // Invalid
            method: DistributionMethod.LINEAR, escalationRate: 0, gstTreatment: GstTreatment.TAXABLE
        };
        const result = LineItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });

    it('should allow valid item', () => {
        const item = {
            id: '1', code: 'C1', category: CostCategory.CONSTRUCTION, description: 'Test',
            inputType: InputType.FIXED, amount: 100, startDate: 0, 
            span: 12, // Valid
            method: DistributionMethod.LINEAR, escalationRate: 0, gstTreatment: GstTreatment.TAXABLE
        };
        const result = LineItemSchema.safeParse(item);
        expect(result.success).toBe(true);
    });

    it('should reject NaN amount', () => {
        const item = {
            id: '1', code: 'C1', category: CostCategory.CONSTRUCTION, description: 'Test',
            inputType: InputType.FIXED, amount: NaN, startDate: 0, span: 1,
            method: DistributionMethod.LINEAR, escalationRate: 0, gstTreatment: GstTreatment.TAXABLE
        };
        const result = LineItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });
  });

});
