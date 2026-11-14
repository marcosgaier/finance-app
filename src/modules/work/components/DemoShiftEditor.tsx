import React, {useLayoutEffect, useRef, useState} from 'react';
import type {Shift,ShiftKind} from '../vendor/taura/types';
import {newDraft,validateDraft} from '../editor/shiftDraft';
import {kindLabels,statusLabels} from './DayDetails';
import styles from '../work-demo.module.css';

export function DemoShiftEditor({initial,editing,onSave,onClose}:{initial:Shift;editing:boolean;onSave:(shift:Shift)=>void;onClose:()=>void}) {
  const [value,setValue]=useState(()=>structuredClone(initial)),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const origin=document.activeElement as HTMLElement|null;
    const modal=dialog.current!;modal.showModal();
    return ()=>{modal.close();origin?.focus({preventScroll:true});};
  },[]);
  function patch<K extends keyof Shift>(key:K,next:Shift[K]){setValue(current=>({...current,[key]:next}));setError('');}
  const numeric=(key:'planned_paid_hours'|'planned_unpaid_break'|'planned_rate'|'actual_paid_hours'|'actual_unpaid_break'|'actual_rate',label:string,optional=false)=>
    <label>{label}<input type="number" step="any" min="0" value={value[key]===null?'':Number.isNaN(value[key])?'':value[key]}
      onChange={e=>patch(key,e.target.value===''?(optional?null:NaN):Number(e.target.value))}/></label>;
  function submit(event:React.FormEvent){
    event.preventDefault();
    try{onSave(validateDraft(value));onClose();}catch(reason){setError(reason instanceof Error?reason.message:'Dato ficticio inválido.');}
  }
  const statuses=value.kind==='off'?['planned','cancelled']:['annual_leave','sick_leave'].includes(value.kind)?['planned','paid_leave','unpaid_leave','cancelled']:['planned','worked','modified','cancelled'];
  return <dialog ref={dialog} className={styles.editorDialog} aria-labelledby="demo-editor-title" aria-describedby="demo-editor-help" onCancel={event=>{event.preventDefault();onClose();}}>
    <h2 id="demo-editor-title">{editing?'Editar turno ficticio':'Agregar turno ficticio'}</h2>
    <p id="demo-editor-help">MODO DEMOSTRACIÓN — solo memoria. No edita pagos confirmados. Todos los valores son ficticios; máximo 12 h por turno.</p>
    <form onSubmit={submit} noValidate>
      <div className={styles.editorGrid}>
        <label>Fecha del turno ficticio<input autoFocus type="date" value={value.shift_date} onChange={e=>patch('shift_date',e.target.value)}/></label>
        <label>Tipo de turno ficticio<select aria-label="Tipo de turno ficticio" value={value.kind} onChange={e=>{
          try{setValue({...value,...newDraft(value.shift_date,value.id,e.target.value as ShiftKind),created_at:value.created_at});setError('');}
          catch{setError('Indicá primero una fecha válida.');}
        }}>{Object.entries(kindLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Estado ficticio<select aria-label="Estado ficticio" value={value.status} onChange={e=>patch('status',e.target.value as Shift['status'])}>{statuses.map(key=><option key={key} value={key}>{statusLabels[key as Shift['status']]}</option>)}</select></label>
      </div>
      <p>Cambiar tipo restablece horario, horas y datos trabajados del borrador. Cambiar fecha requiere ajustar también inicio y fin. Un nocturno termina al día siguiente.</p>
      {value.kind!=='off'?<>
        <fieldset><legend>Datos planificados del ejemplo</legend><div className={styles.editorGrid}>
          <label>Inicio planificado<input type="datetime-local" value={value.planned_start??''} onChange={e=>patch('planned_start',e.target.value||null)}/></label>
          <label>Fin planificado<input type="datetime-local" value={value.planned_end??''} onChange={e=>patch('planned_end',e.target.value||null)}/></label>
          {numeric('planned_paid_hours','Horas planificadas')}{numeric('planned_unpaid_break','Descanso planificado (h)')}{numeric('planned_rate','Tarifa ficticia planificada (NZD/h)')}
        </div></fieldset>
        <details><summary>Datos trabajados opcionales del ejemplo</summary><p>Solo «Trabajado» o «Modificado» usa las horas trabajadas si se informaron. No confirma un cobro ni un recibo.</p><div className={styles.editorGrid}>
          <label>Inicio trabajado ficticio<input type="datetime-local" value={value.actual_start??''} onChange={e=>patch('actual_start',e.target.value||null)}/></label>
          <label>Fin trabajado ficticio<input type="datetime-local" value={value.actual_end??''} onChange={e=>patch('actual_end',e.target.value||null)}/></label>
          {numeric('actual_paid_hours','Horas trabajadas ficticias',true)}{numeric('actual_unpaid_break','Descanso trabajado ficticio (h)',true)}{numeric('actual_rate','Tarifa ficticia trabajada (NZD/h)',true)}
        </div></details>
      </>:<p>Día libre: sin horario ni horas pagadas.</p>}
      <p>Planificadas: {Number.isFinite(value.planned_paid_hours)?value.planned_paid_hours:'sin dato'} h · Trabajadas ficticias: {value.actual_paid_hours??'sin dato'} h.</p>
      {error?<p role="alert" className={styles.editorError}>{error}</p>:null}
      <div className={styles.controls}><button type="submit">Guardar solo en la demo</button><button type="button" onClick={onClose}>Cerrar sin guardar</button></div>
    </form>
  </dialog>;
}
