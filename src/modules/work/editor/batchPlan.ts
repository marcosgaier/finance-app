import type {Shift,Settings} from '../vendor/taura/types';
import {civilDay,newDraft,validateDraft,nzInstant,hasActualData} from './shiftDraft';

export type QuickKind='day'|'night'|'off';
export const quickLabels:Record<QuickKind,string>={day:'Día 06:00–18:00',night:'Noche 18:00–06:00 (+1 día)',off:'Libre 0 h'};
export function quickDraft(day:string,id:string,kind:QuickKind,settings:Readonly<Settings>):Shift {
  const draft=newDraft(day,id,kind);
  const next=new Date(civilDay(day)+86400000).toISOString().slice(0,10);
  draft.planned_start=kind==='off'?null:`${day}T${kind==='night'?'18':'06'}:00:00`;
  draft.planned_end=kind==='off'?null:`${kind==='night'?next:day}T${kind==='night'?'06':'18'}:00:00`;
  draft.planned_rate=kind==='off'?0:settings.day_rate;
  // Paid hours follow elapsed NZ time at DST, as required by the fixed engine.
  if(draft.planned_start&&draft.planned_end)draft.planned_paid_hours=(nzInstant(draft.planned_end)-nzInstant(draft.planned_start))/3600000;
  if(draft.planned_paid_hours>12)throw Error('El cambio de hora NZ produce 13 h: requiere revisión individual de horario y pausa.');
  return validateDraft(draft);
}
const snapshot=(shifts:readonly Readonly<Shift>[])=>JSON.stringify([...shifts].sort((a,b)=>a.id.localeCompare(b.id)));
type Row={date:string;action:'create'|'change'|'skip';reason:string;shift?:Shift};
export type BatchPlan=Readonly<{snapshot:string;revision:number;kind:QuickKind;settings:Readonly<Settings>;rows:readonly Readonly<Row>[]} >;
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
export function planBatch(shifts:readonly Readonly<Shift>[],dates:readonly string[],kind:QuickKind,settings:Readonly<Settings>,idFor:(date:string)=>string,revision=0):BatchPlan {
  const ids=new Set(shifts.map(s=>s.id));
  if(ids.size!==shifts.length)throw Error('Identidades duplicadas: revisá los turnos individualmente.');
  const rows:Row[]=[...new Set(dates)].sort().map(date=>{
    civilDay(date);
    const items=shifts.filter(s=>s.shift_date===date),original=items[0];
    let reason=items.length>1?'Varios turnos: requiere revisión individual.':'';
    if(!reason&&original&&original.status!=='planned')reason=`Estado ${original.status}: histórico o no planificado protegido.`;
    if(!reason&&original&&(hasActualData(original)||Object.entries(original).some(([key,value])=>/^(actual_|worked_|confirmed|paid_|payslip)/.test(key)&&value!==null&&value!==undefined&&value!=='')))reason='Contiene datos trabajados, reales o confirmados: requiere revisión individual.';
    if(reason)return {date,action:'skip',reason};
    const id=original?.id??idFor(date);
    if(!original&&ids.has(id))throw Error('Identidad nueva duplicada.');
    ids.add(id);
    let draft:Shift;
    try{draft=quickDraft(date,id,kind,settings);}catch(reason){return {date,action:'skip',reason:reason instanceof Error?reason.message:'Plantilla incompatible: revisión individual.'};}
    const shift=validateDraft(original?{...structuredClone(original),kind:draft.kind,planned_start:draft.planned_start,planned_end:draft.planned_end,planned_paid_hours:draft.planned_paid_hours,planned_unpaid_break:0,planned_rate:draft.planned_rate}:draft);
    return {date,action:original?'change':'create',reason:'',shift};
  });
  return freeze({snapshot:snapshot(shifts),revision,kind,settings:structuredClone(settings),rows});
}
export function applyBatch(shifts:readonly Readonly<Shift>[],plan:BatchPlan,revision=0):Shift[] {
  if(revision!==plan.revision||snapshot(shifts)!==plan.snapshot)throw Error('La sesión cambió. Cancelá y generá otra vista previa.');
  const expected=planBatch(shifts,plan.rows.map(r=>r.date),plan.kind,plan.settings,date=>plan.rows.find(r=>r.date===date)?.shift?.id??'');
  if(JSON.stringify(expected.rows)!==JSON.stringify(plan.rows))throw Error('Plan inválido: generá otra vista previa.');
  const next=structuredClone(shifts) as Shift[];
  for(const row of plan.rows){
    if(row.action==='skip')continue;
    if(!row.shift)throw Error('Plan incompleto.');
    const shift=validateDraft(row.shift);
    if(shift.shift_date!==row.date)throw Error('Fecha del plan inválida.');
    const index=next.findIndex(s=>s.id===shift.id);
    if(row.action==='create'){if(index!==-1)throw Error('Identidad duplicada.');next.push(shift);}
    else {if(index===-1)throw Error('Turno inexistente.');next[index]=shift;}
  }
  return next;
}
