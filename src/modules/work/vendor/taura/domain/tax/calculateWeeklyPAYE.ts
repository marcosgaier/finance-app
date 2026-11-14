import {supportedNzTaxYears} from './nzTax2026_27';
import type {EstimatedWeeklyNet,NzTaxCode,NzTaxRuleSet,NzTaxYearId,NzWeeklyPayeResult} from './taxTypes';

const truncateCents=(value:number)=>Math.trunc((value+Number.EPSILON)*100)/100;
const roundCents=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export function resolveNzTaxYear(periodDate:string):NzTaxRuleSet|undefined {
  return supportedNzTaxYears.find(rules=>periodDate>=rules.startsOn&&periodDate<=rules.endsOn);
}

function annualIncomeTax(annualIncome:number){
  if(annualIncome<=15_600)return annualIncome*0.105;
  if(annualIncome<=53_500)return annualIncome*0.175-1_092;
  if(annualIncome<=78_100)return annualIncome*0.30-7_779.50;
  if(annualIncome<=180_000)return annualIncome*0.33-10_122.50;
  return annualIncome*0.39-20_922.50;
}

export function calculateWeeklyPAYE(gross:number,periodDate:string,taxCode:NzTaxCode='M'):NzWeeklyPayeResult {
  const rules=resolveNzTaxYear(periodDate);
  if(!rules)throw new Error(`No hay reglas PAYE locales para el período ${periodDate}.`);
  if(taxCode!=='M')throw new Error(`El código tributario ${taxCode} todavía no está soportado.`);
  if(!Number.isFinite(gross)||gross<0)throw new Error('El bruto semanal debe ser un número mayor o igual a cero.');
  if(gross===0)return {taxCode,taxYear:rules.id,paye:0,includesAccEarnersLevy:true};

  // Secuencia oficial IR: anualizar, eliminar centavos, calcular tax + ACC,
  // dividir entre 52 y truncar (no redondear) a centavos.
  const annualIncome=Math.trunc(roundCents(gross)*52);
  const incomeTax=Math.max(0,annualIncomeTax(annualIncome));
  const accLevy=annualIncome<rules.accMaximumEarnings
    ? annualIncome*rules.accRate
    : rules.accMaximumLevy;
  const paye=truncateCents((incomeTax+accLevy)/52);
  return {taxCode,taxYear:rules.id,paye:Math.max(0,paye),includesAccEarnersLevy:true};
}

export function calculateEstimatedWeeklyNet(gross:number,periodDate:string,kiwiSaverRate=3.5,taxCode:NzTaxCode='M'):EstimatedWeeklyNet {
  if(!Number.isFinite(kiwiSaverRate)||kiwiSaverRate<0)throw new Error('La tasa KiwiSaver debe ser mayor o igual a cero.');
  const estimatedGross=roundCents(Math.max(0,gross));
  const paye=calculateWeeklyPAYE(estimatedGross,periodDate,taxCode);
  const estimatedKiwiSaver=estimatedGross===0?0:truncateCents(estimatedGross*kiwiSaverRate/100);
  const estimatedNet=roundCents(Math.max(0,estimatedGross-paye.paye-estimatedKiwiSaver));
  return {estimatedGross,estimatedPAYE:paye.paye,estimatedKiwiSaver,estimatedNet,taxCode,taxYear:paye.taxYear,payeIncludesAccEarnersLevy:true};
}

export type {NzTaxYearId};
