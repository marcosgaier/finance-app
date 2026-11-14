import type {OvertimePreference,OvertimeWeekSummary,PayPeriodProjection,PayPeriodStatus,Settings,Shift} from '../types';
import {addDays,fromIsoDate,startOfWorkWeek,toIsoDate} from '../lib/dates';
import {effectiveHours,totals} from '../lib/payroll';
import {calculateEstimatedWeeklyNet} from './tax/calculateWeeklyPAYE';
import {calculateContractOvertime,getOvertimeWeekEnd,getOvertimeWeekStart,PAYROLL_WEEK_STARTS_ON} from './contractRules';

const payable=(shift:Shift)=>shift.kind!=='off'&&!['cancelled','unpaid_leave'].includes(shift.status);
export const getPayPeriodStart=(date:Date|string,weekStartsOn=PAYROLL_WEEK_STARTS_ON)=>startOfWorkWeek(typeof date==='string'?fromIsoDate(date):date,weekStartsOn);
export const getPayPeriodEnd=(periodStart:Date|string)=>addDays(typeof periodStart==='string'?fromIsoDate(periodStart):periodStart,6);
export function getPayDate(periodEnd:Date|string,payday:number){const end=typeof periodEnd==='string'?fromIsoDate(periodEnd):periodEnd,raw=(payday-end.getDay()+7)%7;return addDays(end,raw===0?7:raw)}
export function groupShiftsByPayPeriod(shifts:Shift[],weekStartsOn=PAYROLL_WEEK_STARTS_ON){const groups=new Map<string,Shift[]>();for(const shift of shifts){const key=toIsoDate(getPayPeriodStart(shift.shift_date,weekStartsOn));groups.set(key,[...(groups.get(key)??[]),shift])}return groups}
export function getPayPeriodStatus(shifts:Shift[],today:Date):PayPeriodStatus {const relevant=shifts.filter(payable);if(!relevant.length)return 'projected';const todayIso=toIsoDate(today),complete=relevant.filter(s=>s.shift_date<todayIso||['worked','modified','confirmed','payslip'].includes(s.status)).length;if(complete===0)return 'projected';if(complete===relevant.length)return 'worked';return 'partially_worked'}

export function buildPayProjection(periodStart:Date|string,shifts:Shift[],settings:Settings,today=new Date(),overtimeContext=shifts,preferences:OvertimePreference[]=[]):PayPeriodProjection {
  const start=typeof periodStart==='string'?fromIsoDate(periodStart):periodStart,end=getPayPeriodEnd(start),included=shifts.filter(payable),rated=calculateContractOvertime(overtimeContext,settings,preferences),rows=included.map(shift=>rated.get(shift.id)).filter(row=>row!==undefined),sum=totals(rows);
  let dayHours=0,nightHours=0;
  const overtimeWeekMap=new Map<string,OvertimeWeekSummary>();
  for(const shift of included){
    const hours=effectiveHours(shift).hours;if(shift.kind==='night')nightHours+=hours;else dayHours+=hours;
    const row=rated.get(shift.id);if(!row||row.overtime<=0)continue;
    const weekStart=toIsoDate(getOvertimeWeekStart(shift.shift_date)),existing=overtimeWeekMap.get(weekStart)??{weekStart,weekEnd:toIsoDate(getOvertimeWeekEnd(weekStart)),overtimeHours:0,overtimeTreatment:row.overtimeTreatment,enhancedPayment:0,bankableHours:0};
    existing.overtimeHours+=row.overtime;existing.enhancedPayment+=row.enhancedPayment;if(row.overtimeTreatment==='bank')existing.bankableHours+=row.bankableHours;overtimeWeekMap.set(weekStart,existing);
  }
  const startsOn=toIsoDate(start),payDate=toIsoDate(getPayDate(end,settings.payday)),estimate=calculateEstimatedWeeklyNet(sum.gross,payDate,settings.kiwisaver_rate,'M');
  return {id:startsOn,startsOn,endsOn:toIsoDate(end),payDate,status:getPayPeriodStatus(included,today),shiftCount:included.length,dayHours,nightHours,ordinaryHours:sum.ordinary,overtimeHours:sum.overtime,basePay:sum.basePay,nightAllowance:sum.nightAllowance,weekendEligibleHours:sum.weekendEligibleHours,weekendAllowance:sum.weekendAllowance,enhancedPayment:sum.enhancedPayment,bankableHours:sum.bankableHours,overtimeWeeks:[...overtimeWeekMap.values()],gross:estimate.estimatedGross,...estimate,estimatedTaxCode:estimate.taxCode,estimatedTaxYear:estimate.taxYear,shifts:included};
}

export function buildPayProjections(shifts:Shift[],settings:Settings,today=new Date(),futureCount=4,preferences:OvertimePreference[]=[]){
  const current=getPayPeriodStart(today,PAYROLL_WEEK_STARTS_ON),lastShift=shifts.length?shifts.reduce((latest,s)=>s.shift_date>latest?s.shift_date:latest,shifts[0].shift_date):toIsoDate(current),minimumEnd=addDays(current,(futureCount+1)*7),end=fromIsoDate(lastShift)>minimumEnd?getPayPeriodStart(lastShift,PAYROLL_WEEK_STARTS_ON):minimumEnd,start=addDays(current,-14),groups=groupShiftsByPayPeriod(shifts,PAYROLL_WEEK_STARTS_ON),result:PayPeriodProjection[]=[];
  for(let cursor=start;cursor<=end;cursor=addDays(cursor,7)){const key=toIsoDate(cursor);result.push(buildPayProjection(cursor,groups.get(key)??[],settings,today,shifts,preferences))}
  return result;
}
