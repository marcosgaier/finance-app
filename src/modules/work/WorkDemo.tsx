import React, {useLayoutEffect, useRef, useState} from 'react';
import {DashboardPage} from './pages/DashboardPage';
import {RosterPage} from './pages/RosterPage';
import {PaymentsPage} from './pages/PaymentsPage';
import {validateDemo, referenceDay} from './demo/fixtures';
import styles from './work-demo.module.css';
import type {Shift} from './vendor/taura/types';

class DemoBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p role="alert">Demostración no disponible. Podés volver a Finanzas.</p> : this.props.children; }
}
type WorkView = 'summary'|'roster'|'payments';
const headingIds:Record<WorkView,string>={summary:'work-summary-title',roster:'work-roster-title',payments:'work-payments-title'};
function Pages({view,shifts,onShifts,revision}:{view:WorkView;shifts:Shift[];onShifts:(next:Shift[])=>void;revision:number}) {
  const ordered=[...shifts].sort((a,b)=>a.shift_date.localeCompare(b.shift_date)||(a.planned_start??'').localeCompare(b.planned_start??''));
  const data={...validateDemo(),shifts:ordered};
  return <><section hidden={view!=='summary'} aria-labelledby="work-summary-title">
    <h2 id="work-summary-title" tabIndex={-1}>Resumen del ejemplo</h2><DashboardPage {...data}/>
  </section><section hidden={view!=='roster'} aria-labelledby="work-roster-title">
    <RosterPage key={revision} {...data} onShifts={onShifts}/>
  </section><section hidden={view!=='payments'} aria-labelledby="work-payments-title">
    <PaymentsPage {...data}/>
  </section></>;
}
// Initialization and editing stay inside the demo error boundary, including on
// browsers without a required in-memory platform primitive.
function DemoSession({view}:{view:WorkView}) {
  const [shifts,setShifts]=useState(()=>structuredClone(validateDemo().shifts));
  const [revision,setRevision]=useState(0);
  function reset(){
    if(!window.confirm('¿Restablecer ejemplo? Se descartan los cambios ficticios de esta demo.'))return;
    setShifts(structuredClone(validateDemo().shifts));setRevision(value=>value+1);
  }
  return <><button type="button" onClick={reset}>Restablecer ejemplo</button>
    <Pages view={view} shifts={shifts} onShifts={setShifts} revision={revision}/></>;
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
    <div className={styles.banner}>DEMOSTRACIÓN — datos ficticios; no es tu roster</div>
    <h1 id="work-demo-title" tabIndex={-1}>Trabajo · Taura</h1>
    <p>Fecha fija del ejemplo: {referenceDay} · año fiscal 2026–27.</p>
    <p>MODO DEMOSTRACIÓN — datos ficticios. Los cambios solo viven en memoria; no se guardan ni se importan a Finanzas. Todos los importes y estados son ejemplos.</p>
    <p>Salir de Trabajo o recargar restaura el ejemplo original. Resumen y Pagos recalculan únicamente este escenario ficticio con el motor fijado; no editan recibos ni cobros reales.</p>
    <button type="button" onClick={onClose}>Volver a Finanzas</button>
    <nav aria-label="Vistas de Trabajo" className={styles.controls}>
      <button type="button" aria-current={view==='summary'?'page':undefined} onClick={()=>navigate('summary')}>Resumen</button>
      <button type="button" aria-current={view==='roster'?'page':undefined} onClick={()=>navigate('roster')}>Roster</button>
      <button type="button" aria-current={view==='payments'?'page':undefined} onClick={()=>navigate('payments')}>Pagos</button>
      {view!=='summary'?<button type="button" onClick={()=>navigate('summary')}>Atrás al resumen</button>:null}
    </nav>
    <DemoBoundary><DemoSession view={view}/></DemoBoundary>
  </section>;
}
