import React from 'react';
import type {OvertimeTreatment,OvertimePreference,PayPeriodProjection,PayPeriodStatus,Settings,Shift} from '../vendor/taura/types';
import {buildPayProjections} from '../vendor/taura/domain/payPeriods';
import {formatDate,toIsoDate} from '../vendor/taura/lib/dates';
import {canChangeOvertime} from '../demo/overtime';
import styles from '../work-demo.module.css';

const money=(value:number)=>new Intl.NumberFormat('es-NZ',{style:'currency',currency:'NZD'}).format(value);
const statusLabels:Record<PayPeriodStatus,string>={
  projected:'Proyectado',partially_worked:'Parcialmente trabajado',
  worked:'Semana trabajada',paid:'Pagado ficticio · sin confirmar',
};
interface Props {
  shifts:readonly Readonly<Shift>[];
  settings:Readonly<Settings>;
  overtimePreferences:readonly Readonly<OvertimePreference>[];
  referenceDate:Date;
  onOvertimeTreatmentChange?:(week:string,treatment:OvertimeTreatment)=>void;
}

export function PaymentsPage({shifts,settings,overtimePreferences,referenceDate,onOvertimeTreatmentChange}:Props) {
  // Keep all shifts as overtime context; the engine and its rules remain unchanged.
  const periods=buildPayProjections([...shifts],settings,referenceDate,4,[...overtimePreferences]);
  const referenceDay=toIsoDate(referenceDate);
  const upcoming=periods.filter(period=>period.payDate>=referenceDay).slice(0,4);
  const recent=periods.filter(period=>period.payDate<referenceDay).slice(-2).reverse();
  return <>
    <h2 id="work-payments-title" tabIndex={-1}>Pagos del ejemplo</h2>
    <p className={styles.muted}>Referencia {formatDate(referenceDay,{dateStyle:'long'})} · semana de domingo a sábado.</p>
    <section aria-labelledby="upcoming-example-payments">
      <h3 id="upcoming-example-payments">Próximos pagos</h3>
      <p className={styles.muted}>Desde la fecha de referencia · del más cercano al más lejano.</p>
      {upcoming.length?<div className={styles.paymentsList}>{upcoming.map((period,index)=><PaymentCard key={period.id} featured={index===0} period={period} kiwiSaverRate={settings.kiwisaver_rate} onOvertimeTreatmentChange={onOvertimeTreatmentChange}/>)}</div>:<p>Sin próximas proyecciones en este ejemplo.</p>}
    </section>
    <section className={styles.previousPayments} aria-labelledby="recent-example-payments">
      <h3 id="recent-example-payments">Pagos anteriores</h3>
      <p className={styles.muted}>Del más reciente al más antiguo · sin confirmación de cobro.</p>
      {recent.length?<div className={styles.paymentsList}>{recent.map(period=><PaymentCard key={period.id} period={period} kiwiSaverRate={settings.kiwisaver_rate} onOvertimeTreatmentChange={onOvertimeTreatmentChange}/>)}</div>:<p>Sin proyecciones recientes en este ejemplo.</p>}
    </section>
    <details className={styles.disclosure}><summary>Información de las estimaciones</summary><p>Estimación del motor fijado: código M, año fiscal 2026–27. PAYE incluye ACC; no se descuenta de nuevo. Tarifas y estados ficticios. Esta demo no valida cálculos específicos de feriados.</p></details>
  </>;
}

