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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Pago por vencimientos interest-free" value={formatMoney(summary.interestFreeRecommendedPayment)} />
        <Metric label="Colchón GEM por mínimos" value={formatMoney(summary.weeklyBuffer)} />
        <Metric label="Pago semanal seguro sugerido" value={formatMoney(summary.suggestedSafeWeeklyPayment)} tone="warning" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Mínimo GEM del ciclo" value={formatMoney(summary.monthlyMinimumTotal)} />
        <Metric label="Pagos GEM registrados" value={formatMoney(summary.paymentsThisCycle)} />
        <Metric label="Faltante GEM estimado" value={formatMoney(summary.cycleShortfall)} tone={summary.cycleShortfall > 0 ? 'warning' : 'positive'} />
        <Metric label="Para cubrir faltante antes del 19" value={formatMoney(summary.weeklySuggestedPayment)} />
      </div>

      <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3">
        <p className="text-sm leading-6 text-sky-950">
          GEM puede aplicar parte de tus pagos a planes largos. Este colchón reduce el riesgo de que el pago requerido suba cuando actualices saldos.
        </p>
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
