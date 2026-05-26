import React, { useMemo, useState } from 'react';
import { formatMoney, simulatePaymentScenario } from '../utils/financeEngine.js';

const presetPayments = [200, 280, 350];

export function ScenarioSimulator({ financeData }) {
  const [weeklyPayment, setWeeklyPayment] = useState(280);
  const scenarioPlans = useMemo(() => simulatePaymentScenario(financeData, weeklyPayment), [financeData, weeklyPayment]);
  const allocatedTotal = scenarioPlans.reduce((total, plan) => total + plan.scenarioPayment, 0);

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

      <div className="mt-4 rounded-md bg-sky-50 p-3 text-sm text-sky-900">
        De {formatMoney(weeklyPayment)}, el motor asigna {formatMoney(allocatedTotal)} esta semana y deja {formatMoney(Math.max(0, weeklyPayment - allocatedTotal))} sin usar.
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
