import React from 'react';
import { formatShortDate } from '../utils/dateUtils.js';
import { formatActionMoney, formatMoney } from '../utils/financeEngine.js';

export function CardSummary({ cards, gemMinimumSummary }) {
  const gemCardIds = new Set(gemMinimumSummary?.cardIds || []);
  const gemWeeklyBuffer = Number(gemMinimumSummary?.weeklyBuffer || 0);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-stone-950">Resumen por tarjeta</h2>
        <p className="text-sm text-stone-500">
          Vista rápida de cuánto necesita cada tarjeta para llegar a sus vencimientos.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const isGemCard = gemCardIds.has(card.id);
          const minimumPayment = Number(card.minimumPayment || 0);
          const cardGemBuffer = isGemCard ? gemWeeklyBuffer : 0;
          const safeMinimum = minimumPayment + cardGemBuffer;
          const accelerationReference = Number(card.recommendedPayment || 0) + cardGemBuffer;
          const showAccelerationReference = accelerationReference > safeMinimum + 0.009;

          return (
            <article key={card.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-stone-950">{card.name}</h3>
                  <p className="text-xs text-stone-500">{card.planCount} obligaci{card.planCount === 1 ? 'ón' : 'ones'}</p>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: card.color || '#0f172a' }} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniMetric label="Saldo" value={formatMoney(card.totalBalance)} />
                <MiniMetric label="Necesario vencimientos" value={formatActionMoney(minimumPayment)} />
                {isGemCard ? (
                  <MiniMetric label="Colchón GEM" value={formatActionMoney(cardGemBuffer)} />
                ) : (
                  <MiniMetric label="Colchón GEM" value="No aplica" muted />
                )}
                <MiniMetric
                  label={isGemCard ? 'Piso GEM esta semana' : 'Piso esta tarjeta'}
                  value={formatActionMoney(safeMinimum)}
                  strong
                />
                <MiniMetric
                  label="Próximo"
                  value={card.nextDueDate ? formatShortDate(card.nextDueDate) : 'Sin fecha'}
                />
                <MiniMetric
                  label="Para acelerar"
                  value={showAccelerationReference ? formatActionMoney(accelerationReference) : 'Manual'}
                  muted={!showAccelerationReference}
                />
              </div>

              <p className="mt-3 rounded-md bg-white p-2 text-xs leading-5 text-stone-600">
                {isGemCard
                  ? 'GEM incluye colchón porque puede aplicar parte del pago a planes largos.'
                  : 'Este piso mira solo vencimientos cargados para esta tarjeta.'}
                {card.nextDuePlanName ? (
                  <>
                    {' '}
                    {card.nextDuePlanName} vence{' '}
                    {card.nextDueWeeks < 0 ? 'atrasado' : `en ${card.nextDueWeeks} semana${card.nextDueWeeks === 1 ? '' : 's'}`}.
                  </>
                ) : null}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        Si ya usaste el cobro de esta semana para una tarjeta, revisá manualmente si queda una oportunidad de pago menos antes del vencimiento.
      </p>
    </section>
  );
}

function MiniMetric({ label, value, strong = false, muted = false }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-bold text-stone-950' : 'font-semibold'} ${muted ? 'text-stone-500' : 'text-stone-900'}`}>
        {value}
      </p>
    </div>
  );
}