function PaymentCard({period,kiwiSaverRate,featured=false,onOvertimeTreatmentChange}:{period:PayPeriodProjection;kiwiSaverRate:number;featured?:boolean;onOvertimeTreatmentChange?:Props['onOvertimeTreatmentChange']}) {
  return <article className={`${styles.card} ${styles.paymentCard} ${featured?styles.featuredPayment:''}`} aria-labelledby={`example-payment-${period.id}`} data-payment={period.id} data-pay-date={period.payDate}>
    <p className={styles.paymentEyebrow}>{featured?'Próximo pago':'Pago estimado'}</p>

    <h4 aria-label={`Fecha estimada de cobro ${period.payDate}`} id={`example-payment-${period.id}`}>{formatDate(period.payDate,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h4>
    <p className={styles.paymentStatus}>{statusLabels[period.status]}</p>
    <div className={styles.paymentNet}><span>Neto estimado</span><strong data-amount="net">{money(period.estimatedNet)}</strong></div>
    <p className={styles.workedPeriod}><span>Período trabajado</span>{formatDate(period.startsOn,{dateStyle:'long'})} – {formatDate(period.endsOn,{dateStyle:'long'})}</p>
    {period.shiftCount===0?<p>Semana sin turnos en este ejemplo; no indica ausencia de ingresos reales.</p>:null}
    <details className={styles.disclosure}><summary>Horas · {period.ordinaryHours+period.overtimeHours} h · Overtime {period.overtimeHours} h</summary>
    <dl className={styles.paymentHours}>
      <div><dt>Diurnas</dt><dd>{period.dayHours} h</dd></div>
      <div><dt>Nocturnas</dt><dd>{period.nightHours} h</dd></div>
      <div><dt>Ordinarias</dt><dd>{period.ordinaryHours} h</dd></div>
      <div><dt>Overtime</dt><dd>{period.overtimeHours} h</dd></div>
    </dl>
    </details>
    {period.overtimeWeeks.length?<details className={styles.disclosure}><summary>Overtime · tratamiento y detalle</summary>{period.overtimeWeeks.map(week=><section className={styles.paymentOvertime} key={week.weekStart} aria-label={`Overtime ${week.weekStart}`}>
      <h5>Overtime · {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}</h5>
      <p>{week.overtimeHours} h en esta proyección</p>
      {onOvertimeTreatmentChange&&canChangeOvertime(period,week.weekStart)?<label className={styles.overtimeChoice}>Tratamiento
        <select aria-label={`Tratamiento overtime ${week.weekStart}`} value={week.overtimeTreatment} onChange={event=>onOvertimeTreatmentChange(week.weekStart,event.target.value as OvertimeTreatment)}>
          <option value="pay">Cobrar Enhanced Payment</option><option value="bank">Acumular en Hours Bank</option>
        </select></label>:<p>Solo consulta · tratamiento protegido</p>}
      <p>La base se cobra siempre; Hours Bank suma solo el adicional (multiplicador − 1).</p>
      <p aria-live="polite">Tratamiento: {week.overtimeTreatment==='bank'?'Hours Bank':'Enhanced Payment estimado'}</p>
      {week.overtimeTreatment==='bank'?<p>Hours Bank: +{week.bankableHours} h</p>:<p>Enhanced Payment estimado: {money(week.enhancedPayment)}</p>}
    </section>)}</details>:null}

    <details className={styles.disclosure}><summary>Bruto, impuestos y adicionales</summary>
    <dl className={styles.paymentAmounts}>
      <div><dt>Pago base</dt><dd data-amount="base">{money(period.basePay)}</dd></div>
      <div><dt>Enhanced Payment estimado</dt><dd data-amount="enhanced">{money(period.enhancedPayment)}</dd></div>
      <div><dt>Adicional nocturno</dt><dd data-amount="night">{money(period.nightAllowance)}</dd></div>
      <div><dt>Adicional fin de semana</dt><dd data-amount="weekend">{money(period.weekendAllowance)}</dd></div>
      <div><dt>Bruto</dt><dd data-amount="gross">{money(period.estimatedGross)}</dd></div>
      <div><dt>PAYE estimado (incluye ACC)</dt><dd data-amount="paye">− {money(period.estimatedPAYE)}</dd></div>
      <div><dt>KiwiSaver estimado ({kiwiSaverRate}%)</dt><dd data-amount="kiwisaver">− {money(period.estimatedKiwiSaver)}</dd></div>
    </dl>
    <p className={styles.muted}>Código {period.estimatedTaxCode} · año fiscal {period.estimatedTaxYear} · sin confirmación de cobro.</p></details>
  </article>;
}
