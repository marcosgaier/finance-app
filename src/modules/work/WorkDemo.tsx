import React, {useLayoutEffect, useRef, useState} from 'react';
import {DashboardPage} from './pages/DashboardPage';
import {RosterPage} from './pages/RosterPage';
import {PaymentsPage} from './pages/PaymentsPage';
import {validateDemo, referenceDay} from './demo/fixtures';
import styles from './work-demo.module.css';

class DemoBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p role="alert">Demostración no disponible. Podés volver a Finanzas.</p> : this.props.children; }
}
type WorkView = 'summary'|'roster'|'payments';
const headingIds:Record<WorkView,string>={summary:'work-summary-title',roster:'work-roster-title',payments:'work-payments-title'};
function Pages({view}:{view:WorkView}) {
  const data=validateDemo();
  return <><section hidden={view!=='summary'} aria-labelledby="work-summary-title">
    <h2 id="work-summary-title" tabIndex={-1}>Resumen del ejemplo</h2><DashboardPage {...data}/>
  </section><section hidden={view!=='roster'} aria-labelledby="work-roster-title">
    <RosterPage {...data}/>
  </section><section hidden={view!=='payments'} aria-labelledby="work-payments-title">
    <PaymentsPage {...data}/>
  </section></>;
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
    <p>Solo lectura. No se guarda ni se importa a Finanzas. Todos los importes y estados son ejemplos.</p>
    <p>No se guarda ni se exporta. Usá Resumen/Roster/Pagos para navegar; Atrás del navegador conserva su comportamiento habitual.</p>
    <button type="button" onClick={onClose}>Volver a Finanzas</button>
    <nav aria-label="Vistas de Trabajo" className={styles.controls}>
      <button type="button" aria-current={view==='summary'?'page':undefined} onClick={()=>navigate('summary')}>Resumen</button>
      <button type="button" aria-current={view==='roster'?'page':undefined} onClick={()=>navigate('roster')}>Roster</button>
      <button type="button" aria-current={view==='payments'?'page':undefined} onClick={()=>navigate('payments')}>Pagos</button>
      {view!=='summary'?<button type="button" onClick={()=>navigate('summary')}>Atrás al resumen</button>:null}
    </nav>
    <DemoBoundary><Pages view={view}/></DemoBoundary>
  </section>;
}
