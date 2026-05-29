import React from 'react';
import { formatMoney } from '../utils/financeEngine.js';

function sumAmounts(items = []) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function normalizeCategory(category) {
  if (category === 'supermercado' || category === 'grocery') return 'groceries';
  if (category === 'combustible') return 'fuel';
  if (category === 'otros') return 'other';
  return ['groceries', 'fuel', 'other'].includes(category) ? category : 'other';
}

function calculateTransactionTotals(transactions = []) {
  return transactions.reduce(
    (totals, transaction) => {
      const category = normalizeCategory(transaction.category);
      const amount = Number(transaction.amount || 0);

      return {
        ...totals,
        [category]: totals[category] + amount,
        total: totals.total + amount,
      };
    },
    { groceries: 0, fuel: 0, other: 0, total: 0 },
  );
}

export function WeeklyActionPlan({ financeData, weeklySummary }) {
  const activeWeek = financeData.activeWeek || null;
  const extraIncomeTotal = sumAmounts(activeWeek?.extraIncome || []);
  const usedWeeklyIncome = Number(weeklySummary.weeklyIncome || 0);
  const totalIncome = usedWeeklyIncome + extraIncomeTotal;
  const fixedReserve = Number(weeklySummary.fixedTotal || 0);
  const variableBudget = Number(weeklySummary.groceries || 0) + Number(weeklySummary.fuel || 0);
  const weeklyGemBuffer = Number(weeklySummary.gemMinimumSummary?.weeklyBuffer || 0);
  const minimumSafeWeeklyPayment = Number(weeklySummary.minimumToAvoidExpiry || 0) + weeklyGemBuffer;
  const extraSuggestedPayment = Math.max(
    0,
    Number(weeklySummary.recommendedPayment || 0) - Number(weeklySummary.minimumToAvoidExpiry || 0),
  );
  const totalRecommendedPayment = minimumSafeWeeklyPayment + extraSuggestedPayment;
  const debtPayment = minimumSafeWeeklyPayment;
  const estimatedFree = totalIncome - fixedReserve - variableBudget - debtPayment;
  const transactionTotals = calculateTransactionTotals(activeWeek?.variableTransactions || []);
  const actualDebtPayments = sumAmounts(activeWeek?.payments || []);
  const actualRemaining = totalIncome - fixedReserve - transactionTotals.total - actualDebtPayments;

  return (
    <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Plan de esta semana</p>
          <h2 className="mt-1 text-xl font-bold text-stone-950">Hoy cobré. ¿Qué hago con la plata?</h2>
        </div>
        <div className={`rounded-md border px-3 py-2 ${estimatedFree >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Te queda estimado</p>
          <p className="text-lg font-bold text-stone-950">{formatMoney(estimatedFree)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <ActionStep
          label="Ingreso usado esta semana"
          value={formatMoney(totalIncome)}
          helper={
            extraIncomeTotal > 0
              ? `Ingreso principal ${formatMoney(usedWeeklyIncome)} + extras ${formatMoney(extraIncomeTotal)}.`
              : 'Ingreso real cobrado si existe; si no, ingreso base esperado.'
          }
        />
        <ActionStep
          label="Separá"
          value={formatMoney(fixedReserve)}
          helper={`Gastos semanales + servicios mensuales prorrateados (${formatMoney(weeklySummary.monthlyReserveWeekly)}).`}
        />
        <ActionStep
          label="Separá"
          value={formatMoney(variableBudget)}
          helper={`Supermercado ${formatMoney(weeklySummary.groceries)} + combustible ${formatMoney(weeklySummary.fuel)}.`}
        />
        <ActionStep
          label="Pagá mínimo seguro"
          value={formatMoney(debtPayment)}
          helper={`Base ${formatMoney(weeklySummary.minimumToAvoidExpiry)} + colchón GEM ${formatMoney(weeklyGemBuffer)}.`}
          tone="warning"
        />
        <ActionStep
          label="Extra opcional"
          value={formatMoney(extraSuggestedPayment)}
          helper={`Si hay margen, el ideal total sería ${formatMoney(totalRecommendedPayment)}.`}
        />
      </div>

      {activeWeek ? (
        <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-900">Ya registrado esta semana</p>
              <p className="mt-1 text-sm text-stone-600">
                Super {formatMoney(transactionTotals.groceries)} · combustible {formatMoney(transactionTotals.fuel)} · otros {formatMoney(transactionTotals.other)} · deudas {formatMoney(actualDebtPayments)}
              </p>
            </div>
            <div className={`rounded-md border px-3 py-2 ${actualRemaining >= 0 ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Margen aproximado</p>
              <p className="text-base font-bold text-stone-950">{formatMoney(actualRemaining)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActionStep({ label, value, helper, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-stone-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-950">{value}</p>
      <p className="mt-2 text-sm leading-5 text-stone-600">{helper}</p>
    </div>
  );
}
