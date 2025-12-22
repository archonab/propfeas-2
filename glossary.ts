
export const GLOSSARY = {
  OPEX: "Operating Expenses: Ongoing costs to run the asset (Mgmt, Insurance, Rates).",
  CAP_RATE: "Capitalisation Rate: The yield used to value the asset. Net Rent / Cap Rate = Value.",
  MDC: "Margin on Development Cost: Net Profit / Total Development Cost.",
  LTC: "Loan to Cost: Total Debt divided by Total Development Cost. Banks usually cap this at 80%.",
  LVR: "Loan to Value Ratio: Total Debt divided by the Gross Realisation (End Value) of the project.",
  AUV: "Assessed Unimproved Value: The value of the land alone as determined by the Valuer-General, used to calculate Land Tax.",
  GST_SHIELD: "Input Tax Credits (ITC): GST paid on development costs that can be claimed back from the ATO, effectively reducing the net cost.",
  IRR: "Internal Rate of Return: The annualised rate of earnings on the equity invested. Takes into account the time value of money.",
  GROSS_REALISATION: "Total sales proceeds inclusive of GST.",
  NET_REALISATION: "Sales proceeds excluding GST. This is the actual revenue available to cover costs.",
  RESIDUAL_LAND_VALUE: "The maximum price you can pay for the land to achieve a target profit margin, given fixed costs and revenue."
};

export type GlossaryTerm = keyof typeof GLOSSARY;
