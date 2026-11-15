import React from 'react';
import type {Shift} from '../vendor/taura/types';
import styles from '../work-demo.module.css';

const hours=(value:number)=>Number.isFinite(value)?new Intl.NumberFormat('es-NZ',{maximumFractionDigits:4}).format(value):'sin dato';
export function ShiftComparison({shift}:{shift:Readonly<Shift>}) {
  const actual=shift.actual_paid_hours,delta=actual===null?null:actual-shift.planned_paid_hours;
  return <div className={styles.shiftComparison} aria-label="Comparación de horas" aria-live="polite">
    <span>Planificadas <b>{hours(shift.planned_paid_hours)} h</b></span>
    <span>Trabajadas <b>{actual===null?'Sin horas reales':`${hours(actual)} h`}</b></span>
    <span>Diferencia <b>{delta===null?'Pendiente':`${delta>0?'+':''}${hours(delta)} h`}</b></span>
  </div>;
}
