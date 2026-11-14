import type {OvertimeTreatment,RatedHours,Settings,Shift} from '../types';
import {fromIsoDate,startOfWorkWeek,toIsoDate} from './dates';
import {calculateWeekendAllowance,calculateWeekendEligibleHours} from '../domain/weekendAllowance';

export function hoursBetween(start:string,end:string,breakHours=0):number {
  const a=new Date(start).getTime(), b=new Date(end).getTime();
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a) throw new Error('El turno debe terminar después de comenzar.');
  const value=(b-a)/3_600_000-breakHours;
  if(value<=0) throw new Error('El descanso no puede consumir todo el turno.');
  return value;
}
export function effectiveHours(s:Shift):{hours:number;rate:number;source:'planned'|'actual'} {
  const actual=['worked','modified','confirmed','payslip'].includes(s.status)&&s.actual_paid_hours!=null;
  return actual?{hours:s.actual_paid_hours!,rate:s.actual_rate??s.planned_rate,source:'actual'}:{hours:s.planned_paid_hours,rate:s.planned_rate,source:'planned'};
}
const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function calculateWeek(shifts:Shift[],settings:Pick<Settings,'overtime_threshold'|'overtime_multiplier'|'day_rate'|'night_shift_allowance'|'weekend_allowance'|'weekend_allowance_effective_from'>,overtimeTreatment:OvertimeTreatment='pay'):RatedHours[] {
  let used=0;
  return [...shifts].filter(s=>!['cancelled','unpaid_leave'].includes(s.status)&&s.kind!=='off').sort((a,b)=>a.shift_date.localeCompare(b.shift_date)).map(s=>{
    const x=effectiveHours(s),actual=x.source==='actual',start=actual?s.actual_start??s.planned_start:s.planned_start,end=actual?s.actual_end??s.planned_end:s.planned_end,legacyNightTotal=s.kind==='night'&&Math.abs(x.rate-settings.day_rate)>0.0001,baseRate=legacyNightTotal?Math.max(0,x.rate-settings.night_shift_allowance):x.rate,ordinary=Math.max(0,Math.min(x.hours,settings.overtime_threshold-used)),overtime=x.hours-ordinary,basePay=roundMoney(x.hours*baseRate),nightAllowance=roundMoney(s.kind==='night'?x.hours*settings.night_shift_allowance:0),weekendEligibleHours=calculateWeekendEligibleHours(start,end,settings.weekend_allowance_effective_from,x.hours),weekendAllowance=calculateWeekendAllowance(weekendEligibleHours,settings.weekend_allowance),premiumFactor=settings.overtime_multiplier-1,enhancedPayment=roundMoney(overtime*baseRate*premiumFactor),bankableHours=overtime*premiumFactor;used+=x.hours;
    return {shiftId:s.id,kind:s.kind,ordinary,overtime,rate:baseRate,basePay,nightAllowance,weekendEligibleHours,weekendAllowance,enhancedPayment,bankableHours,overtimeTreatment,gross:roundMoney(basePay+nightAllowance+weekendAllowance+(overtimeTreatment==='pay'?enhancedPayment:0)),source:x.source};
  });
}
export const totals=(rows:RatedHours[])=>rows.reduce((a,r)=>({ordinary:a.ordinary+r.ordinary,overtime:a.overtime+r.overtime,basePay:roundMoney(a.basePay+r.basePay),nightAllowance:roundMoney(a.nightAllowance+r.nightAllowance),weekendEligibleHours:a.weekendEligibleHours+r.weekendEligibleHours,weekendAllowance:roundMoney(a.weekendAllowance+r.weekendAllowance),enhancedPayment:roundMoney(a.enhancedPayment+(r.overtimeTreatment==='pay'?r.enhancedPayment:0)),bankableHours:a.bankableHours+(r.overtimeTreatment==='bank'?r.bankableHours:0),gross:roundMoney(a.gross+r.gross)}),{ordinary:0,overtime:0,basePay:0,nightAllowance:0,weekendEligibleHours:0,weekendAllowance:0,enhancedPayment:0,bankableHours:0,gross:0});
export const kiwiSaver=(gross:number,rate:number)=>Math.round(gross*rate)/100;

export function groupByWorkWeek(shifts:Shift[],weekStartsOn:number):Map<string,Shift[]> {
  const groups=new Map<string,Shift[]>();
  for(const shift of shifts){const key=toIsoDate(startOfWorkWeek(fromIsoDate(shift.shift_date),weekStartsOn));groups.set(key,[...(groups.get(key)??[]),shift])}
  return groups;
}
export function calculateAllWeeks(shifts:Shift[],settings:Settings):RatedHours[]{return [...groupByWorkWeek(shifts,0).values()].flatMap(week=>calculateWeek(week,settings))}
export function breakdown(rows:RatedHours[]){return rows.reduce((a,r)=>{const night=r.kind==='night';if(night){a.nightOrdinary+=r.ordinary;a.nightOvertime+=r.overtime}else{a.dayOrdinary+=r.ordinary;a.dayOvertime+=r.overtime}a.gross+=r.gross;return a},{dayOrdinary:0,nightOrdinary:0,dayOvertime:0,nightOvertime:0,gross:0})}
