import type {Shift} from '../types';
import {addDays,fromIsoDate,startOfWorkWeek,toIsoDate} from '../lib/dates';
import {getOvertimeWeekEnd,getOvertimeWeekStart} from './contractRules';

export const ROSTER_WEEK_STARTS_ON=0;

export const getRosterWeekStart=(date:Date|string)=>startOfWorkWeek(typeof date==='string'?fromIsoDate(date):date,ROSTER_WEEK_STARTS_ON);
export const getRosterWeekEnd=(date:Date|string)=>addDays(getRosterWeekStart(date),6);
export const getRosterWeekDates=(date:Date|string)=>{const start=getRosterWeekStart(date);return Array.from({length:7},(_,index)=>addDays(start,index))};
export const moveRosterWeek=(date:Date|string,amount:number)=>addDays(getRosterWeekStart(date),amount*7);

export function getContractSummaryWeekForRosterWeek(rosterWeek:Date|string){
  const rosterStart=getRosterWeekStart(rosterWeek),contractStart=getOvertimeWeekStart(rosterStart);
  return {startsOn:contractStart,endsOn:getOvertimeWeekEnd(contractStart)};
}

export function getShiftsInRosterWeek(shifts:Shift[],week:Date|string){
  const startsOn=toIsoDate(getRosterWeekStart(week)),endsOn=toIsoDate(getRosterWeekEnd(week));
  return shifts.filter(shift=>shift.shift_date>=startsOn&&shift.shift_date<=endsOn);
}

export function planRosterWeekCopy(shifts:Shift[],sourceWeek:Date|string,targetWeek:Date|string){
  const sourceStart=getRosterWeekStart(sourceWeek),targetStart=getRosterWeekStart(targetWeek);
  return getShiftsInRosterWeek(shifts,sourceStart).map(shift=>({shift,targetDate:toIsoDate(addDays(targetStart,Math.round((fromIsoDate(shift.shift_date).getTime()-sourceStart.getTime())/86_400_000)))}));
}
