import React from 'react';
import { formatShortDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

export function CardSummary({ cards }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-stone-950">Resumen por tarjeta</h2>
        <p className="text-sm text-stone-500">Vista rápida de presión semanal y próximos vencimientos.</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-stone-950">{card.name}</h3>
                <p className="text-xs text-stone-500">{card.planCount} plan{card.planCount === 1 ? '' : 'es'}</p>
              </div>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: card.color || '#0f172a' }} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric label="Saldo" value={formatMoney(card.totalBalance)} />
              <MiniMetric label="Mínimo" value={formatMoney(card.minimumPayment)} />
              <MiniMetric label="Recomendado" value={formatMoney(card.recommendedPayment)} />
              <MiniMetric
                label="Próximo"
                value={card.nextDueDate ? formatShortDate(card.nextDueDate) : 'Sin fecha'}
              />
            </div>

            {card.nextDuePlanName ? (
              <p className="mt-3 rounded-md bg-white p-2 text-xs leading-5 text-stone-600">
                {card.nextDuePlanName} vence {card.nextDueWeeks < 0 ? 'atrasado' : `en ${card.nextDueWeeks} semana${card.nextDueWeeks === 1 ? '' : 's'}`}.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">{value}</p>
    </div>
  );
}
