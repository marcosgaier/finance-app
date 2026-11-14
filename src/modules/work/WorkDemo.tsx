import React from 'react';
import {DashboardPage} from './pages/DashboardPage';
import {validateDemo, referenceDay} from './demo/fixtures';
import styles from './work-demo.module.css';

class DemoBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p role="alert">Demostración no disponible. Podés volver a Finanzas.</p> : this.props.children; }
}
function Summary() { return <DashboardPage {...validateDemo()}/>; }
export function WorkDemo({onClose}:{onClose:()=>void}) {
  return <section className={styles.workDemo} aria-labelledby="work-demo-title">
    <div className={styles.banner}>DEMOSTRACIÓN — datos ficticios; no es tu roster</div>
    <h1 id="work-demo-title" tabIndex={-1}>Trabajo · Taura</h1>
    <p>Fecha fija del ejemplo: {referenceDay} · año fiscal 2026–27.</p>
    <p>Solo lectura. No se guarda ni se importa a Finanzas. Todos los importes y estados son ejemplos.</p>
    <button type="button" onClick={onClose}>Volver a Finanzas</button>
    <DemoBoundary><Summary/></DemoBoundary>
  </section>;
}
