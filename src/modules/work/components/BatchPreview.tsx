import React,{useLayoutEffect,useRef,useState} from 'react';
import {quickLabels,type BatchPlan} from '../editor/batchPlan';
import styles from '../work-demo.module.css';

export function BatchPreview({plan,onConfirm,onClose}:{plan:BatchPlan;onConfirm:()=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),[error,setError]=useState('');
  useLayoutEffect(()=>{
    const origin=document.activeElement as HTMLElement|null,modal=dialog.current!;
    modal.showModal();
    return ()=>{modal.close();origin?.focus({preventScroll:true});};
  },[]);
  const labels={create:'Se agregará',change:'Se cambiará',skip:'Se omitirá'};
  return <dialog ref={dialog} className={styles.editorDialog} aria-labelledby="batch-title" aria-describedby="batch-help" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const buttons=Array.from(dialog.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement?.id==='batch-title')){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
    <h2 id="batch-title" tabIndex={-1} autoFocus>Vista previa de cambios ficticios</h2>
    <p>{quickLabels[plan.kind]}</p>
    <p id="batch-help">Solo memoria. Las fechas omitidas se conservan intactas. Revisá todas las fechas antes de confirmar.</p>
    <p>{plan.rows.filter(r=>r.action==='create').length} a crear · {plan.rows.filter(r=>r.action==='change').length} a cambiar · {plan.rows.filter(r=>r.action==='skip').length} a omitir</p>
    <ul>{plan.rows.map(row=><li key={row.date}><strong>{row.date} — {labels[row.action]}</strong><p>{row.reason||`${row.shift?.planned_start??'Sin horario'} → ${row.shift?.planned_end??'Sin horario'} · ${row.shift?.planned_paid_hours} h`}</p></li>)}</ul>
    {error?<p role="alert">{error}</p>:null}
    <div className={styles.controls}><button type="button" disabled={Boolean(error)||!plan.rows.some(r=>r.action!=='skip')} onClick={()=>{try{onConfirm();}catch(reason){setError(reason instanceof Error?reason.message:'Plan inválido.');}}}>Confirmar cambios ficticios</button><button type="button" onClick={onClose}>Cancelar</button></div>
  </dialog>;
}
