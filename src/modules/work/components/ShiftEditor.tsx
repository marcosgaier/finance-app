import React, {useLayoutEffect, useRef, useState} from 'react';
import type {Shift} from '../vendor/taura/types';
import {editableStatuses, template, validateShift} from '../demo/editor';
import {kindLabels, statusLabels} from './DayDetails';
import styles from '../work-demo.module.css';

interface Props {initial:Shift;onSave:(shift:Shift)=>void;onClose:()=>void}
export function ShiftEditor({initial,onSave,onClose}:Props) {
  const [value,setValue]=useState(()=>structuredClone(initial));
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null), alert=useRef<HTMLParagraphElement>(null);
  useLayoutEffect(()=>{
    const node=dialog.current!;const origin=document.activeElement as HTMLElement|null;
    node.showModal();node.querySelector<HTMLInputElement>('input')?.focus();
    return ()=>{node.close();if(origin?.isConnected)origin.focus();};
  },[]);
  const update=<K extends keyof Shift>(key:K,next:Shift[K])=>setValue(v=>({...v,[key]:next}));
  function applyKind(kind:Shift['kind']) {
    try {
      const next=template(value.shift_date,kind);
      setValue(v=>({...v,kind,planned_start:next.planned_start,planned_end:next.planned_end,planned_paid_hours:next.planned_paid_hours,planned_unpaid_break:0,
        ...(kind==='off'?{actual_start:null,actual_end:null,actual_paid_hours:null,actual_unpaid_break:null,actual_rate:null}:{} )}));
    } catch(reason) {setError((reason as Error).message);}
  }
  function submit(event:React.FormEvent) {
    event.preventDefault();
    try {onSave(validateShift(value));onClose();}
    catch(reason){setError((reason as Error).message);requestAnimationFrame(()=>alert.current?.focus());}
  }
  const numeric=(key:'planned_unpaid_break'|'actual_paid_hours'|'actual_unpaid_break'|'actual_rate',label:string,optional=false)=>
    <label>{label}<input type="number" min="0" step="any" required={!optional} value={value[key]??''} onChange={e=>update(key,e.target.value===''?(optional?null:NaN):Number(e.target.value))}/></label>;
  const time=(key:'planned_start'|'planned_end'|'actual_start'|'actual_end',label:string)=>
    <label>{label}<input type="datetime-local" step="60" value={value[key]?.slice(0,16)??''} onChange={e=>update(key,e.target.value||null)}/></label>;
  function containFocus(event:React.KeyboardEvent<HTMLDialogElement>) {
    if(event.key!=='Tab')return;
    const fields=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input,select,button')).filter(el=>!el.hasAttribute('disabled'));
    const first=fields[0],last=fields[fields.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  return <dialog ref={dialog} className={styles.editor} aria-labelledby="shift-editor-title" aria-describedby="shift-editor-help" onKeyDown={containFocus} onCancel={e=>{e.preventDefault();onClose();}}>
    <h2 id="shift-editor-title">Editar turno ficticio</h2>
    <p id="shift-editor-help">Solo memoria. No guarda datos reales. Horarios según la zona de este dispositivo; en NZ se contempla el cambio de hora. Fin nocturno: indicá el día siguiente.</p>
    <form onSubmit={submit} noValidate>
      <div className={styles.editorGrid}>
        <label>Fecha del turno<input type="date" required min="2026-04-01" max="2027-03-31" value={value.shift_date} onChange={e=>update('shift_date',e.target.value)}/></label>
        <label>Tipo<select value={value.kind} onChange={e=>applyKind(e.target.value as Shift['kind'])}>{Object.entries(kindLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Estado del ejemplo<select value={value.status} onChange={e=>update('status',e.target.value as Shift['status'])}>{editableStatuses.map(key=><option key={key} value={key}>{statusLabels[key]}</option>)}</select></label>
      </div>
      {value.kind!=='off'?<fieldset><legend>Planificado del ejemplo</legend><div className={styles.editorGrid}>
        {time('planned_start','Inicio planificado')}{time('planned_end','Fin planificado')}{numeric('planned_unpaid_break','Pausa planificada (h)')}
      </div><p>Horas planificadas actuales: {value.planned_paid_hours} h. Se calculan desde el horario y la pausa al aceptar, máximo 12 h.</p><p>Tarifa ficticia fija: NZD {value.planned_rate}/h. No se editan reglas salariales.</p></fieldset>:<p>Día libre: cero horas.</p>}
      {value.kind!=='off'?<fieldset><legend>Trabajado del ejemplo · opcional</legend><p>Estos campos representan datos trabajados ficticios. Solo se aplican al cálculo en estado Trabajado o Modificado. Sin horario, podés indicar horas del ejemplo; con horario se calculan al aceptar.</p><div className={styles.editorGrid}>
        {time('actual_start','Inicio trabajado ficticio')}{time('actual_end','Fin trabajado ficticio')}
        {numeric('actual_paid_hours','Horas trabajadas ficticias',true)}{numeric('actual_unpaid_break','Pausa trabajada ficticia (h)',true)}{numeric('actual_rate','Tarifa trabajada ficticia NZD/h',true)}
      </div></fieldset>:null}
      {error?<p ref={alert} role="alert" tabIndex={-1}>{error}</p>:null}
      <div className={styles.controls}><button type="submit">Aceptar turno ficticio</button><button type="button" onClick={onClose}>Descartar edición</button></div>
    </form>
  </dialog>;
}
