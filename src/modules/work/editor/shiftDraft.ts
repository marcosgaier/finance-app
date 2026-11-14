import type {Shift, ShiftKind} from '../vendor/taura/types';

export const protectedShift = (shift:Readonly<Shift>) => ['payslip','confirmed','paid'].includes(shift.status);
const clone = <T,>(value:T):T => structuredClone(value);
function fail(message:string):never { throw new Error(message); }
export function civilDay(value:string):number {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return fail('Fecha civil inválida.');
  const ms=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)return fail('Fecha civil inválida.');
  return ms;
}
// NZ has +12/+13 in this example year. Reject missing/ambiguous DST wall times
// rather than silently normalizing them or inventing an offset for the user.
function nzInstant(value:string):number {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))return fail('Horario inválido.');
  civilDay(value.slice(0,10));
  const [h,m,s=0]=value.slice(11).split(':').map(Number);
  if(h>23||m>59||s>59)return fail('Horario inválido.');
  const clock=value.length===16?value+':00':value;
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const candidates=[12,13].map(offset=>Date.parse(clock+'Z')-offset*3600000)
    .filter(ms=>fmt.format(new Date(ms)).replace(' ','T')===clock);
  if(candidates.length!==1)return fail('Horario NZ inexistente o ambiguo por DST. Elegí otro horario para el ejemplo.');
  return candidates[0];
}
function numeric(value:unknown,label:string,max=Number.MAX_SAFE_INTEGER):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)fail(`${label}: importe u horas inválidos.`);
}
function interval(start:string|null,end:string|null,day:string,rest:number,hours:number) {
  if(!start||!end)fail('Inicio y fin deben estar completos.');
  if(start.slice(0,10)!==day)fail('El inicio debe coincidir con la fecha del turno.');
  const duration=(nzInstant(end)-nzInstant(start))/3600000;
  const civilDuration=(Date.parse(end+'Z')-Date.parse(start+'Z'))/3600000;
  if(civilDuration>12||duration<=0||duration>13||rest>=duration||duration-rest>12+1e-8||hours>duration-rest+1e-8)
    fail('Horario o descanso inválido: máximo contractual de 12 h pagadas por turno.');
}
export function validateDraft(shift:Shift):Shift {
  civilDay(shift.shift_date);
  if(shift.shift_date<'2026-04-01'||shift.shift_date>'2027-03-31')fail('Fecha fuera del año fiscal del ejemplo 2026–27.');
  if(!shift.id||!shift.id.startsWith('demo-'))fail('Identidad ficticia inválida.');
  if(!['day','night','off','annual_leave','sick_leave','custom'].includes(shift.kind))fail('Tipo de turno inválido.');
  const leave=['annual_leave','sick_leave'].includes(shift.kind);
  const allowed=shift.kind==='off'?['planned','cancelled']:leave?['planned','paid_leave','unpaid_leave','cancelled']:['planned','worked','modified','cancelled'];
  if(!allowed.includes(shift.status))fail('Estado incompatible. Recibos y confirmados están protegidos.');
  numeric(shift.planned_paid_hours,'Horas planificadas',12);numeric(shift.planned_unpaid_break,'Descanso');numeric(shift.planned_rate,'Tarifa ficticia');
  for(const [key,label,max] of [['actual_paid_hours','Horas trabajadas',12],['actual_unpaid_break','Descanso trabajado',25],['actual_rate','Tarifa trabajada ficticia',Number.MAX_SAFE_INTEGER]] as const) {
    if(shift[key]!==null)numeric(shift[key],label,max);
  }
  if(shift.kind==='off') {
    if(shift.planned_start!==null||shift.planned_end!==null||shift.planned_paid_hours!==0||shift.planned_unpaid_break!==0||shift.planned_rate!==0||
      shift.actual_start!==null||shift.actual_end!==null||[shift.actual_paid_hours,shift.actual_unpaid_break,shift.actual_rate].some(v=>v!==null&&v!==0))fail('Un día libre no tiene horario ni horas pagadas.');
  } else {
    if(shift.planned_paid_hours<=0)fail('Indicá horas planificadas entre 0 y 12.');
    interval(shift.planned_start,shift.planned_end,shift.shift_date,shift.planned_unpaid_break,shift.planned_paid_hours);
    if(shift.actual_start!==null||shift.actual_end!==null)interval(shift.actual_start,shift.actual_end,shift.shift_date,shift.actual_unpaid_break??0,shift.actual_paid_hours??0);
  }
  return clone(shift);
}
export function newDraft(day:string,id:string,kind:ShiftKind='day'):Shift {
  civilDay(day);
  const end=new Date(civilDay(day)+86400000).toISOString().slice(0,10);
  const off=kind==='off',night=kind==='night';
  return {id,shift_date:day,kind,status:kind==='annual_leave'||kind==='sick_leave'?'paid_leave':'planned',
    planned_start:off?null:`${day}T${night?'19:00':'07:00'}:00`,planned_end:off?null:`${night?end:day}T${night?'07:00':'19:00'}:00`,
    planned_paid_hours:off?0:12,planned_unpaid_break:0,planned_rate:off?0:30,
    actual_start:null,actual_end:null,actual_paid_hours:null,actual_unpaid_break:null,actual_rate:null};
}
export function commitDraft(shifts:readonly Readonly<Shift>[],draft:Shift,originalId?:string):Shift[] {
  const original=originalId?shifts.find(row=>row.id===originalId):null;
  if(originalId&&!original)fail('El turno ficticio ya no existe.');
  if(original&&protectedShift(original))fail('Turno con recibo/confirmado: solo consulta en la demo.');
  const next=validateDraft(original?{...clone(original),...clone(draft),id:original.id,created_at:original.created_at}:draft);
  if(!original&&shifts.some(row=>row.id===next.id))fail('Identidad duplicada.');
  return original?shifts.map(row=>clone(row.id===original.id?next:row)): [...clone(shifts),next];
}
export function actOnShift(shifts:readonly Readonly<Shift>[],id:string,action:'cancel'|'duplicate'|'delete',newId?:string,confirmed=false):Shift[] {
  const target=shifts.find(row=>row.id===id);
  if(!target||protectedShift(target))fail('Turno inexistente o protegido: solo consulta.');
  if(action==='delete') {
    if(!confirmed)fail('Confirmá eliminar el turno ficticio.');
    return shifts.filter(row=>row.id!==id).map(row=>clone(row));
  }
  if(action==='cancel')return shifts.map(row=>clone(row.id===id?{...row,status:'cancelled' as const}:row));
  if(!newId)fail('El duplicado requiere identidad nueva.');
  // A duplicate is a new planned example, never a confirmation of work/payment.
  const copy={...clone(target),id:newId,status:'planned' as const,actual_start:null,actual_end:null,
    actual_paid_hours:null,actual_unpaid_break:null,actual_rate:null};
  delete copy.created_at;delete copy.updated_at;
  return commitDraft(shifts,copy);
}
