import type {Shift, ShiftKind} from '../vendor/taura/types';
import {hoursBetween} from '../vendor/taura/lib/payroll';
import {validateDemo} from './fixtures';

export const editableStatuses = ['planned','worked','modified','paid_leave','unpaid_leave','cancelled'] as const;
export const locked = (shift:Readonly<Shift>) => ['payslip','confirmed'].includes(shift.status);
export const copyExample = ():Shift[] => structuredClone(validateDemo().shifts);
export const newId = () => `demo-${globalThis.crypto.randomUUID()}`;
export function civilDate(value:string) {
  if(!/^\d{4}-\d\d-\d\d$/.test(value)) throw Error('Fecha civil inválida.');
  const d=new Date(`${value}T12:00:00`);
  if(!Number.isFinite(d.getTime()) || localDay(d)!==value) throw Error('Fecha civil inválida.');
  if(value<'2026-04-01'||value>'2027-03-31') throw Error('Usá una fecha del año fiscal del ejemplo (abril 2026 a marzo 2027).');
}
const pad=(n:number)=>String(n).padStart(2,'0');
const localDay=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function timestamp(value:string) {
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::00)?$/.test(value)) throw Error('Horario inválido. Usá horas y minutos.');
  const d=new Date(value);
  if(!Number.isFinite(d.getTime())||`${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`!==value.slice(0,16))
    throw Error('Horario civil inexistente o inválido (incluido cambio de hora).');
  // Ambiguous fall-back times are deliberately blocked, rather than guessing an offset.
  for(const delta of [-3600000,3600000]) {
    const other=new Date(d.getTime()+delta);
    if(localDay(other)===localDay(d)&&other.getHours()===d.getHours()&&other.getMinutes()===d.getMinutes())
      throw Error('Horario ambiguo por cambio de hora; elegí otro horario para el ejemplo.');
  }
  return value.length===16?`${value}:00`:value;
}
function number(value:unknown,label:string,max=Infinity) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max) throw Error(`${label}: cantidad inválida.`);
}
export function validateShift(input:Shift):Shift {
  const s=structuredClone(input);
  civilDate(s.shift_date);
  if(!s.id.startsWith('demo-')||!['day','night','off','annual_leave','sick_leave','custom'].includes(s.kind)||!editableStatuses.includes(s.status as typeof editableStatuses[number]))
    throw Error('Tipo o estado no editable. Los recibos y confirmados están protegidos.');
  for(const [value,label,max] of [[s.planned_paid_hours,'Horas planificadas',12],[s.planned_unpaid_break,'Pausa planificada',12],[s.planned_rate,'Tarifa ficticia',Infinity]] as const) number(value,label,max);
  for(const [value,label,max] of [[s.actual_paid_hours,'Horas trabajadas del ejemplo',12],[s.actual_unpaid_break,'Pausa trabajada',12],[s.actual_rate,'Tarifa trabajada ficticia',Infinity]] as const) if(value!==null)number(value,label,max);
  for(const actual of [false,true]) {
    const a=actual?s.actual_start:s.planned_start,b=actual?s.actual_end:s.planned_end;
    if((a===null)!==(b===null))throw Error('Completá inicio y fin juntos.');
    if(a!==null&&b!==null) {
      const start=timestamp(a),end=timestamp(b);
      if(start.slice(0,10)!==s.shift_date)throw Error('El inicio debe coincidir con la fecha del turno.');
      const duration=(new Date(end).getTime()-new Date(start).getTime())/3600000;
      if(duration<=0||duration>24)throw Error('Fin posterior al inicio, dentro de 24 horas. Indicá el día siguiente para nocturnos.');
      const paid=hoursBetween(start,end,actual?s.actual_unpaid_break??0:s.planned_unpaid_break);
      number(paid,'Máximo contractual: 12 horas pagadas',12);
      if(actual) {s.actual_start=start;s.actual_end=end;s.actual_paid_hours=paid;}
      else {s.planned_start=start;s.planned_end=end;s.planned_paid_hours=paid;}
    } else if(!actual&&s.kind!=='off') throw Error('Completá el horario planificado del ejemplo.');
  }
  if(s.kind==='off'&&(s.planned_paid_hours!==0||s.actual_paid_hours!==null&&s.actual_paid_hours!==0||s.planned_start!==null||s.actual_start!==null||s.planned_unpaid_break!==0))
    throw Error('Un día libre debe tener cero horas y no tener horarios.');
  if(s.kind!=='off'&&s.planned_paid_hours===0)throw Error('El turno debe tener horas pagadas mayores que cero.');
  return s;
}
export function template(date:string,kind:ShiftKind='day'):Shift {
  civilDate(date);
  const end=new Date(`${date}T12:00:00`);end.setDate(end.getDate()+1);
  const off=kind==='off',night=kind==='night';
  return {id:newId(),shift_date:date,kind,status:'planned',planned_start:off?null:`${date}T${night?'19':'07'}:00:00`,planned_end:off?null:`${night?localDay(end):date}T${night?'07':'19'}:00:00`,planned_paid_hours:off?0:12,planned_unpaid_break:0,planned_rate:30,actual_start:null,actual_end:null,actual_paid_hours:null,actual_unpaid_break:null,actual_rate:null,created_at:new Date().toISOString()};
}
export type Action = {type:'save';shift:Shift}|{type:'duplicate'|'cancel'|'delete';id:string};
export function changeExample(current:readonly Shift[],action:Action):Shift[] {
  const id=action.type==='save'?action.shift.id:action.id;
  const original=current.find(s=>s.id===id);
  if(original&&locked(original))throw Error('Recibo/confirmado ficticio protegido: no se puede modificar, duplicar, cancelar ni eliminar.');
  if(action.type==='save') {
    const next=validateShift(original?{...structuredClone(original),...action.shift,id:original.id,created_at:original.created_at}:action.shift);
    return original?current.map(s=>s.id===id?next:s):[...current,next];
  }
  if(!original)throw Error('Turno ficticio no encontrado.');
  if(action.type==='delete')return current.filter(s=>s.id!==id);
  if(action.type==='cancel')return current.map(s=>s.id===id?{...s,status:'cancelled'}:s);
  const duplicate={...structuredClone(original),id:newId(),status:'planned' as const,actual_start:null,actual_end:null,actual_paid_hours:null,actual_unpaid_break:null,actual_rate:null,actual_notes:undefined,created_at:new Date().toISOString(),updated_at:undefined};
  return [...current,validateShift(duplicate)];
}
