import React from 'react';
import type {Shift} from '../vendor/taura/types';
import {formatDate} from '../vendor/taura/lib/dates';
import styles from '../work-demo.module.css';

export const kindLabels:Record<Shift['kind'],string>={day:'Diurno',night:'Nocturno',off:'Libre',annual_leave:'Licencia anual',sick_leave:'Licencia por enfermedad',custom:'Personalizado'};
export const statusLabels:Record<Shift['status'],string>={planned:'Planificado',worked:'Trabajado',modified:'Modificado',cancelled:'Cancelado',paid_leave:'Licencia paga',unpaid_leave:'Licencia sin pago',payslip:'Recibo ficticio',confirmed:'Confirmado ficticio'};
export function DayDetails({date,shifts,onClose}:{date:string;shifts:readonly Readonly<Shift>[];onClose:()=>void}) {
  return <section className={styles.card} aria-labelledby="day-detail-title">
    <h3 id="day-detail-title" tabIndex={-1}>Detalle del ejemplo · {formatDate(date,{dateStyle:'full'})}</h3>
    {shifts.length?shifts.map(s=><article key={s.id}>
      <h4>{kindLabels[s.kind]}</h4>
      <p>{statusLabels[s.status]} · estado ficticio · {s.planned_paid_hours} h planificadas
        {s.actual_paid_hours!=null?` · ${s.actual_paid_hours} h trabajadas del ejemplo`:''}</p>
      {s.planned_start&&s.planned_end?<p>Inicio {s.planned_start.replace('T',' ')} · Fin {s.planned_end.replace('T',' ')}</p>:null}
    </article>):<p>Sin turnos en este ejemplo.</p>}
    <button type="button" onClick={onClose}>Cerrar detalle</button>
  </section>;
}
