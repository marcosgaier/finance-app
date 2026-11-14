import React from 'react';
import type {Shift} from '../vendor/taura/types';
import {formatDate} from '../vendor/taura/lib/dates';
import styles from '../work-demo.module.css';
import {protectedShift} from '../editor/shiftDraft';

export const kindLabels:Record<Shift['kind'],string>={day:'Diurno',night:'Nocturno',off:'Libre',annual_leave:'Licencia anual',sick_leave:'Licencia por enfermedad',custom:'Personalizado'};
export const statusLabels:Record<Shift['status'],string>={planned:'Planificado',worked:'Trabajado',modified:'Modificado',cancelled:'Cancelado',paid_leave:'Licencia paga',unpaid_leave:'Licencia sin pago',payslip:'Recibo ficticio',confirmed:'Confirmado ficticio'};
export function DayDetails({date,shifts,onClose,onAdd,onEdit,onAction}:{date:string;shifts:readonly Readonly<Shift>[];onClose:()=>void;onAdd?:()=>void;onEdit?:(shift:Readonly<Shift>)=>void;onAction?:(id:string,action:'cancel'|'duplicate'|'delete')=>void}) {
  return <section className={styles.card} aria-labelledby="day-detail-title">
    <h3 id="day-detail-title" tabIndex={-1}>Detalle del ejemplo · {formatDate(date,{dateStyle:'full'})}</h3>
    {shifts.length?shifts.map(s=><article key={s.id} data-shift-id={s.id}>
      <h4>{kindLabels[s.kind]}</h4>
      <p>{statusLabels[s.status]} · estado ficticio · {s.planned_paid_hours} h planificadas
        {s.actual_paid_hours!=null?` · ${s.actual_paid_hours} h trabajadas del ejemplo`:''}</p>
      {s.planned_start&&s.planned_end?<p>Inicio {s.planned_start.replace('T',' ')} · Fin {s.planned_end.replace('T',' ')}</p>:null}
      {protectedShift(s)?<p>Dato ficticio con recibo/confirmado: protegido, solo consulta. No se puede editar, duplicar, cancelar ni eliminar.</p>:<div className={styles.controls}>
        {onEdit?<button type="button" onClick={()=>onEdit(s)}>Editar un turno</button>:null}
        {onAction?<><button type="button" onClick={()=>onAction(s.id,'duplicate')}>Duplicar turno</button>
          <button type="button" disabled={s.status==='cancelled'} onClick={()=>onAction(s.id,'cancel')}>Cancelar turno</button>
          <button type="button" onClick={()=>onAction(s.id,'delete')}>Eliminar turno ficticio</button></>:null}
      </div>}
    </article>):<p>Sin turnos en este ejemplo.</p>}
    {onAdd?<button type="button" onClick={onAdd}>Agregar turno</button>:null}
    <button type="button" onClick={onClose}>Cerrar detalle</button>
  </section>;
}
