import React, {useLayoutEffect, useRef, useState} from 'react';
import type {Settings,Shift,OvertimePreference} from '../vendor/taura/types';
import {addDays,formatDate,toIsoDate} from '../vendor/taura/lib/dates';
import {totals} from '../vendor/taura/lib/payroll';
import {calculateContractOvertime} from '../vendor/taura/domain/contractRules';
import {getContractSummaryWeekForRosterWeek,getRosterWeekDates,getRosterWeekStart,moveRosterWeek} from '../vendor/taura/domain/rosterWeeks';
import {DayDetails,kindLabels,statusLabels} from '../components/DayDetails';
import styles from '../work-demo.module.css';
import ui from '../roster.module.css';
import {BatchPreview} from '../components/BatchPreview';
import {planBatch,quickLabels,type QuickKind,type BatchPlan} from '../editor/batchPlan';
import {DemoShiftEditor} from '../components/DemoShiftEditor';
import {actOnShift,commitDraft,newDraft} from '../editor/shiftDraft';

interface Props {shifts:readonly Readonly<Shift>[];settings:Readonly<Settings>;overtimePreferences:readonly Readonly<OvertimePreference>[];referenceDate:Date;onShifts?:(next:Shift[])=>void;onBatch?:(plan:BatchPlan)=>void;generation?:number}
export function RosterPage({shifts,settings,overtimePreferences,referenceDate,onShifts,onBatch,generation=0}:Props) {
  const [cursor,setCursor]=useState(()=>new Date(referenceDate)),[view,setView]=useState<'month'|'week'>('month'),[selected,setSelected]=useState<string|null>(null);
  const [multi,setMulti]=useState(false),[dates,setDates]=useState<string[]>([]),[preview,setPreview]=useState<BatchPlan|null>(null),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState<{draft:Shift;originalId?:string}|null>(null),[error,setError]=useState('');
  function action(id:string,kind:'cancel'|'duplicate'|'delete'){
    try{
      if(kind==='delete'&&!window.confirm('¿Eliminar turno ficticio? No se puede deshacer dentro de esta demo. Los otros turnos se conservan.'))return;
      onShifts?.(actOnShift(shifts,id,kind,kind==='duplicate'?`demo-${crypto.randomUUID()}`:undefined,kind==='delete'));setError('');
      document.getElementById('day-detail-title')?.focus({preventScroll:true});
    }catch(reason){setError(reason instanceof Error?reason.message:'Acción ficticia inválida.');}
  }
  const origin=useRef<HTMLButtonElement|null>(null);
  const focusSelection=useRef(false);
  useLayoutEffect(()=>{
    if(!preview&&focusSelection.current){focusSelection.current=false;document.getElementById('roster-batch-actions')?.focus({preventScroll:true});}
  },[preview]);
  useLayoutEffect(()=>{if(selected)document.getElementById('day-detail-title')?.focus();},[selected]);
  const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const days=view==='month'?Array.from({length:42},(_,i)=>addDays(getRosterWeekStart(monthStart),i)):getRosterWeekDates(cursor);
  const week=getContractSummaryWeekForRosterWeek(cursor),start=toIsoDate(week.startsOn),end=toIsoDate(week.endsOn);
  // Rate the complete fixture before selecting this contractual week.
  const rated=calculateContractOvertime([...shifts],settings,[...overtimePreferences]);
  const sum=totals(shifts.filter(s=>s.shift_date>=start&&s.shift_date<=end).flatMap(s=>{const row=rated.get(s.id);return row?[row]:[];}));
  function move(amount:number){setSelected(null);setCursor(view==='month'?new Date(cursor.getFullYear(),cursor.getMonth()+amount,1):moveRosterWeek(cursor,amount));}
  function changeView(next:typeof view){setSelected(null);setView(next);}
  function closeDetail(){setSelected(null);origin.current?.focus();}
  return <div className={ui.roster}>
    <h2 id="work-roster-title" tabIndex={-1}>Roster del ejemplo</h2>
    <div className={ui.heading}><h3>{view==='month'?formatDate(toIsoDate(cursor),{month:'long',year:'numeric'}):`${formatDate(start)} – ${formatDate(end,{day:'numeric',month:'long',year:'numeric'})}`}</h3><span>Edición ficticia en memoria · domingo a sábado</span></div>
    <div className={ui.toolbar}>
    <div className={ui.segmented} aria-label="Vista del calendario">
      <button type="button" aria-pressed={view==='month'} onClick={()=>changeView('month')}>Mes</button>
      <button type="button" aria-pressed={view==='week'} onClick={()=>changeView('week')}>Semana</button>
    </div>
    <div className={ui.dateNav} aria-label="Período del calendario">
      <button type="button" aria-label="Período anterior" onClick={()=>move(-1)}>‹</button>
      <button type="button" onClick={()=>{setSelected(null);setCursor(new Date(referenceDate));}} aria-label="Fecha del ejemplo">Ejemplo</button>
      <button type="button" aria-label="Período siguiente" onClick={()=>move(1)}>›</button>
    </div>
    </div>
    {onBatch?<div className={ui.selectionMode}>
      <button type="button" aria-pressed={multi} aria-controls="roster-batch-actions" onClick={()=>{setMulti(!multi);setSelected(null);}}>Seleccionar varios días</button>
      {multi?<a href="#roster-batch-actions" onClick={event=>{event.preventDefault();document.getElementById('roster-batch-actions')?.focus();}}>Elegir turno · {dates.length}</a>:null}
    </div>:null}
    {preview&&onBatch?<BatchPreview plan={preview} onClose={()=>setPreview(null)} onConfirm={()=>{
      const changes=preview.rows.some(row=>{
        if(row.action==='create')return true;
        if(row.action!=='change'||!row.shift)return false;
        const original=shifts.find(s=>s.id===row.shift!.id);
        return (['kind','planned_start','planned_end','planned_paid_hours','planned_unpaid_break','planned_rate'] as const).some(key=>row.shift![key]!==original?.[key]);
      });
      onBatch(preview);setNotice(`Lote aplicado: ${preview.rows.filter(r=>r.action==='create').length} creados, ${preview.rows.filter(r=>r.action==='change').length} cambiados, ${preview.rows.filter(r=>r.action==='skip').length} omitidos.`);setPreview(null);
      if(changes){setDates([]);focusSelection.current=true;}
    }}/>:null}
    {view==='month'?<div className={styles.weekLabels} aria-hidden="true">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(x=><b key={x}>{x}</b>)}</div>:null}
    <ul className={view==='month'?styles.monthDays:styles.weekList} aria-label={view==='month'?'Calendario mensual del ejemplo':'Calendario semanal del ejemplo'}>
      {days.map(date=>{
        const key=toIsoDate(date),items=shifts.filter(s=>s.shift_date===key);
        const description=items.length?items.map(s=>`${kindLabels[s.kind]} · ${statusLabels[s.status]} ficticio · ${s.planned_paid_hours} h`).join('; '):'Sin turnos en este ejemplo';
        return <li key={key} className={view==='month'&&date.getMonth()!==cursor.getMonth()?styles.outside:undefined}>
          <button type="button" data-day={key} aria-label={`${formatDate(key,{dateStyle:'full'})}. ${description}`} aria-current={key===toIsoDate(referenceDate)?'date':undefined} aria-pressed={multi?dates.includes(key):undefined} aria-expanded={multi?undefined:selected===key} aria-controls={selected===key?'day-detail-title':undefined} onClick={event=>{origin.current=event.currentTarget;if(multi){setDates(current=>current.includes(key)?current.filter(d=>d!==key):[...current,key]);}else setSelected(key);}}>
            <b>{view==='month'?date.getDate():formatDate(key,{weekday:'long',day:'numeric',month:'long'})}</b>
            <span className={ui.marks}>{items.length?items.slice(0,view==='month'?1:items.length).map(s=><span key={s.id} className={ui.mark} data-kind={s.kind} data-status={s.status} title={`${kindLabels[s.kind]} · ${statusLabels[s.status]}`}>
              {({day:'☀',night:'☾',off:'⌂',annual_leave:'A',sick_leave:'S',custom:'◆'}[s.kind])} {view==='month'?({planned:'P',worked:'T',modified:'M',cancelled:'×',paid_leave:'LP',unpaid_leave:'LS',payslip:'R',confirmed:'C'}[s.status]):`${kindLabels[s.kind]} · ${statusLabels[s.status]} · ${s.planned_paid_hours} h`}
            </span>):'·'}{view==='month'&&items.length>1?<small>+{items.length-1}</small>:null}</span>
          </button>
        </li>;
      })}
    </ul>
    <details className={ui.legend}><summary>☀ Día · ☾ Noche · ⌂ Libre · Estados y símbolos</summary><p>A Anual · S Enfermedad · ◆ Otro · P Planificado · T Trabajado · C Confirmado · × Cancelado · M Modificado · R Recibo · LP/LS Licencia paga/sin pago. + indica más turnos; abrí el día para ver todos. El borde oscuro marca la fecha del ejemplo.</p></details>
    {onBatch?<section id="roster-batch-actions" tabIndex={-1} className={ui.batchBar} aria-label="Selección y accesos rápidos">
      {multi?<><div className={ui.selectionStatus}><b role="status">{dates.length} días seleccionados</b><button type="button" disabled={!dates.length} aria-label="Limpiar selección" onClick={()=>setDates([])}>Limpiar</button></div>
        <div className={ui.templates}>{(Object.keys(quickLabels) as QuickKind[]).map(kind=><button key={kind} type="button" aria-label={quickLabels[kind]} disabled={!dates.length} onClick={()=>{
          try{setPreview(planBatch(shifts,dates,kind,settings,()=>`demo-${crypto.randomUUID()}`,generation));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Plan inválido.');}
        }}><span>{kind==='day'?'☀ Día':kind==='night'?'☾ Noche':'– Libre'}</span><small>{kind==='day'?'06–18':kind==='night'?'18–06 (+1 día)':'0 h'}</small></button>)}</div>
        <details className={ui.dates}><summary>Ver fechas seleccionadas</summary><p>{dates.slice().sort().join(' · ')||'Tocá días o usá Tab y Espacio para seleccionarlos.'}</p></details>
        <p className={ui.hint}>La selección se conserva al navegar. Elegí un turno para revisar el preview.</p>
      </>:<p>Activá la selección múltiple para cargar varios días.</p>}
      {notice?<p role="status">{notice}</p>:null}
    </section>:null}
    {selected?<DayDetails date={selected} shifts={shifts.filter(s=>s.shift_date===selected)} onClose={closeDetail}
      onAdd={onShifts?()=>setEditor({draft:newDraft(selected,`demo-${crypto.randomUUID()}`)}):undefined}
      onEdit={onShifts?s=>setEditor({draft:structuredClone(s),originalId:s.id}):undefined}
      onAction={onShifts?action:undefined}/>:null}
    {error?<p role="alert">{error}</p>:null}
    {editor?<DemoShiftEditor initial={editor.draft} editing={Boolean(editor.originalId)} onClose={()=>setEditor(null)} onSave={draft=>onShifts?.(commitDraft(shifts,draft,editor.originalId))}/>:null}
    <section className={styles.card} aria-labelledby="roster-week-summary">
      <h3 id="roster-week-summary">Resumen semanal del ejemplo</h3>
      <p>{formatDate(start,{dateStyle:'long'})} – {formatDate(end,{dateStyle:'long'})} · Domingo a sábado</p>
      <div className={styles.dashboardGrid}>
        <article><span>Total</span><strong>{sum.ordinary+sum.overtime} h</strong></article>
        <article><span>Ordinarias</span><strong>{sum.ordinary} h</strong></article>
        <article><span>Overtime</span><strong>{sum.overtime} h</strong></article>
        <article><span>Hours Bank del ejemplo</span><strong>+{sum.bankableHours} h</strong></article>
      </div>
      <p>No se guarda ni se exporta.</p>
    </section>
  </div>;
}
