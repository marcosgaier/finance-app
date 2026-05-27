import React, { useEffect, useState } from 'react';
import { formatDateForDisplay, formatShortDate, parseDisplayDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

const urgencyStyles = {
  overdue: 'border-red-200 bg-red-50 text-red-800',
  urgent: 'border-rose-200 bg-rose-50 text-rose-800',
  attention: 'border-amber-200 bg-amber-50 text-amber-800',
  calm: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function PlanList({ plans, cards, onAddPlan, onDeletePlan, onUpdatePlan }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Próximos vencimientos</h2>
          <p className="text-sm text-stone-500">Ordenados por urgencia y fecha.</p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
          Pagos escalonados
        </span>
        <button
          className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          type="button"
          onClick={onAddPlan}
        >
          Agregar plan
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-lg border border-stone-200 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-w-[180px] rounded-md border border-stone-200 px-3 py-2 text-base font-semibold text-stone-950 outline-none focus:border-sky-500"
                    type="text"
                    value={plan.name}
                    onChange={(event) => onUpdatePlan(plan.id, { name: event.target.value })}
                  />
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyStyles[plan.urgency]}`}>
                    {plan.urgencyLabel}
                  </span>
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={() => onDeletePlan(plan.id)}
                  >
                    Eliminar
                  </button>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {plan.card?.name || 'Sin tarjeta'} · vence {formatShortDate(plan.dueDate)} · {plan.weeksUntilDue < 0 ? 'vencido' : `${plan.weeksUntilDue} semanas`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:min-w-[560px]">
                <Metric label="Saldo ajustado" value={formatMoney(plan.adjustedBalance)} />
                <Metric label="Si fuera solo" value={formatMoney(plan.requiredWeeklyPayment)} />
                <Metric label="Mínimo" value={formatMoney(plan.recommendedPayment)} strong />
                <Metric label="Extra sugerido" value={formatMoney(plan.smartExtraPayment)} />
                <Metric label="Total recomendado" value={formatMoney(plan.totalRecommendedPayment)} strong />
                <Metric label="Reserva total" value={formatMoney(plan.rolloverPressure)} strong />
              </div>
            </div>

            <p className="mt-3 rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">{plan.explanation}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <label className="text-sm font-medium text-stone-600">
                Tarjeta
                <select
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                  value={plan.cardId}
                  onChange={(event) => onUpdatePlan(plan.id, { cardId: event.target.value })}
                >
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-stone-600">
                Monto total original
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                  type="number"
                  min="0"
                  value={plan.originalAmount ?? plan.balance}
                  onChange={(event) => onUpdatePlan(plan.id, { originalAmount: Number(event.target.value) })}
                />
              </label>
              <label className="text-sm font-medium text-stone-600">
                Saldo actual
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                  type="number"
                  min="0"
                  value={plan.balance}
                  onChange={(event) => onUpdatePlan(plan.id, { balance: Number(event.target.value) })}
                />
              </label>
              <label className="text-sm font-medium text-stone-600">
                Fecha de vencimiento
                <DateField value={plan.dueDate} onChange={(nextDate) => onUpdatePlan(plan.id, { dueDate: nextDate })} />
              </label>
              <label className="text-sm font-medium text-stone-600">
                Pago de terceros
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                  type="number"
                  min="0"
                  value={plan.thirdPartyContribution}
                  onChange={(event) => onUpdatePlan(plan.id, { thirdPartyContribution: Number(event.target.value) })}
                />
              </label>
            </div>

            <MinimumPaymentRuleEditor
              rule={plan.minimumPaymentRule}
              onChange={(minimumPaymentRule) => onUpdatePlan(plan.id, { minimumPaymentRule })}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function MinimumPaymentRuleEditor({ rule, onChange }) {
  const enabled = Boolean(rule?.enabled);
  const type = rule?.type || 'percentageOrFixedMinimum';

  function enableRule() {
    onChange({
      enabled: true,
      type: 'percentageOrFixedMinimum',
      percentage: 0.03,
      fixedMinimum: 20,
      frequency: 'monthly',
    });
  }

  function updateRule(patch) {
    if (!enabled) return;
    onChange({
      ...rule,
      ...patch,
      frequency: 'monthly',
    });
  }

  function updateRuleType(nextType) {
    if (nextType === 'fixedMonthlyMinimum') {
      onChange({
        enabled: true,
        type: 'fixedMonthlyMinimum',
        amount: Number(rule?.amount || 50),
        frequency: 'monthly',
      });
      return;
    }

    onChange({
      enabled: true,
      type: 'percentageOrFixedMinimum',
      percentage: Number(rule?.percentage || 0.03),
      fixedMinimum: Number(rule?.fixedMinimum || 20),
      frequency: 'monthly',
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-stone-900">Mínimo obligatorio mensual</h4>
          <p className="text-xs text-stone-500">Solo activalo si GEM muestra mínimo mensual para este plan.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
          <input
            className="h-4 w-4 accent-teal-700"
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              if (event.target.checked) enableRule();
              else onChange(null);
            }}
          />
          Tiene mínimo
        </label>
      </div>

      {enabled ? (
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-stone-600">
            Tipo
            <select
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              value={type}
              onChange={(event) => updateRuleType(event.target.value)}
            >
              <option value="percentageOrFixedMinimum">Porcentaje o mínimo fijo</option>
              <option value="fixedMonthlyMinimum">Monto fijo mensual</option>
            </select>
          </label>

          {type === 'percentageOrFixedMinimum' ? (
            <>
              <label className="text-sm font-medium text-stone-600">
                Porcentaje
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                  min="0"
                  step="0.1"
                  type="number"
                  value={Number(rule?.percentage || 0) * 100}
                  onChange={(event) => updateRule({ percentage: Number(event.target.value || 0) / 100 })}
                />
              </label>
              <label className="text-sm font-medium text-stone-600">
                Mínimo fijo
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                  min="0"
                  type="number"
                  value={rule?.fixedMinimum || 0}
                  onChange={(event) => updateRule({ fixedMinimum: Number(event.target.value || 0) })}
                />
              </label>
            </>
          ) : (
            <label className="text-sm font-medium text-stone-600">
              Monto mensual
              <input
                className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
                min="0"
                type="number"
                value={rule?.amount || 0}
                onChange={(event) => updateRule({ amount: Number(event.target.value || 0) })}
              />
            </label>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DateField({ value, onChange }) {
  const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value));

  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value));
  }, [value]);

  function handleChange(nextValue) {
    setDisplayValue(nextValue);
    const nextDate = parseDisplayDate(nextValue);
    if (nextDate) onChange(nextDate);
  }

  return (
    <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
      <input
        className="w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        type="text"
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
      />
      <input
        aria-label="Elegir fecha"
        className="w-12 rounded-md border border-stone-200 bg-white px-2 py-2 text-stone-700 outline-none focus:border-sky-500"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Metric({ label, value, strong = false }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-bold text-stone-950' : 'font-semibold text-stone-800'}`}>{value}</p>
    </div>
  );
}
