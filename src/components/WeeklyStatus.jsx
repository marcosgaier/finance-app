import React from 'react';
import { formatShortDate } from '../utils/dateUtils.js';

const toneStyles = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
};

export function WeeklyStatus({ summary, statusOverride }) {
  const nextPlan = summary.plans.find((plan) => plan.adjustedBalance > 0);
  const status = statusOverride || summary.weeklyStatus;

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${toneStyles[status.tone]}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide opacity-75">Estado semanal</p>
          <h2 className="mt-1 text-2xl font-bold">{status.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">{status.message}</p>
        </div>
        {nextPlan ? (
          <div className="rounded-md border border-current/20 bg-white/60 p-3 text-sm">
            <p className="font-semibold">Próximo vencimiento</p>
            <p className="mt-1">
              {nextPlan.name} · {formatShortDate(nextPlan.dueDate)}
            </p>
            <p className="mt-1 opacity-75">
              {nextPlan.weeksUntilDue < 0 ? 'Atrasado' : `${nextPlan.weeksUntilDue} semana${nextPlan.weeksUntilDue === 1 ? '' : 's'}`}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
