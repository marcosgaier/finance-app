import type {Settings, Shift, OvertimePreference} from '../vendor/taura/types';
import {fromIsoDate, toIsoDate} from '../vendor/taura/lib/dates';

// Protect the compiled example at runtime without changing the vendored engine's signatures.
function freeze<T>(value:T):T {
  if(value && typeof value==='object') {
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}

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
freeze(settings);freeze(shifts);freeze(overtimePreferences);
export function validateDemo(input = shifts, day = referenceDay, config = settings, preferences = overtimePreferences) {
  if (day !== referenceDay || toIsoDate(fromIsoDate(day)) !== day) throw Error('Invalid demo date');
  const ids = new Set();
  for (const s of input) {
    if(!s.id.startsWith('demo-') || ids.has(s.id) || toIsoDate(fromIsoDate(s.shift_date)) !== s.shift_date ||
      !['day','night','off','annual_leave','sick_leave','custom'].includes(s.kind) ||
      !['planned','worked','modified','cancelled','paid_leave','unpaid_leave','payslip','confirmed'].includes(s.status) ||
      s.shift_date < '2026-04-01' || s.shift_date > '2027-03-31' ||
      !Number.isFinite(s.planned_paid_hours) || s.planned_paid_hours < 0 ||
      !Number.isFinite(s.planned_rate) || s.planned_rate < 0 ||
      (s.planned_start && s.planned_end && new Date(s.planned_end) <= new Date(s.planned_start))) throw Error('Invalid synthetic shift');
    ids.add(s.id);
    for(const value of [s.planned_unpaid_break,s.actual_paid_hours,s.actual_unpaid_break,s.actual_rate])
      if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('Invalid synthetic numeric value');
    for(const [a,b] of [[s.planned_start,s.planned_end],[s.actual_start,s.actual_end]]) {
      if((a===null)!==(b===null))throw Error('Incomplete synthetic times');
      if(a&&b&&(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(a)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(b)||
        !Number.isFinite(new Date(a).getTime())||!Number.isFinite(new Date(b).getTime())||
        toIsoDate(new Date(a))!==s.shift_date||new Date(b)<=new Date(a)||
        new Date(b).getTime()-new Date(a).getTime()>86_400_000))throw Error('Invalid synthetic times');
    }
  }
  for(const value of Object.values(config))if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw Error('Invalid synthetic settings');
  if(config.week_starts_on>6||config.payday>6||!Number.isInteger(config.payday)||
    toIsoDate(fromIsoDate(config.weekend_allowance_effective_from))!==config.weekend_allowance_effective_from)throw Error('Invalid synthetic settings date');
  for(const p of preferences)if(!p.id.startsWith('demo-')||!['bank','pay'].includes(p.overtimeTreatment)||
    toIsoDate(fromIsoDate(p.weekStart))!==p.weekStart||fromIsoDate(p.weekStart).getDay()!==0||
    !Number.isFinite(new Date(p.updatedAt).getTime()))throw Error('Invalid synthetic preference');
  // A fresh protected snapshot keeps callers from mutating either the source or another view.
  return freeze({shifts:input.map(s=>({...s})),settings:{...config},overtimePreferences:preferences.map(p=>({...p})),referenceDate:fromIsoDate(day)});
}
