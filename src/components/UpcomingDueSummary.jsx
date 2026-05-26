import React from 'react';
import { formatShortDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

const urgencyStyles = {
  overdue: 'border-red-200 bg-red-50 text-red-800',
  urgent: 'border-rose-200 bg-rose-50 text-rose-800',
  attention: 'border-amber-200 bg-amber-50 text-amber-800',
  calm: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function UpcomingDueSummary({ plans }) {
  const upcomingPlans = plans.slice(0, 4);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Próximos vencimientos</h2>
          <p className="text-sm text-stone-500">Resumen corto de lo más cercano.</p>
        </div>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
          {plans.length} planes
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {upcomingPlans.map((plan) => (
          <article key={plan.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-stone-950">{plan.name}</h3>
                <p className="mt-1 text-xs text-stone-500">
                  {plan.card?.name || 'Sin tarjeta'} · vence {formatShortDate(plan.dueDate)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${urgencyStyles[plan.urgency]}`}>
                {plan.urgencyLabel}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Mínimo" value={formatMoney(plan.recommendedPayment)} />
              <Metric label="Total recomendado" value={formatMoney(plan.totalRecommendedPayment)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">{value}</p>
    </div>
  );
}
