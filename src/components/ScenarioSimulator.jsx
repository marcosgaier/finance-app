import React, { useMemo, useState } from 'react';
import { calculateWeeklyDebtReserve, formatMoney, simulatePaymentScenario } from '../utils/financeEngine.js';

const presetPayments = [200, 280, 350];

export function ScenarioSimulator({ financeData }) {
  const [weeklyPayment, setWeeklyPayment] = useState(280);
  const scenarioPlans = useMemo(() => simulatePaymentScenario(financeData, weeklyPayment), [financeData, weeklyPayment]);
  const weeklySummary = useMemo(() => calculateWeeklyDebtReserve(financeData), [financeData]);
  const weeklyGemBuffer = Number(weeklySummary.gemMinimumSummary?.weeklyBuffer || 0);
  const minimumSafeWeeklyPayment = Number(weeklySummary.minimumToAvoidExpiry || 0) + weeklyGemBuffer;
  const extraSuggestedPayment = Math.max(
    0,
    Number(weeklySummary.recommendedPayment || 0) - Number(weeklySummary.minimumToAvoidExpiry || 0),
  );
  const totalRecommendedPayment = minimumSafeWeeklyPayment + extraSuggestedPayment;
  const safeMinimumGap = Math.max(0, minimumSafeWeeklyPayment - weeklyPayment);
  const amountAboveSafeMinimum = Math.max(0, weeklyPayment - minimumSafeWeeklyPayment);
  const recommendedGap = Math.max(0, totalRecommendedPayment - weeklyPayment);
  const amountAboveRecommended = Math.max(0, weeklyPayment - totalRecommendedPayment);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Simulador</h2>
          <p className="text-sm text-stone-500">Probá pagos semanales y mirá cómo cubren mínimo y extra sugerido.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presetPayments.map((amount) => (
            <button
              key={amount}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                weeklyPayment === amount ? 'border-stone-950 bg-stone-950 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
              }`}
              type="button"
              onClick={() => setWeeklyPayment(amount)}
            >
              {formatMoney(amount)}
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2">
            <span className="text-sm text-stone-500">$</span>
            <input
              className="numeric-input w-20 bg-transparent font-semibold outline-none"
              type="number"
              min="0"
              value={weeklyPayment}
              onChange={(event) => setWeeklyPayment(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-sky-50 p-3 text-sm leading-6 text-sky-900">
        <p>
          Mínimo semanal seguro: <strong>{formatMoney(minimumSafeWeeklyPayment)}</strong>. Extra opcional:{' '}
          <strong>{formatMoney(extraSuggestedPayment)}</strong>. Pago recomendado total:{' '}
          <strong>{formatMoney(totalRecommendedPayment)}</strong>.
        </p>
        <p className="mt-2">
          {safeMinimumGap > 0
            ? `Con ${formatMoney(weeklyPayment)}, te faltarían ${formatMoney(safeMinimumGap)} para cubrir el mínimo semanal seguro.`
            : `Con ${formatMoney(weeklyPayment)}, cubrirías el mínimo semanal seguro de ${formatMoney(minimumSafeWeeklyPayment)}.`}
        </p>
        {safeMinimumGap === 0 ? (
          <p>Te quedarían {formatMoney(amountAboveSafeMinimum)} por encima del mínimo seguro.</p>
        ) : null}
        <p>
          {recommendedGap > 0
            ? `Te faltarían ${formatMoney(recommendedGap)} para llegar al recomendado total de ${formatMoney(totalRecommendedPayment)}.`
            : `Te quedarían ${formatMoney(amountAboveRecommended)} por encima del recomendado total.`}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="py-2 pr-3 font-semibold">Plan</th>
              <th className="py-2 pr-3 font-semibold">Estado</th>
              <th className="py-2 pr-3 font-semibold">Pago simulado</th>
              <th className="py-2 pr-3 font-semibold">Saldo proyectado</th>
              <th className="py-2 pr-3 font-semibold">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {scenarioPlans.map((plan) => (
              <tr key={plan.id} className="border-b border-stone-100">
                <td className="py-3 pr-3 font-semibold text-stone-900">{plan.name}</td>
                <td className="py-3 pr-3 text-stone-600">{plan.urgencyLabel}</td>
                <td className="py-3 pr-3 text-stone-900">{formatMoney(plan.scenarioPayment)}</td>
                <td className="py-3 pr-3 text-stone-600">{formatMoney(plan.projectedBalance)}</td>
                <td className="py-3 pr-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.coveredThisWeek ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {plan.coveredThisWeek ? 'Cubierto' : 'Parcial'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
