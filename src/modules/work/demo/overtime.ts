import type {OvertimePreference,OvertimeTreatment,PayPeriodProjection,Settings,Shift} from '../vendor/taura/types';
import {buildPayProjections} from '../vendor/taura/domain/payPeriods';

export function canChangeOvertime(period:PayPeriodProjection,weekStart:string) {
  return period.status!=='paid' && period.overtimeWeeks.some(week=>week.weekStart===weekStart&&week.overtimeHours>0) &&
    !period.shifts.some(shift=>['confirmed','payslip','paid'].includes(shift.status));
}

// Session-only immutable update. Recheck current records rather than trusting UI.
export function changeOvertime(preferences:OvertimePreference[],shifts:Shift[],settings:Settings,referenceDate:Date,weekStart:string,treatment:OvertimeTreatment):OvertimePreference[] {
  if(!['pay','bank'].includes(treatment))return preferences;
  const periods=buildPayProjections(shifts,settings,referenceDate,4,preferences);
  const affected=periods.filter(period=>period.overtimeWeeks.some(week=>week.weekStart===weekStart));
  if(!affected.length||affected.some(period=>!canChangeOvertime(period,weekStart)))return preferences;
  if(affected.every(period=>period.overtimeWeeks.filter(week=>week.weekStart===weekStart).every(week=>week.overtimeTreatment===treatment)))return preferences;
  const existing=preferences.find(item=>item.weekStart===weekStart);
  const next={...existing,id:existing?.id??`demo-overtime-${weekStart}`,weekStart,overtimeTreatment:treatment,updatedAt:referenceDate.toISOString()};
  return [...preferences.filter(item=>item.weekStart!==weekStart),next];
}
