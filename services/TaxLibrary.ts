
import { TaxConfiguration, TaxBracket, TaxState, TaxType } from '../types';

export const DEFAULT_TAX_SCALES: TaxConfiguration = {
  VIC: {
    STAMP_DUTY: [
      { limit: 25000, rate: 1.4, base: 0, method: 'SLIDING' },
      { limit: 130000, rate: 2.4, base: 350, method: 'SLIDING' },
      { limit: 480000, rate: 5.0, base: 2870, method: 'SLIDING' }, 
      { limit: 960000, rate: 6.0, base: 20370, method: 'SLIDING' }, 
      { limit: 999999999, rate: 5.5, base: 0, method: 'FLAT' }, // >960k is flat 5.5% of total value in VIC for premium/investment
    ],
    // VIC 2024/25 General Land Tax Scales
    LAND_TAX_GENERAL: [
      { limit: 50000, rate: 0, base: 0, method: 'SLIDING' },
      { limit: 100000, rate: 0, base: 500, method: 'SLIDING' }, // Fixed $500 for 50k-100k
      { limit: 300000, rate: 0.1, base: 975, method: 'SLIDING' }, // $975 + 0.1% excess
      { limit: 600000, rate: 0.3, base: 1350, method: 'SLIDING' }, // $1,350 + 0.3% excess
      { limit: 1000000, rate: 0.9, base: 2950, method: 'SLIDING' }, // $2,950 + 0.9% excess
      { limit: 1800000, rate: 1.2, base: 4975, method: 'SLIDING' }, 
      { limit: 3000000, rate: 1.55, base: 16475, method: 'SLIDING' }, 
      { limit: 999999999, rate: 2.55, base: 35075, method: 'SLIDING' },
    ],
    LAND_TAX_TRUST: []
  },
  NSW: {
    STAMP_DUTY: [
      { limit: 17000, rate: 1.25, base: 0, method: 'SLIDING' },
      { limit: 37000, rate: 1.5, base: 212, method: 'SLIDING' },
      { limit: 97000, rate: 1.75, base: 512, method: 'SLIDING' },
      { limit: 368000, rate: 3.5, base: 1562, method: 'SLIDING' },
      { limit: 1220000, rate: 4.5, base: 11047, method: 'SLIDING' }, // Updated bracket cap
      { limit: 999999999, rate: 5.5, base: 49387, method: 'SLIDING' }, // Updated base
    ],
    LAND_TAX_GENERAL: [
      { limit: 1075000, rate: 0, base: 0, method: 'SLIDING' }, // Threshold
      { limit: 999999999, rate: 1.6, base: 100, method: 'SLIDING' },
    ],
    LAND_TAX_TRUST: []
  },
  QLD: {
    STAMP_DUTY: [
      { limit: 5000, rate: 0, base: 0, method: 'SLIDING' },
      { limit: 75000, rate: 1.5, base: 0, method: 'SLIDING' },
      { limit: 540000, rate: 3.5, base: 1050, method: 'SLIDING' },
      { limit: 1000000, rate: 4.5, base: 17325, method: 'SLIDING' },
      { limit: 999999999, rate: 5.75, base: 38025, method: 'SLIDING' },
    ],
    LAND_TAX_GENERAL: [
        { limit: 600000, rate: 0, base: 0, method: 'SLIDING' },
        { limit: 1000000, rate: 1.0, base: 500, method: 'SLIDING' },
        { limit: 3000000, rate: 1.65, base: 4500, method: 'SLIDING' },
        { limit: 5000000, rate: 1.25, base: 37500, method: 'SLIDING' },
        { limit: 10000000, rate: 1.75, base: 62500, method: 'SLIDING' },
        { limit: 999999999, rate: 2.25, base: 150000, method: 'SLIDING' },
    ],
    LAND_TAX_TRUST: []
  }
};

export const TaxLibrary = {
  getDefaultScales: (): TaxConfiguration => DEFAULT_TAX_SCALES,

  calculateTax: (
    amount: number, 
    scales: TaxConfiguration, 
    state: TaxState, 
    type: TaxType
  ): number => {
    // 1. Get Brackets for State & Type
    const brackets = scales[state]?.[type] || [];
    
    // Safety Fallback
    if (!brackets || brackets.length === 0) {
      if (type === 'STAMP_DUTY') return amount * 0.05; // Fallback 5%
      return 0;
    }

    // 2. Iterate
    let tax = 0;
    
    for (let i = 0; i < brackets.length; i++) {
        const b = brackets[i];
        const prevLimit = i === 0 ? 0 : brackets[i-1].limit;
        
        // Check if value falls in this bracket
        if (amount <= b.limit || i === brackets.length - 1) {
            if (b.method === 'FLAT') {
                // Flat rate on TOTAL value (e.g. VIC >$960k rule for duty)
                tax = amount * (b.rate / 100);
            } else {
                // Marginal / Sliding scale
                // Logic: Base Amount + (Rate * (Value - Previous Limit))
                // Note: For the very first bracket, prevLimit is 0.
                const excess = Math.max(0, amount - prevLimit);
                tax = b.base + (excess * (b.rate / 100));
            }
            break; // Found the top bracket for this amount
        }
    }

    return tax;
  }
};
