export type NzTaxCode='M';
export type NzTaxYearId='2026-27';

export interface NzWeeklyPayeResult {
  taxCode:NzTaxCode;
  taxYear:NzTaxYearId;
  paye:number;
  includesAccEarnersLevy:true;
}

export interface EstimatedWeeklyNet {
  estimatedGross:number;
  estimatedPAYE:number;
  estimatedKiwiSaver:number;
  estimatedNet:number;
  taxCode:NzTaxCode;
  taxYear:NzTaxYearId;
  payeIncludesAccEarnersLevy:true;
}

export interface NzTaxRuleSet {
  id:NzTaxYearId;
  startsOn:string;
  endsOn:string;
  accRate:number;
  accMaximumEarnings:number;
  accMaximumLevy:number;
  sourceUrl:string;
  sourceUpdatedOn:string;
}
