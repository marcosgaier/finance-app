import React, {useLayoutEffect, useRef, useState} from 'react';
import {DashboardPage} from './pages/DashboardPage';
import {RosterPage} from './pages/RosterPage';
import {PaymentsPage} from './pages/PaymentsPage';
import {validateDemo, referenceDay} from './demo/fixtures';
import styles from './work-demo.module.css';
import {applyBatch,type BatchPlan} from './editor/batchPlan';
import {changeOvertime} from './demo/overtime';
import type {OvertimePreference,OvertimeTreatment,Shift} from './vendor/taura/types';

class DemoBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p role="alert">Demostración no disponible. Podés volver a Finanzas.</p> : this.props.children; }
}
type WorkView = 'summary'|'roster'|'payments';
const headingIds:Record<WorkView,string>={summary:'work-summary-title',roster:'work-roster-title',payments:'work-payments-title'};
function Pages({view,shifts,onShifts,onBatch,generation,revision,overtimePreferences,onOvertimeTreatmentChange}:{view:WorkView;shifts:Shift[];onShifts:(next:Shift[])=>void;onBatch:(plan:BatchPlan)=>void;generation:number;revision:number;overtimePreferences:OvertimePreference[];onOvertimeTreatmentChange:(week:string,treatment:OvertimeTreatment)=>void}) {
  const ordered=[...shifts].sort((a,b)=>a.shift_date.localeCompare(b.shift_date)||(a.planned_start??'').localeCompare(b.planned_start??''));
  const data={...validateDemo(),shifts:ordered,overtimePreferences};
  return <><section hidden={view!=='summary'} aria-labelledby="work-summary-title">
    <h2 id="work-summary-title" tabIndex={-1}>Resumen del ejemplo</h2><DashboardPage {...data}/>
  </section><section hidden={view!=='roster'} aria-labelledby="work-roster-title">
    <RosterPage key={revision} {...data} onShifts={onShifts} onBatch={onBatch} generation={generation}/>
  </section><section hidden={view!=='payments'} aria-labelledby="work-payments-title">
    <PaymentsPage {...data} onOvertimeTreatmentChange={onOvertimeTreatmentChange}/>
  </section></>;
}
// Initialization and editing stay inside the demo error boundary, including on
// browsers without a required in-memory platform primitive.
function DemoSession({view}:{view:WorkView}) {
  const [shifts,setShifts]=useState(()=>structuredClone(validateDemo().shifts));
  const [overtimePreferences,setOvertimePreferences]=useState(()=>structuredClone(validateDemo().overtimePreferences));
  function overtime(week:string,treatment:OvertimeTreatment){
    const data=validateDemo(),sessionShifts=current.current;
    setOvertimePreferences(previous=>changeOvertime(previous,sessionShifts,data.settings,data.referenceDate,week,treatment));
  }
  const current=useRef(shifts),generation=useRef(0);
  function change(next:Shift[]){generation.current++;current.current=next;setShifts(next);}
  function batch(plan:BatchPlan){change(applyBatch(current.current,plan,generation.current));}
  const [revision,setRevision]=useState(0);
  function reset(){
    if(!window.confirm('¿Restablecer ejemplo? Se descartan los cambios ficticios de esta demo.'))return;
    change(structuredClone(validateDemo().shifts));setOvertimePreferences(structuredClone(validateDemo().overtimePreferences));setRevision(value=>value+1);
  }
  return <><div className={styles.sessionTools}><button className={styles.quietButton} type="button" onClick={reset}>Restablecer ejemplo</button></div>
    <Pages view={view} shifts={shifts} onShifts={change} onBatch={batch} generation={generation.current} revision={revision} overtimePreferences={overtimePreferences} onOvertimeTreatmentChange={overtime}/></>;
}
export function WorkDemo({onClose}:{onClose:()=>void}) {
  const [view,setView]=useState<WorkView>('summary');
  const scroll=useRef({summary:0,roster:0,payments:0}), changed=useRef(false);
  function navigate(next:typeof view) {
    if(next===view)return;
    scroll.current[view]=window.scrollY;changed.current=true;setView(next);
  }
  useLayoutEffect(()=>{
    if(!changed.current)return;
    document.getElementById(headingIds[view])?.focus({preventScroll:true});
    window.scrollTo(0,scroll.current[view]);
  },[view]);
  return <section className={styles.workDemo} aria-labelledby="work-demo-title">
    <div className={styles.banner}>DEMOSTRACIÓN — datos ficticios; no es tu roster. No son sueldos reales ni depósitos confirmados. No se guardan ni se incorporan a Finanzas.</div>
    <header className={styles.workHeader}>
      <h1 id="work-demo-title" tabIndex={-1}>Trabajo · Taura</h1>
      <button className={styles.quietButton} type="button" onClick={onClose}><span aria-hidden="true">←</span> Volver a Finanzas</button>
    </header>
    <details className={styles.demoDetails}>
      <summary>Solo en memoria · detalles del ejemplo</summary>
      <p>Fecha fija del ejemplo: {referenceDay} · año fiscal 2026–27.</p>
      <p>Los cambios solo viven en memoria; no se guardan ni se importan a Finanzas. Todos los importes y estados son ejemplos.</p>
      <p>Salir de Trabajo o recargar restaura el ejemplo original. Resumen y Pagos recalculan únicamente este escenario ficticio con el motor fijado; no editan recibos ni cobros reales.</p>
    </details>
    <nav aria-label="Vistas de Trabajo" className={styles.viewNav}>
      {(['summary','roster','payments'] as const).map((id,index)=><button key={id} type="button" aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {index===0?<path d="m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7"/>:index===1?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2m4 0h2"/></>:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18m-5 5h2"/></>}
        </svg>
        {['Resumen','Roster','Pagos'][index]}
      </button>)}
    </nav>
    <DemoBoundary><DemoSession view={view}/></DemoBoundary>
  </section>;
}
