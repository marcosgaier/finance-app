import React, {useLayoutEffect, useRef, useState} from 'react';
import type {Settings,Shift,OvertimePreference} from '../vendor/taura/types';
import {addDays,formatDate,toIsoDate} from '../vendor/taura/lib/dates';
import {totals} from '../vendor/taura/lib/payroll';
import {calculateContractOvertime} from '../vendor/taura/domain/contractRules';
import {getContractSummaryWeekForRosterWeek,getRosterWeekDates,getRosterWeekStart,moveRosterWeek} from '../vendor/taura/domain/rosterWeeks';
import {DayDetails,kindLabels,statusLabels} from '../components/DayDetails';
import styles from '../work-demo.module.css';

interface Props {shifts:readonly Readonly<Shift>[];settings:Readonly<Settings>;overtimePreferences:readonly Readonly<OvertimePreference>[];referenceDate:Date}
export function RosterPage({shifts,settings,overtimePreferences,referenceDate}:Props) {
  const [cursor,setCursor]=useState(()=>new Date(referenceDate)),[view,setView]=useState<'month'|'week'>('month'),[selected,setSelected]=useState<string|null>(null);
  const origin=useRef<HTMLButtonElement|null>(null);
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
  return <>
    <h2 id="work-roster-title" tabIndex={-1}>Roster del ejemplo</h2>
    <div className={styles.hero}><h3>{view==='month'?formatDate(toIsoDate(cursor),{month:'long',year:'numeric'}):`${formatDate(start)} – ${formatDate(end,{day:'numeric',month:'long',year:'numeric'})}`}</h3><span>Solo lectura · domingo a sábado</span></div>
    <div className={styles.controls} aria-label="Vista del calendario">
      <button type="button" aria-pressed={view==='month'} onClick={()=>changeView('month')}>Mes</button>
      <button type="button" aria-pressed={view==='week'} onClick={()=>changeView('week')}>Semana</button>
    </div>
    <div className={styles.controls} aria-label="Período del calendario">
      <button type="button" aria-label="Período anterior" onClick={()=>move(-1)}>← Anterior</button>
      <button type="button" onClick={()=>{setSelected(null);setCursor(new Date(referenceDate));}}>Fecha del ejemplo</button>
      <button type="button" aria-label="Período siguiente" onClick={()=>move(1)}>Siguiente →</button>
    </div>
    {view==='month'?<div className={styles.weekLabels} aria-hidden="true">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(x=><b key={x}>{x}</b>)}</div>:null}
    <ul className={view==='month'?styles.monthDays:styles.weekList} aria-label={view==='month'?'Calendario mensual del ejemplo':'Calendario semanal del ejemplo'}>
      {days.map(date=>{
        const key=toIsoDate(date),items=shifts.filter(s=>s.shift_date===key);
        const description=items.length?items.map(s=>`${kindLabels[s.kind]} · ${statusLabels[s.status]} ficticio · ${s.planned_paid_hours} h`).join('; '):'Sin turnos en este ejemplo';
        return <li key={key} className={view==='month'&&date.getMonth()!==cursor.getMonth()?styles.outside:undefined}>
          <button type="button" data-day={key} aria-label={`${formatDate(key,{dateStyle:'full'})}. ${description}`} aria-current={key===toIsoDate(referenceDate)?'date':undefined} aria-expanded={selected===key} aria-controls={selected===key?'day-detail-title':undefined} onClick={event=>{origin.current=event.currentTarget;setSelected(key);}}>
            <b>{view==='month'?date.getDate():formatDate(key,{weekday:'long',day:'numeric',month:'long'})}</b>
            <span>{view==='month'?(items.length?items.map(s=>kindLabels[s.kind]).join(', '):'Sin turnos'):description}</span>
          </button>
        </li>;
      })}
    </ul>
    {selected?<DayDetails date={selected} shifts={shifts.filter(s=>s.shift_date===selected)} onClose={closeDetail}/>:null}
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
  </>;
}
