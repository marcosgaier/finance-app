import type {Settings, Shift, OvertimePreference} from '../vendor/taura/types';
import {fromIsoDate, toIsoDate} from '../vendor/taura/lib/dates';

export const referenceDay = '2026-09-24';
export const settings: Settings = {
  day_rate: 30, night_shift_allowance: 3, weekend_allowance: 4,
  weekend_allowance_effective_from: '2026-04-01', kiwisaver_rate: 3,
  overtime_threshold: 40, overtime_multiplier: 1.5, week_starts_on: 0,
  payday: 3, pay_lag_days: 3, tax_code: 'M', student_loan: false,
  onboarding_complete: true, day_shift_hours: 12, night_shift_hours: 12,
  default_unpaid_break: 0, day_shift_start: '07:00', day_shift_end: '19:00',
  night_shift_start: '19:00', night_shift_end: '07:00', settings_version: 1,
};
export const shifts: Shift[] = Array.from({length: 7}, (_,i): Shift => {
  const day = `2026-09-${String(20+i).padStart(2,'0')}`;
  const off = i % 7 >= 5;
  const night = i % 7 === 3;
  return {id:`demo-${i}`, shift_date:day, kind:off?'off':night?'night':'day',
    status:i<3?'worked':'planned', planned_start:off?null:`${day}T${night?'19':'07'}:00:00`,
    planned_end:off?null:night?`2026-09-${String(21+i).padStart(2,'0')}T07:00:00`:`${day}T19:00:00`,
    planned_paid_hours:off?0:12, planned_unpaid_break:0, planned_rate:30,
    actual_start:null, actual_end:null, actual_paid_hours:i<3?12:null,
    actual_unpaid_break:null, actual_rate:null};
}).filter(s => s.shift_date <= '2026-09-30');
export const overtimePreferences: OvertimePreference[] = [
  {id:'demo-bank',weekStart:'2026-09-20',overtimeTreatment:'bank',updatedAt:'2026-09-20T00:00:00Z'},
];
export function validateDemo(input = shifts, day = referenceDay) {
  if (day !== referenceDay || toIsoDate(fromIsoDate(day)) !== day) throw Error('Invalid demo date');
  const ids = new Set();
  for (const s of input) {
    if(ids.has(s.id) || toIsoDate(fromIsoDate(s.shift_date)) !== s.shift_date ||
      s.shift_date < '2026-04-01' || s.shift_date > '2027-03-31' ||
      !Number.isFinite(s.planned_paid_hours) || s.planned_paid_hours < 0 ||
      !Number.isFinite(s.planned_rate) || s.planned_rate < 0 ||
      (s.planned_start && s.planned_end && new Date(s.planned_end) <= new Date(s.planned_start))) throw Error('Invalid synthetic shift');
    ids.add(s.id);
  }
  return {shifts:input,settings,overtimePreferences,referenceDate:fromIsoDate(day)};
}
