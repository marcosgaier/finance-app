import React from 'react';
import type {Shift} from '../vendor/taura/types';
import {locked, type Action} from '../demo/editor';
import {formatDate} from '../vendor/taura/lib/dates';
import styles from '../work-demo.module.css';

export const kindLabels:Record<Shift['kind'],string>={day:'Diurno',night:'Nocturno',off:'Libre',annual_leave:'Licencia anual',sick_leave:'Licencia por enfermedad',custom:'Personalizado'};
export const statusLabels:Record<Shift['status'],string>={planned:'Planificado',worked:'Trabajado',modified:'Modificado',cancelled:'Cancelado',paid_leave:'Licencia paga',unpaid_leave:'Licencia sin pago',payslip:'Recibo ficticio',confirmed:'Confirmado ficticio'};
export function DayDetails({date,shifts,onClose,onAdd,onEdit,onAction}:{date:string;shifts:readonly Readonly<Shift>[];onClose:()=>void;onAdd?:()=>void;onEdit?:(s:Readonly<Shift>)=>void;onAction?:(action:Action)=>void}) {
  return <section className={styles.card} aria-labelledby="day-detail-title">
    <h3 id="day-detail-title" tabIndex={-1}>Detalle del ejemplo · {formatDate(date,{dateStyle:'full'})}</h3>
    {onAdd?<button type="button" disabled={date<'2026-04-01'||date>'2027-03-31'} onClick={onAdd}>Agregar turno ficticio</button>:null}
    {shifts.length?shifts.map(s=><article key={s.id} data-shift-id={s.id}>
      <h4>{kindLabels[s.kind]}</h4>
      <p>{statusLabels[s.status]} · estado ficticio · {s.planned_paid_hours} h planificadas
        {s.actual_paid_hours!=null?` · ${s.actual_paid_hours} h trabajadas del ejemplo`:''}</p>
      {s.planned_start&&s.planned_end?<p>Inicio {s.planned_start.replace('T',' ')} · Fin {s.planned_end.replace('T',' ')}</p>:null}
      {locked(s)?<p>Recibo/confirmado ficticio protegido. No se puede editar, duplicar, cancelar ni eliminar.</p>:null}
      {onAction?<div className={styles.shiftActions}>
        <button type="button" disabled={locked(s)} onClick={()=>onEdit?.(s)}>Editar turno ficticio</button>
        <button type="button" disabled={locked(s)} onClick={()=>onAction({type:'duplicate',id:s.id})}>Duplicar turno ficticio</button>
        <button type="button" disabled={locked(s)||s.status==='cancelled'} onClick={()=>onAction({type:'cancel',id:s.id})}>Cancelar turno ficticio</button>
        <button type="button" disabled={locked(s)} onClick={()=>{if(window.confirm('¿Eliminar este turno ficticio? No se puede deshacer dentro de esta demo. Los otros turnos no cambian.')){onAction({type:'delete',id:s.id});requestAnimationFrame(()=>document.getElementById('day-detail-title')?.focus());}}}>Eliminar turno ficticio</button>
      </div>:null}
    </article>):<p>Sin turnos en este ejemplo.</p>}
    <button type="button" onClick={onClose}>Cerrar detalle</button>
  </section>;
}
