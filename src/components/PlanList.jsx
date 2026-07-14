import React, { useEffect, useState } from 'react';
import { formatDateForDisplay, formatShortDate, parseDisplayDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

const urgencyStyles = {
  overdue: 'border-red-200 bg-red-50 text-red-800',
  urgent: 'border-rose-200 bg-rose-50 text-rose-800',
  attention: 'border-amber-200 bg-amber-50 text-amber-800',
  calm: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

const coverageStyles = {
  covered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  tight: 'border-amber-200 bg-amber-50 text-amber-800',
  'at-risk': 'border-orange-200 bg-orange-50 text-orange-800',
  overdue: 'border-red-200 bg-red-50 text-red-800',
  unknown: 'border-stone-200 bg-stone-50 text-stone-700',
};

export function PlanList({ plans = [], completedPlans = [], cards, onAddPlan, onDeletePlan, onUpdatePlan }) {
  const [expandedPlanIds, setExpandedPlanIds] = useState({});
  const [editingPlanIds, setEditingPlanIds] = useState({});
  const [priorityDetailsInitialized, setPriorityDetailsInitialized] = useState(false);
  const [completedPlansOpen, setCompletedPlansOpen] = useState(false);

  useEffect(() => {
    if (priorityDetailsInitialized || plans.length === 0) return;

    setExpandedPlanIds(
      Object.fromEntries(plans.filter((plan) => isPriorityPlan(plan)).map((plan) => [plan.id, true])),
    );
    setPriorityDetailsInitialized(true);
  }, [plans, priorityDetailsInitialized]);

  function collapseAll() {
    setExpandedPlanIds({});
    setEditingPlanIds({});
    setCompletedPlansOpen(false);
  }

  function expandPriorityPlans() {
    setExpandedPlanIds(
      Object.fromEntries(plans.filter((plan) => isPriorityPlan(plan)).map((plan) => [plan.id, true])),
    );
    setEditingPlanIds({});
  }

  function togglePlanDetail(planId) {
    setExpandedPlanIds((currentIds) => ({
      ...currentIds,
      [planId]: !currentIds[planId],
    }));
  }

  function togglePlanEditor(planId) {
    setEditingPlanIds((currentIds) => ({
      ...currentIds,
      [planId]: !currentIds[planId],
    }));
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Planes activos</h2>
          <p className="text-sm text-stone-500">Vencimientos ordenados por urgencia y fecha.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
            type="button"
            onClick={collapseAll}
          >
            Contraer todos
          </button>
          <button
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:border-amber-500"
            type="button"
            onClick={expandPriorityPlans}
          >
            Expandir urgentes
          </button>
          <button
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
            type="button"
            onClick={onAddPlan}
          >
            Agregar plan
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {plans.map((plan) => {
          const priorityPlan = isPriorityPlan(plan);
          const detailVisible = Boolean(expandedPlanIds[plan.id]);
          const editorVisible = Boolean(editingPlanIds[plan.id]);

          return (
            <article key={plan.id} className="rounded-lg border border-stone-200 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-stone-950">{plan.name}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyStyles[plan.urgency]}`}>
                      {plan.urgencyLabel}
                    </span>
                    {plan.coverageStatus ? (
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${coverageStyles[plan.coverageStatus]}`}>
                        Cobertura: {plan.coverageLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {plan.card?.name || 'Sin tarjeta'} · vence {formatShortDate(plan.dueDate)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                  <Metric label="Tarjeta" value={plan.card?.name || 'Sin tarjeta'} />
                  <Metric label="Saldo ajustado" value={formatMoney(plan.adjustedBalance)} />
                  <Metric label="Vencimiento" value={formatShortDate(plan.dueDate)} />
                  <Metric label="Tiempo" value={plan.urgencyLabel} strong />
                </div>
              </div>

              {detailVisible ? <PlanDetail plan={plan} compact={!priorityPlan} /> : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
                  type="button"
                  onClick={() => togglePlanDetail(plan.id)}
                >
                  {expandedPlanIds[plan.id] ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
                <button
                  className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:border-sky-400"
                  type="button"
                  onClick={() => togglePlanEditor(plan.id)}
                >
                  {editorVisible ? 'Cerrar edición' : 'Editar'}
                </button>
                <button
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  onClick={() => onDeletePlan(plan.id)}
                >
                  Eliminar
                </button>
              </div>

              {editorVisible ? (
                <PlanEditor
                  cards={cards}
                  plan={plan}
                  onUpdatePlan={(patch) => onUpdatePlan(plan.id, patch)}
                />
              ) : null}
            </article>
          );
        })}
        {plans.length === 0 ? (
          <p className="rounded-md border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            No hay planes activos pendientes.
          </p>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50">
        <button
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
          type="button"
          onClick={() => setCompletedPlansOpen((currentValue) => !currentValue)}
        >
          <span>
            <span className="block text-sm font-semibold uppercase tracking-wide text-stone-700">Planes completados</span>
            <span className="mt-1 block text-sm text-stone-500">
              {completedPlans.length} plan{completedPlans.length === 1 ? '' : 'es'} con saldo en cero.
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700">
            {completedPlansOpen ? 'Ocultar' : 'Ver'}
          </span>
        </button>

        {completedPlansOpen ? (
          <div className="grid gap-3 border-t border-stone-200 p-4">
            {completedPlans.length > 0 ? (
              completedPlans.map((plan) => {
                const editorVisible = Boolean(editingPlanIds[plan.id]);

                return (
                  <article key={plan.id} className="rounded-lg border border-emerald-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-stone-950">{plan.name}</h3>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            Completado
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">{plan.card?.name || 'Sin tarjeta'}</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
                        <Metric label="Tarjeta" value={plan.card?.name || 'Sin tarjeta'} />
                        <Metric label="Saldo actual" value={formatMoney(plan.balance)} />
                        <Metric label="Estado" value="Completado" strong />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:border-sky-400"
                        type="button"
                        onClick={() => togglePlanEditor(plan.id)}
                      >
                        {editorVisible ? 'Cerrar edición' : 'Editar'}
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                        type="button"
                        onClick={() => onDeletePlan(plan.id)}
                      >
                        Eliminar
                      </button>
                    </div>

                    {editorVisible ? (
                      <PlanEditor
                        cards={cards}
                        plan={plan}
                        onUpdatePlan={(patch) => onUpdatePlan(plan.id, patch)}
                      />
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="rounded-md border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">
                Todavía no hay planes completados.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function isPriorityPlan(plan) {
  return plan.urgency === 'overdue' || plan.urgency === 'urgent' || plan.urgency === 'attention';
}

function PlanDetail({ plan }) {
  const sharedCoverage = (plan.coverageGroupPlanIds || []).length > 1;

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={plan.weeksUntilDue < 0 ? 'Vencido' : 'Semanas restantes'}
          value={plan.weeksUntilDue < 0 ? 'Atrasado' : `${plan.weeksUntilDue}`}
        />
        <Metric label="Mínimo para no vencer" value={formatMoney(plan.recommendedPayment)} strong />
        <Metric label="Recomendado" value={formatMoney(plan.totalRecommendedPayment)} strong />
        <Metric label="Reserva total" value={formatMoney(plan.rolloverPressure)} />
      </div>
      {plan.coverageStatus ? (
        <div className="mt-3 rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-700">
          <p>
            <strong>Cobertura al vencimiento:</strong> {plan.coverageLabel}.
          </p>
          {plan.coverageGap > 0 ? (
            <p>Faltan {formatMoney(plan.coverageGap)} acumulados hasta esta fecha.</p>
          ) : plan.surplusWeeks !== null ? (
            <p>Margen proyectado: {formatMoney(plan.coverageSurplus)} ({plan.surplusWeeks.toFixed(1)} semana{plan.surplusWeeks === 1 ? '' : 's'}).</p>
          ) : null}
          {sharedCoverage ? (
            <p className="text-xs text-stone-500">Este resultado considera todos los planes que vencen hasta esta fecha.</p>
          ) : (
            <p className="text-xs text-stone-500">Este resultado es acumulado hasta esta fecha, no una asignaci�n exclusiva del plan.</p>
          )}
        </div>
      ) : null}
      <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-stone-700">{plan.explanation}</p>
    </div>
  );
}

function PlanEditor({ cards, plan, onUpdatePlan }) {
  return (
    <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/40 p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-medium text-stone-600 xl:col-span-2">
          Nombre del plan
          <input
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
            type="text"
            value={plan.name}
            onChange={(event) => onUpdatePlan({ name: event.target.value })}
          />
        </label>
        <label className="text-sm font-medium text-stone-600">
          Tarjeta
          <select
            className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
            value={plan.cardId}
            onChange={(event) => onUpdatePlan({ cardId: event.target.value })}
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
            onChange={(event) => onUpdatePlan({ originalAmount: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm font-medium text-stone-600">
          Saldo actual
          <input
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
            type="number"
            min="0"
            value={plan.balance}
            onChange={(event) => onUpdatePlan({ balance: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm font-medium text-stone-600">
          Pago de terceros
          <input
            className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 outline-none focus:border-sky-500"
            type="number"
            min="0"
            value={plan.thirdPartyContribution}
            onChange={(event) => onUpdatePlan({ thirdPartyContribution: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm font-medium text-stone-600 xl:col-span-2">
          Fecha de vencimiento
          <DateField value={plan.dueDate} onChange={(nextDate) => onUpdatePlan({ dueDate: nextDate })} />
        </label>
      </div>

      <MinimumPaymentRuleEditor
        rule={plan.minimumPaymentRule}
        onChange={(minimumPaymentRule) => onUpdatePlan({ minimumPaymentRule })}
      />
    </div>
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
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-bold text-stone-950' : 'font-semibold text-stone-800'}`}>{value}</p>
    </div>
  );
}
