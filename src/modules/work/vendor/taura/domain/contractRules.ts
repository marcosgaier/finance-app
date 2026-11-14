import type {OvertimePreference,OvertimeTreatment,RatedHours,Settings,Shift} from '../types';
import {addDays,fromIsoDate,startOfWorkWeek,toIsoDate} from '../lib/dates';
import {calculateWeek} from '../lib/payroll';

export const CONTRACTED_ORDINARY_HOURS=36;
export const OVERTIME_THRESHOLD_HOURS=40;
export const MAX_SHIFT_HOURS=12;
export const OVERTIME_WEEK_STARTS_ON=0;
export const PAYROLL_WEEK_STARTS_ON=0;
export const DEFAULT_OVERTIME_TREATMENT:OvertimeTreatment='pay';

export const getOvertimeWeekStart=(date:Date|string)=>startOfWorkWeek(typeof date==='string'?fromIsoDate(date):date,OVERTIME_WEEK_STARTS_ON);
export const getOvertimeWeekEnd=(weekStart:Date|string)=>addDays(typeof weekStart==='string'?fromIsoDate(weekStart):weekStart,6);

export function groupShiftsByOvertimeWeek(shifts:Shift[]){
  const groups=new Map<string,Shift[]>();
  for(const shift of shifts){const key=toIsoDate(getOvertimeWeekStart(shift.shift_date));groups.set(key,[...(groups.get(key)??[]),shift])}
  return groups;
}

const CONFIRMED_BASE_RATE_START='2026-08-02',provisionalDayRates=new Set([31.83,32.7849]),legacyDerivedNightRates=new Set([36.83,37.78]);
function normalizeKnownRate(shift:Shift,settings:Settings):Shift{
  if(shift.shift_date<CONFIRMED_BASE_RATE_START)return shift;
  const normalize=(rate:number|null)=>rate!=null&&(provisionalDayRates.has(rate)||(shift.kind==='night'&&legacyDerivedNightRates.has(rate)))?settings.day_rate:rate;
  const plannedRate=normalize(shift.planned_rate)??shift.planned_rate,actualRate=normalize(shift.actual_rate);
  return plannedRate===shift.planned_rate&&actualRate===shift.actual_rate?shift:{...shift,planned_rate:plannedRate,actual_rate:actualRate};
}

export function calculateContractOvertime(shifts:Shift[],settings:Settings,preferences:OvertimePreference[]=[]){
  const preferenceByWeek=new Map(preferences.map(item=>[item.weekStart,item.overtimeTreatment]));
  const rows=new Map<string,RatedHours>();
  for(const[weekStart,weekShifts]of groupShiftsByOvertimeWeek(shifts.map(shift=>normalizeKnownRate(shift,settings)))){
    const legacyMondayKey=toIsoDate(addDays(fromIsoDate(weekStart),1)),treatment=preferenceByWeek.get(weekStart)??preferenceByWeek.get(legacyMondayKey)??DEFAULT_OVERTIME_TREATMENT;
    for(const row of calculateWeek(weekShifts,{...settings,overtime_threshold:OVERTIME_THRESHOLD_HOURS},treatment))rows.set(row.shiftId,row);
  }
  return rows;
}
