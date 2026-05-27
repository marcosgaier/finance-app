import React from 'react';
import { formatDisplayDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

export function GemMinimumSummary({ summary }) {
  if (!summary) return null;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Mínimos GEM</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Ciclo actual</h2>
          <p className="mt-1 text-sm text-stone-500">
            {formatDisplayDate(summary.cycleStartDate)} al {formatDisplayDate(summary.cycleEndDate)}
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          {summary.plans.length} plan{summary.plans.length === 1 ? '' : 'es'} con mínimo
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <InfoGroup title="Vencimientos interest-free">
          <Metric label="Mínimo semanal para llegar justo" value={formatMoney(summary.minimumToAvoidExpiry)} />
          <Metric label="Recomendado interest-free" value={formatMoney(summary.interestFreeRecommendedPayment)} />
        </InfoGroup>

        <InfoGroup title="Mínimos obligatorios GEM">
          <Metric label="Mínimo mensual del ciclo" value={formatMoney(summary.monthlyMinimumTotal)} />
          <Metric label="Pagos registrados del ciclo" value={formatMoney(summary.paymentsThisCycle)} />
          <Metric label="Faltante del ciclo" value={formatMoney(summary.cycleShortfall)} tone={summary.cycleShortfall > 0 ? 'warning' : 'positive'} />
        </InfoGroup>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <InfoGroup title="Colchón GEM">
          <Metric label="Colchón semanal GEM" value={formatMoney(summary.weeklyBuffer)} />
          <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-950">
            Es un buffer semanal para cubrir el posible desvío de pagos hacia planes largos con mínimos obligatorios.
          </p>
        </InfoGroup>

        <InfoGroup title="Pago semanal seguro">
          <Metric label="Recomendado interest-free + colchón GEM" value={formatMoney(summary.suggestedSafeWeeklyPayment)} tone="warning" />
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            GEM puede aplicar parte de tus pagos a planes largos. Este colchón reduce el riesgo de que el pago requerido suba cuando actualices saldos.
          </p>
        </InfoGroup>
      </div>

      {summary.plans.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {summary.plans.map((plan) => (
            <div key={plan.id} className="flex flex-col gap-1 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold text-stone-900">{plan.name}</span>
              <span className="text-stone-600">Mínimo mensual estimado: <strong className="text-stone-950">{formatMoney(plan.monthlyMinimum)}</strong></span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        GEM aplica pagos según su criterio. Actualizá saldos cuando impacten.
      </p>
    </section>
  );
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-stone-50',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-950">{value}</p>
    </div>
  );
}

function InfoGroup({ title, children }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
