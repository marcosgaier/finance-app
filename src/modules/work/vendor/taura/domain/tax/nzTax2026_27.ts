import type {NzTaxRuleSet} from './taxTypes';

export const nzTax2026_27:NzTaxRuleSet={
  id:'2026-27',
  startsOn:'2026-04-01',
  endsOn:'2027-03-31',
  accRate:0.0175,
  accMaximumEarnings:156_641,
  accMaximumLevy:2_741.22,
  sourceUrl:'https://www.ird.govt.nz/digital-service-providers/services-catalogue/returns-and-information/payday-filing/payroll-calculations-and-business-rules',
  sourceUpdatedOn:'2026-04-01',
};

export const supportedNzTaxYears=[nzTax2026_27] as const;
