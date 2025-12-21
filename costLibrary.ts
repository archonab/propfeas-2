
import { CostCategory, DistributionMethod, GstTreatment, InputType, LineItem } from './types';

export interface LibraryItem extends Omit<LineItem, 'id' | 'startDate' | 'span'> {
  defaultSpan?: number; // Suggested duration in months
}

const RAW_LIBRARY: Record<CostCategory, LibraryItem[]> = {
  [CostCategory.LAND]: [
    {
      code: 'LND-000',
      category: CostCategory.LAND,
      description: 'Land Purchase Price',
      amount: 0, // User input placeholder
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.MARGIN_SCHEME,
      defaultSpan: 1
    },
    {
      code: 'LND-001',
      category: CostCategory.LAND,
      description: 'Legal Fees (Acquisition)',
      amount: 5000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'LND-002',
      category: CostCategory.LAND,
      description: 'Valuation Fees (Purchase)',
      amount: 3500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    }
  ],
  
  [CostCategory.CONSULTANTS]: [
    {
      code: 'CON-001',
      category: CostCategory.CONSULTANTS,
      description: 'Architect & Design Fees',
      amount: 4.5,
      inputType: InputType.PCT_CONSTRUCTION,
      method: DistributionMethod.S_CURVE,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'CON-002',
      category: CostCategory.CONSULTANTS,
      description: 'Project Management',
      amount: 2.0,
      inputType: InputType.PCT_CONSTRUCTION,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 24
    },
    {
      code: 'CON-003',
      category: CostCategory.CONSULTANTS,
      description: 'Town Planner',
      amount: 15000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 6
    },
    {
      code: 'CON-004',
      category: CostCategory.CONSULTANTS,
      description: 'Structural Engineer',
      amount: 1.2,
      inputType: InputType.PCT_CONSTRUCTION,
      method: DistributionMethod.S_CURVE,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'CON-005',
      category: CostCategory.CONSULTANTS,
      description: 'Civil Engineer (Drainage/Roads)',
      amount: 12000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 3
    },
    {
      code: 'CON-006',
      category: CostCategory.CONSULTANTS,
      description: 'Services Engineer (Mech/Elec/Hyd)',
      amount: 15000,
      inputType: InputType.FIXED,
      method: DistributionMethod.S_CURVE,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'CON-007',
      category: CostCategory.CONSULTANTS,
      description: 'Quantity Surveyor (QS)',
      amount: 8000,
      inputType: InputType.FIXED,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 24
    },
    {
      code: 'CON-008',
      category: CostCategory.CONSULTANTS,
      description: 'Land Surveyor (Re-establishment)',
      amount: 2500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'CON-009',
      category: CostCategory.CONSULTANTS,
      description: 'Geotechnical Report',
      amount: 3000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'CON-010',
      category: CostCategory.CONSULTANTS,
      description: 'Traffic Engineer',
      amount: 4500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'CON-011',
      category: CostCategory.CONSULTANTS,
      description: 'Acoustic Consultant',
      amount: 3500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'CON-012',
      category: CostCategory.CONSULTANTS,
      description: 'Landscape Architect',
      amount: 6000,
      inputType: InputType.FIXED,
      method: DistributionMethod.S_CURVE,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 6
    },
    {
      code: 'CON-013',
      category: CostCategory.CONSULTANTS,
      description: 'Building Surveyor (Permits)',
      amount: 7500,
      inputType: InputType.FIXED,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'CON-014',
      category: CostCategory.CONSULTANTS,
      description: 'ESD / Energy Rating Consultant',
      amount: 2500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'CON-015',
      category: CostCategory.CONSULTANTS,
      description: 'Heritage Consultant',
      amount: 5500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    }
  ],

  [CostCategory.STATUTORY]: [
    {
      code: 'STAT-001',
      category: CostCategory.STATUTORY,
      description: 'Council DA / Planning Fees',
      amount: 3500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    },
    {
      code: 'STAT-002',
      category: CostCategory.STATUTORY,
      description: 'Building Permit Fees',
      amount: 4500,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    },
    {
      code: 'STAT-003',
      category: CostCategory.STATUTORY,
      description: 'Long Service Levy (LSL)',
      amount: 0.35,
      inputType: InputType.PCT_CONSTRUCTION,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    },
    {
      code: 'STAT-004',
      category: CostCategory.STATUTORY,
      description: 'Open Space Contribution',
      amount: 5.0,
      inputType: InputType.PCT_REVENUE,
      method: DistributionMethod.END,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    },
    {
      code: 'STAT-005',
      category: CostCategory.STATUTORY,
      description: 'Water Authority Contribution',
      amount: 800,
      inputType: InputType.RATE_PER_UNIT,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    },
    {
      code: 'STAT-006',
      category: CostCategory.STATUTORY,
      description: 'Power Authority Contribution (Citipower/UE)',
      amount: 5000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 1
    }
  ],

  [CostCategory.CONSTRUCTION]: [
    {
      code: 'BLD-000',
      category: CostCategory.CONSTRUCTION,
      description: 'Head Contract (Construction)',
      amount: 0, // Main user input placeholder
      inputType: InputType.FIXED,
      method: DistributionMethod.S_CURVE,
      escalationRate: 3,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'BLD-001',
      category: CostCategory.CONSTRUCTION,
      description: 'Demolition & Site Clearance',
      amount: 25000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 2
    },
    {
      code: 'BLD-002',
      category: CostCategory.CONSTRUCTION,
      description: 'Construction Contingency',
      amount: 5.0,
      inputType: InputType.PCT_CONSTRUCTION,
      method: DistributionMethod.S_CURVE,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 12
    },
    {
      code: 'BLD-003',
      category: CostCategory.CONSTRUCTION,
      description: 'Site Remediation / Hazmat',
      amount: 10000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    }
  ],

  [CostCategory.SELLING]: [
    {
      code: 'MKT-001',
      category: CostCategory.SELLING,
      description: 'Sales Agent Commission',
      amount: 2.2,
      inputType: InputType.PCT_REVENUE,
      method: DistributionMethod.END,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'MKT-002',
      category: CostCategory.SELLING,
      description: 'Marketing Brochure & CGI',
      amount: 15000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 3
    },
    {
      code: 'MKT-003',
      category: CostCategory.SELLING,
      description: 'Showroom / Display Suite',
      amount: 50000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 3
    },
    {
      code: 'MKT-004',
      category: CostCategory.SELLING,
      description: 'Legal Fees (Sales & Settlement)',
      amount: 1500,
      inputType: InputType.RATE_PER_UNIT,
      method: DistributionMethod.END,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    },
    {
      code: 'MKT-005',
      category: CostCategory.SELLING,
      description: 'Digital Marketing Campaign',
      amount: 25000,
      inputType: InputType.FIXED,
      method: DistributionMethod.LINEAR,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 6
    }
  ],

  [CostCategory.MISCELLANEOUS]: [
    {
      code: 'MSC-001',
      category: CostCategory.MISCELLANEOUS,
      description: 'Council Rates (Holding)',
      amount: 3000,
      inputType: InputType.FIXED,
      method: DistributionMethod.LINEAR,
      escalationRate: 3,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 24
    },
    {
      code: 'MSC-002',
      category: CostCategory.MISCELLANEOUS,
      description: 'Land Tax (Holding)',
      amount: 5000,
      inputType: InputType.FIXED,
      method: DistributionMethod.LINEAR,
      escalationRate: 3,
      gstTreatment: GstTreatment.GST_FREE,
      defaultSpan: 24
    },
    {
      code: 'MSC-003',
      category: CostCategory.MISCELLANEOUS,
      description: 'Insurance (Project)',
      amount: 10000,
      inputType: InputType.FIXED,
      method: DistributionMethod.UPFRONT,
      escalationRate: 0,
      gstTreatment: GstTreatment.TAXABLE,
      defaultSpan: 1
    }
  ],
  
  [CostCategory.FINANCE]: []
};

// Transform RAW_LIBRARY (LibraryItem) into STANDARD_LIBRARY (LineItem) 
// for consumption by the application (CostLibraryModal etc.)
export const STANDARD_LIBRARY: Record<CostCategory, LineItem[]> = Object.entries(RAW_LIBRARY).reduce((acc, [key, items]) => {
  const category = key as CostCategory;
  acc[category] = items.map(item => ({
    id: `LIB-${item.code}`,
    code: item.code,
    category: item.category,
    description: item.description,
    inputType: item.inputType,
    amount: item.amount,
    startDate: 0,
    span: item.defaultSpan || 1,
    method: item.method,
    escalationRate: item.escalationRate,
    gstTreatment: item.gstTreatment
  }));
  return acc;
}, {} as Record<CostCategory, LineItem[]>);
