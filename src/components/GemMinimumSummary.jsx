import React, { useState } from 'react';
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

      <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">¿Cuánto debería pagar esta semana?</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
          <Metric
            label="Pago semanal seguro"
            value={formatMoney(summary.minimumSafeWeeklyPayment)}
            helper="El piso serio para esta semana."
            tone="strong"
          />
          <Metric
            label="Pago recomendado total"
            value={formatMoney(summary.totalRecommendedPayment)}
            helper="Ideal si tenés margen."
          />
          <Metric
            label="Extra opcional"
            value={formatMoney(summary.extraSuggestedPayment)}
            helper="Acelerador, no obligación."
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <p>
          Se arma con una base interest-free de <strong>{formatMoney(summary.minimumToAvoidExpiry)}</strong>, un colchón GEM de{' '}
          <strong>{formatMoney(summary.weeklyBuffer)}</strong> y un extra opcional de{' '}
          <strong>{formatMoney(summary.extraSuggestedPayment)}</strong>.
        </p>
        <p className="mt-2">
          GEM puede aplicar parte de tus pagos a planes largos. Este colchón reduce el riesgo de que el pago requerido suba cuando actualices saldos.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <CollapsibleDetail
          title="Detalle interest-free"
          summary={`Base ${formatMoney(summary.minimumToAvoidExpiry)} · extra ${formatMoney(summary.extraSuggestedPayment)}`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Mínimo base semanal" value={formatMoney(summary.minimumToAvoidExpiry)} />
            <Metric label="Extra opcional" value={formatMoney(summary.extraSuggestedPayment)} />
          </div>
        </CollapsibleDetail>

        <CollapsibleDetail title="Estado del ciclo GEM" summary={`Faltante ${formatMoney(summary.cycleShortfall)}`} defaultOpen>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Mínimo mensual del ciclo" value={formatMoney(summary.monthlyMinimumTotal)} />
            <Metric label="Pagos registrados del ciclo" value={formatMoney(summary.paymentsThisCycle)} />
            <Metric
              label="Faltante del ciclo"
              value={formatMoney(summary.cycleShortfall)}
              tone={summary.cycleShortfall > 0 ? 'warning' : 'positive'}
            />
          </div>
        </CollapsibleDetail>

        <CollapsibleDetail
          title="Planes con mínimos obligatorios"
          summary={`${summary.plans.length} plan${summary.plans.length === 1 ? '' : 'es'}`}
        >
          {summary.plans.length > 0 ? (
            <div className="grid gap-2">
              {summary.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-1 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-stone-900">{plan.name}</span>
                  <span className="text-stone-600">
                    Mínimo mensual estimado: <strong className="text-stone-950">{formatMoney(plan.monthlyMinimum)}</strong>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              No hay planes GEM con mínimo obligatorio cargado.
            </p>
          )}
        </CollapsibleDetail>
      </div>

      <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        GEM aplica pagos según su criterio. Actualizá saldos cuando impacten.
      </p>
    </section>
  );
}

function Metric({ label, value, helper, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-stone-50',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    strong: 'border-teal-300 bg-white shadow-sm',
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-950">{value}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-stone-500">{helper}</p> : null}
    </div>
  );
}

function CollapsibleDetail({ title, summary, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <button
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>
          <span className="block text-sm font-semibold uppercase tracking-wide text-stone-700">{title}</span>
          <span className="mt-1 block text-sm text-stone-500">{summary}</span>
        </span>
        <span className="shrink-0 rounded-full border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600">
          {isOpen ? 'Ocultar' : 'Ver'}
        </span>
      </button>
      {isOpen ? <div className="border-t border-stone-200 p-3">{children}</div> : null}
    </div>
  );
}
