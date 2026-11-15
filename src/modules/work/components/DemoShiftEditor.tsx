import React, {useLayoutEffect, useRef, useState} from 'react';
import type {Shift,ShiftKind} from '../vendor/taura/types';
import {quickDraft,quickLabels,type QuickKind} from '../editor/batchPlan';
import {settings} from '../demo/fixtures';
import {newDraft,validateDraft,hasActualData,canMarkWorked,markWorkedDraft,calculateDraftHours} from '../editor/shiftDraft';
import {ShiftComparison} from './ShiftComparison';
import {kindLabels,statusLabels} from './DayDetails';
import styles from '../work-demo.module.css';

export function DemoShiftEditor({initial,editing,onSave,onClose}:{initial:Shift;editing:boolean;onSave:(shift:Shift)=>void;onClose:()=>void}) {
  const [value,setValue]=useState(()=>structuredClone(initial)),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const origin=document.activeElement as HTMLElement|null;
    const modal=dialog.current!;modal.showModal();modal.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
    return ()=>{modal.close();origin?.focus({preventScroll:true});};
  },[]);
  function patch<K extends keyof Shift>(key:K,next:Shift[K]){setValue(current=>({...current,[key]:next}));setError('');}
  function transform(action:(shift:Shift)=>Shift){
    try{setValue(action(value));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Horario inválido.');}
  }
  const actualPresent=hasActualData(value);
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
    <p id="demo-editor-help">DEMOSTRACIÓN · solo memoria · máximo 12 h. No edita pagos confirmados.</p>
    <div className={styles.editorTemplates} aria-label="Plantillas rápidas del turno">{(Object.keys(quickLabels) as QuickKind[]).map(kind=><button key={kind} type="button" disabled={actualPresent} data-kind={kind} aria-label={quickLabels[kind]} aria-pressed={value.kind===kind} onClick={()=>{
      try{setValue({...value,...quickDraft(value.shift_date,value.id,kind,settings),created_at:value.created_at});setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Fecha inválida.');}
    }}><span>{kind==='day'?'☀ Día':kind==='night'?'☾ Noche':'⌂ Libre'}</span><small>{kind==='day'?'06–18':kind==='night'?'18–06 (+1 día)':'0 h'}</small></button>)}</div>
    <form onSubmit={submit} noValidate>
      <div className={styles.editorGrid}>
        <label>Fecha del turno ficticio<input autoFocus type="date" value={value.shift_date} onChange={e=>patch('shift_date',e.target.value)}/></label>
        <label>Tipo de turno ficticio<select disabled={actualPresent} aria-label="Tipo de turno ficticio" value={value.kind} onChange={e=>{
          try{setValue({...value,...newDraft(value.shift_date,value.id,e.target.value as ShiftKind),created_at:value.created_at});setError('');}
          catch{setError('Indicá primero una fecha válida.');}
        }}>{Object.entries(kindLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Estado ficticio<select aria-label="Estado ficticio" value={value.status} onChange={e=>patch('status',e.target.value as Shift['status'])}>{statuses.map(key=><option key={key} value={key}>{statusLabels[key as Shift['status']]}</option>)}</select></label>
      </div>
      <p className={styles.editorHint}>{actualPresent?'Tipo y plantillas bloqueados para preservar los datos reales.':'Tipo/plantilla restablece horario y horas.'} Horarios Pacific/Auckland; noche termina al día siguiente. Cambios efectivos solo al guardar.</p>
      {canMarkWorked(value)?<button type="button" onClick={()=>transform(markWorkedDraft)}>Marcar como trabajado</button>:null}
      {value.kind!=='off'?<>
        <fieldset><legend>Datos planificados del ejemplo</legend><div className={styles.editorGrid}>
          <label>Inicio planificado<input type="datetime-local" value={value.planned_start??''} onChange={e=>patch('planned_start',e.target.value||null)}/></label>
          <label>Fin planificado<input type="datetime-local" value={value.planned_end??''} onChange={e=>patch('planned_end',e.target.value||null)}/></label>
          {numeric('planned_paid_hours','Horas planificadas')}
        </div><button type="button" onClick={()=>transform(s=>calculateDraftHours(s))}>Calcular horas desde el horario</button><details className={styles.editorSecondary}><summary>Descanso, tarifa y notas · {value.planned_unpaid_break} h · {value.planned_rate} NZD/h</summary><div className={styles.editorGrid}>{numeric('planned_unpaid_break','Descanso planificado (h)')}{numeric('planned_rate','Tarifa ficticia planificada (NZD/h)')}</div><label className={styles.editorNotes}>Notas planificadas<textarea aria-label="Notas planificadas" rows={2} value={value.notes??''} onChange={e=>patch('notes',e.target.value)}/></label></details></fieldset>
        <details><summary>Datos trabajados opcionales del ejemplo</summary><p>Solo «Trabajado» o «Modificado» usa las horas trabajadas si se informaron. No confirma un cobro ni un recibo.</p><div className={styles.editorGrid}>
          <label>Inicio trabajado ficticio<input type="datetime-local" value={value.actual_start??''} onChange={e=>patch('actual_start',e.target.value||null)}/></label>
          <label>Fin trabajado ficticio<input type="datetime-local" value={value.actual_end??''} onChange={e=>patch('actual_end',e.target.value||null)}/></label>
          {numeric('actual_paid_hours','Horas trabajadas ficticias',true)}{numeric('actual_unpaid_break','Descanso trabajado ficticio (h)',true)}{numeric('actual_rate','Tarifa ficticia trabajada (NZD/h)',true)}
        </div><button type="button" onClick={()=>transform(s=>calculateDraftHours(s,true))}>Calcular horas desde el horario trabajado</button><label className={styles.editorNotes}>Notas reales<textarea aria-label="Notas reales" rows={2} value={value.actual_notes??''} onChange={e=>patch('actual_notes',e.target.value)}/></label></details>
      </>:<p>Día libre: sin horario ni horas pagadas.</p>}
      {value.kind==='off'?<details><summary>Notas del día libre</summary><label className={styles.editorNotes}>Notas planificadas<textarea aria-label="Notas planificadas" rows={2} value={value.notes??''} onChange={e=>patch('notes',e.target.value)}/></label></details>:null}
      <ShiftComparison shift={value}/>
      {error?<p role="alert" className={styles.editorError}>{error}</p>:null}
      <div className={styles.editorActions}><button type="submit">Guardar solo en la demo</button><button type="button" onClick={onClose}>Cerrar sin guardar</button></div>
    </form>
  </dialog>;
}
