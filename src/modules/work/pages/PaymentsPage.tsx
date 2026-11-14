import React from 'react';
import type {OvertimePreference,PayPeriodProjection,PayPeriodStatus,Settings,Shift} from '../vendor/taura/types';
import {buildPayProjections} from '../vendor/taura/domain/payPeriods';
import {formatDate,toIsoDate} from '../vendor/taura/lib/dates';
import styles from '../work-demo.module.css';

const money=(value:number)=>new Intl.NumberFormat('es-NZ',{style:'currency',currency:'NZD'}).format(value);
const statusLabels:Record<PayPeriodStatus,string>={
  projected:'Proyección del ejemplo',partially_worked:'Parcialmente trabajado en el ejemplo',
  worked:'Semana trabajada en el ejemplo',paid:'Estado pagado ficticio; sin confirmación bancaria',
};
interface Props {
  shifts:readonly Readonly<Shift>[];
  settings:Readonly<Settings>;
  overtimePreferences:readonly Readonly<OvertimePreference>[];
  referenceDate:Date;
}

export function PaymentsPage({shifts,settings,overtimePreferences,referenceDate}:Props) {
  // Keep all shifts as overtime context; the engine and its rules remain unchanged.
  const periods=buildPayProjections([...shifts],settings,referenceDate,4,[...overtimePreferences]);
  const referenceDay=toIsoDate(referenceDate);
  const upcoming=periods.filter(period=>period.payDate>=referenceDay).slice(0,4);
  const recent=periods.filter(period=>period.payDate<referenceDay).slice(-2).reverse();
  return <>
    <h2 id="work-payments-title" tabIndex={-1}>Pagos del ejemplo</h2>
    <div className={styles.hero}>
      <p>PROYECCIONES SALARIALES FICTICIAS</p>
      <h3>Pagos estimados</h3>
      <span>Solo lectura · referencia {formatDate(referenceDay,{dateStyle:'long'})}</span>
    </div>
    <p>No se guarda ni se exporta. Estas proyecciones no son depósitos confirmados ni ingresos de Finanzas.</p>
    <p>Semana del ejemplo: domingo a sábado. Las fechas de pago se calculan con la configuración ficticia.</p>
    <section aria-labelledby="upcoming-example-payments">
      <h3 id="upcoming-example-payments">Próximos pagos</h3>
      <p className={styles.muted}>Desde la fecha del ejemplo · del más cercano al más lejano.</p>
      {upcoming.length?<div className={styles.paymentsList}>{upcoming.map((period,index)=><PaymentCard key={period.id} featured={index===0} period={period} kiwiSaverRate={settings.kiwisaver_rate}/>)}</div>:<p>Sin próximas proyecciones en este ejemplo.</p>}
    </section>
    <section className={styles.previousPayments} aria-labelledby="recent-example-payments">
      <h3 id="recent-example-payments">Pagos anteriores</h3>
      <p className={styles.muted}>Antes de la fecha del ejemplo · del más reciente al más antiguo. Son proyecciones ficticias, sin confirmación de cobro.</p>
      {recent.length?<div className={styles.paymentsList}>{recent.map(period=><PaymentCard key={period.id} period={period} kiwiSaverRate={settings.kiwisaver_rate}/>)}</div>:<p>Sin proyecciones recientes en este ejemplo.</p>}
    </section>
    <p>Estimación del motor fijado: código M, año fiscal 2026–27. PAYE incluye ACC; no se descuenta de nuevo. Tarifas y estados ficticios. Esta demo no valida cálculos específicos de feriados.</p>
  </>;
}

function PaymentCard({period,kiwiSaverRate,featured=false}:{period:PayPeriodProjection;kiwiSaverRate:number;featured?:boolean}) {
  return <article className={`${styles.card} ${styles.paymentCard} ${featured?styles.featuredPayment:''}`} aria-labelledby={`example-payment-${period.id}`} data-payment={period.id} data-pay-date={period.payDate}>
    <p className={styles.paymentEyebrow}>{featured?'Próximo pago estimado':'Pago estimado del ejemplo'}</p>
    <p className={styles.paymentDateLabel}>Fecha estimada de cobro</p>
    <h4 id={`example-payment-${period.id}`}>{formatDate(period.payDate,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h4>
    <p className={styles.paymentStatus}>{statusLabels[period.status]}</p>
    <p className={styles.workedPeriod}><span>Semana / período trabajado del ejemplo</span>{formatDate(period.startsOn,{dateStyle:'long'})} – {formatDate(period.endsOn,{dateStyle:'long'})}</p>
    {period.shiftCount===0?<p>Semana sin turnos en este ejemplo; no indica ausencia de ingresos reales.</p>:null}
    <dl className={styles.paymentHours}>
      <div><dt>Diurnas</dt><dd>{period.dayHours} h</dd></div>
      <div><dt>Nocturnas</dt><dd>{period.nightHours} h</dd></div>
      <div><dt>Ordinarias</dt><dd>{period.ordinaryHours} h</dd></div>
      <div><dt>Overtime</dt><dd>{period.overtimeHours} h</dd></div>
    </dl>
    {period.overtimeWeeks.map(week=><section className={styles.paymentOvertime} key={week.weekStart} aria-label={`Overtime del ejemplo ${week.weekStart}`}>
      <h5>Overtime del ejemplo · {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}</h5>
      <p>{week.overtimeHours} h en esta proyección</p>
      <p>Tratamiento ficticio: {week.overtimeTreatment==='bank'?'Hours Bank':'Enhanced Payment estimado'}</p>
      {week.overtimeTreatment==='bank'?<p>Hours Bank del ejemplo: +{week.bankableHours} h</p>:<p>Enhanced Payment estimado: {money(week.enhancedPayment)}</p>}
    </section>)}
    <div className={styles.paymentNet}><span>Neto estimado del ejemplo</span><strong data-amount="net">{money(period.estimatedNet)}</strong></div>
    <dl className={styles.paymentAmounts}>
      <div><dt>Pago base del ejemplo</dt><dd data-amount="base">{money(period.basePay)}</dd></div>
      <div><dt>Enhanced Payment estimado</dt><dd data-amount="enhanced">{money(period.enhancedPayment)}</dd></div>
      <div><dt>Adicional nocturno</dt><dd data-amount="night">{money(period.nightAllowance)}</dd></div>
      <div><dt>Adicional fin de semana</dt><dd data-amount="weekend">{money(period.weekendAllowance)}</dd></div>
      <div><dt>Bruto estimado</dt><dd data-amount="gross">{money(period.estimatedGross)}</dd></div>
      <div><dt>PAYE estimado (incluye ACC)</dt><dd data-amount="paye">− {money(period.estimatedPAYE)}</dd></div>
      <div><dt>KiwiSaver estimado ({kiwiSaverRate}%)</dt><dd data-amount="kiwisaver">− {money(period.estimatedKiwiSaver)}</dd></div>
    </dl>
    <p className={styles.muted}>Código {period.estimatedTaxCode} · año fiscal {period.estimatedTaxYear} · sin confirmación de cobro.</p>
  </article>;
}
