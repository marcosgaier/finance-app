import React, { useMemo, useState } from 'react';
import { formatMoney } from '../utils/financeEngine.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function WeeklyTracker({ financeData, weeklySummary, onDeleteWeek, onIncomeChange, onSaveWeek }) {
  const [weekDate, setWeekDate] = useState(getTodayIsoDate());
  const [cardPaymentDrafts, setCardPaymentDrafts] = useState({});

  const totalPaid = useMemo(
    () => Object.values(cardPaymentDrafts).reduce((total, amount) => total + Number(amount || 0), 0),
    [cardPaymentDrafts],
  );
  const minimumDifference = totalPaid - weeklySummary.minimumToAvoidExpiry;
  const recommendedDifference = totalPaid - weeklySummary.recommendedPayment;
  const marginAfterChosenPayment = weeklySummary.availableForDebt - totalPaid;
  const chosenPaymentMessage = buildChosenPaymentMessage({
    totalPaid,
    minimumDifference,
    recommendedDifference,
    marginAfterChosenPayment,
    weeklySummary,
  });
  const latestRecords = [...(financeData.weeklyRecords || [])].slice(-4).reverse();
  const cardSummaries = financeData.cards.map((card) => {
    const plans = weeklySummary.plans.filter((plan) => plan.cardId === card.id);
    return {
      ...card,
      minimumPayment: plans.reduce((total, plan) => total + Number(plan.recommendedPayment || 0), 0),
      recommendedPayment: plans.reduce((total, plan) => total + Number(plan.totalRecommendedPayment || 0), 0),
    };
  });

  function updateCardPayment(cardId, amount) {
    setCardPaymentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [cardId]: Number(amount),
    }));
  }

  function fillCardPayments(amountKey) {
    const nextDrafts = Object.fromEntries(
      cardSummaries.map((card) => [card.id, Number(card[amountKey] || 0).toFixed(2)]),
    );
    setCardPaymentDrafts(nextDrafts);
  }

  function saveWeek() {
    const payments = cardSummaries
      .map((card) => ({
        cardId: card.id,
        cardName: card.name,
        amount: Number(cardPaymentDrafts[card.id] || 0),
      }))
      .filter((payment) => payment.amount > 0);

    onSaveWeek({
      id: `week-${Date.now()}`,
      weekDate,
      income: Number(financeData.weeklyIncome || 0),
      payments,
      totalPaid,
      minimumToAvoidExpiry: weeklySummary.minimumToAvoidExpiry,
      recommendedPayment: weeklySummary.recommendedPayment,
      createdAt: new Date().toISOString(),
    });
    setCardPaymentDrafts({});
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Control de la semana</h2>
          <p className="text-sm text-stone-500">Registrá lo que cobraste y cuánto pagaste por tarjeta. Después actualizá los saldos de cada plan cuando la tarjeta los muestre.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-medium text-stone-600">
            Fecha
            <input
              className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
              type="date"
              value={weekDate}
              onChange={(event) => setWeekDate(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-stone-600">
            Cobré esta semana
            <span className="mt-1 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
              <span className="text-stone-400">$</span>
              <input
                className="numeric-input min-w-0 flex-1 bg-transparent font-semibold outline-none"
                type="number"
                min="0"
                value={financeData.weeklyIncome}
                onChange={(event) => onIncomeChange(Number(event.target.value))}
              />
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SummaryTile label="Mínimo para no vencer" value={weeklySummary.minimumToAvoidExpiry} />
        <SummaryTile label="Pago inteligente" value={weeklySummary.recommendedPayment} />
        <SummaryTile
          label={minimumDifference >= 0 ? 'Diferencia a favor' : 'Te falta cubrir'}
          value={Math.abs(minimumDifference)}
          tone={minimumDifference >= 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Pago elegido esta semana</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <SummaryTile label="Elegido" value={totalPaid} />
          <SummaryTile
            label={minimumDifference >= 0 ? 'Sobre el mínimo' : 'Falta para mínimo'}
            value={Math.abs(minimumDifference)}
            tone={minimumDifference >= 0 ? 'positive' : 'warning'}
          />
          <SummaryTile
            label={marginAfterChosenPayment >= 0 ? 'Margen después de pagar' : 'Exceso sobre disponible'}
            value={Math.abs(marginAfterChosenPayment)}
            tone={marginAfterChosenPayment >= 0 ? 'positive' : 'warning'}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-sky-950">{chosenPaymentMessage}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
          type="button"
          onClick={() => fillCardPayments('minimumPayment')}
        >
          Cargar mínimos
        </button>
        <button
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
          type="button"
          onClick={() => fillCardPayments('recommendedPayment')}
        >
          Cargar recomendado
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="py-2 pr-3 font-semibold">Tarjeta</th>
              <th className="py-2 pr-3 font-semibold">Mínimo</th>
              <th className="py-2 pr-3 font-semibold">Recomendado</th>
              <th className="py-2 pr-3 font-semibold">Pagado esta semana</th>
            </tr>
          </thead>
          <tbody>
            {cardSummaries.map((card) => (
              <tr key={card.id} className="border-b border-stone-100">
                <td className="py-3 pr-3 font-semibold text-stone-900">{card.name}</td>
                <td className="py-3 pr-3 text-stone-600">{formatMoney(card.minimumPayment)}</td>
                <td className="py-3 pr-3 text-stone-600">{formatMoney(card.recommendedPayment)}</td>
                <td className="py-3 pr-3">
                  <span className="flex max-w-40 items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
                    <span className="text-stone-400">$</span>
                    <input
                      className="numeric-input min-w-0 flex-1 bg-transparent font-semibold outline-none"
                      type="number"
                      min="0"
                      value={cardPaymentDrafts[card.id] || ''}
                      onChange={(event) => updateCardPayment(card.id, event.target.value)}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        Estos pagos quedan como historial por tarjeta. Los saldos de los planes se editan manualmente cuando GEM, Purple u otra tarjeta actualicen cómo aplicaron el pago.
      </p>

      <div className="mt-4 flex flex-col gap-3 border-t border-stone-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-stone-600">
          Total cargado: <strong className="text-stone-950">{formatMoney(totalPaid)}</strong>
        </p>
        <button
          className="w-fit rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          type="button"
          onClick={saveWeek}
        >
          Guardar semana
        </button>
      </div>

      {latestRecords.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-stone-900">Últimas semanas guardadas</h3>
          <div className="mt-2 grid gap-2">
            {latestRecords.map((record) => (
              <div key={record.id} className="flex flex-col gap-2 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <strong className="text-stone-950">{record.weekDate}</strong> · Cobrado {formatMoney(record.income)} · Pagado {formatMoney(record.totalPaid)}
                </p>
                <button
                  className="w-fit rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(`¿Eliminar la semana del ${record.weekDate}?`);
                    if (confirmed) onDeleteWeek(record.id);
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildChosenPaymentMessage({ totalPaid, minimumDifference, recommendedDifference, marginAfterChosenPayment, weeklySummary }) {
  if (totalPaid <= 0) {
    return 'Cargá cuánto pensás pagar por tarjeta y la app te dice si llegás, si quedás corto o si estás acelerando deuda.';
  }

  if (minimumDifference < 0) {
    return `Con ${formatMoney(totalPaid)} quedás ${formatMoney(Math.abs(minimumDifference))} corto para el mínimo. Necesitás compensarlo antes del próximo vencimiento.`;
  }

  if (marginAfterChosenPayment < 0) {
    return `Ese pago cubre el mínimo, pero supera tu disponible para deudas por ${formatMoney(Math.abs(marginAfterChosenPayment))}.`;
  }

  if (recommendedDifference >= 0) {
    return `Cubrís el mínimo y también el pago inteligente. Te quedan ${formatMoney(marginAfterChosenPayment)} libres después de pagar.`;
  }

  return `Cubrís el mínimo para no vencer. Estás pagando ${formatMoney(minimumDifference)} extra sobre el mínimo y te quedan ${formatMoney(marginAfterChosenPayment)} libres.`;
}

function SummaryTile({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-stone-50',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-950">{formatMoney(value)}</p>
    </div>
  );
}
