import React, { useEffect, useMemo, useState } from 'react';
import { formatDisplayDate, formatIsoDate, parseDisplayDate } from '../utils/dateUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

const transactionCategories = [
  { id: 'groceries', label: 'Supermercado' },
  { id: 'fuel', label: 'Combustible' },
  { id: 'other', label: 'Otros' },
];

function getTodayIsoDate() {
  return formatIsoDate(new Date());
}

function getCurrentFinancialWeekStartDate(referenceDate = new Date()) {
  const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const tuesday = 2;
  const daysSinceTuesday = (startDate.getDay() - tuesday + 7) % 7;
  startDate.setDate(startDate.getDate() - daysSinceTuesday);
  return formatIsoDate(startDate);
}

function calculateDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function createEmptyTransaction(date = getTodayIsoDate()) {
  return {
    date,
    description: '',
    category: 'groceries',
    amount: '',
  };
}

function createEmptyExtraIncome(date = getTodayIsoDate()) {
  return {
    date,
    description: '',
    amount: '',
  };
}

function createActiveWeek({ weekStartDate, income, weeklySummary }) {
  const plannedGroceries = Number(weeklySummary.groceries || 0);
  const plannedFuel = Number(weeklySummary.fuel || 0);

  return {
    id: `active-week-${weekStartDate}`,
    weekStartDate,
    weekDate: weekStartDate,
    income: Number(income || 0),
    realIncome: Number(income || 0),
    extraIncome: [],
    variableTransactions: [],
    payments: [],
    note: '',
    plannedGroceries,
    plannedFuel,
    plannedVariableBudget: plannedGroceries + plannedFuel,
    minimumToAvoidExpiry: weeklySummary.minimumToAvoidExpiry,
    recommendedPayment: weeklySummary.recommendedPayment,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function WeeklyTracker({
  financeData,
  weeklySummary,
  onCloseWeek,
  onDeleteWeek,
  onReopenWeek,
  onStartActiveWeek,
  onUpdateActiveWeek,
  onUpdateWeek,
}) {
  const financialWeekStartDate = useMemo(() => getCurrentFinancialWeekStartDate(), []);
  const activeWeek = financeData.activeWeek;
  const [transactionDraft, setTransactionDraft] = useState(createEmptyTransaction(financialWeekStartDate));
  const [extraIncomeDraft, setExtraIncomeDraft] = useState(createEmptyExtraIncome(financialWeekStartDate));
  const [expandedRecordIds, setExpandedRecordIds] = useState({});
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingRecordDraft, setEditingRecordDraft] = useState(null);
  const [dismissedPendingWeekWarning, setDismissedPendingWeekWarning] = useState(false);

  useEffect(() => {
    if (!activeWeek) {
      onStartActiveWeek(
        createActiveWeek({
          weekStartDate: financialWeekStartDate,
          income: financeData.weeklyIncome,
          weeklySummary,
        }),
      );
    }
  }, [activeWeek, financeData.weeklyIncome, financialWeekStartDate, onStartActiveWeek, weeklySummary]);

  useEffect(() => {
    setTransactionDraft((currentDraft) => ({
      ...currentDraft,
      date: currentDraft.date || activeWeek?.weekStartDate || financialWeekStartDate,
    }));
    setExtraIncomeDraft((currentDraft) => ({
      ...currentDraft,
      date: currentDraft.date || activeWeek?.weekStartDate || financialWeekStartDate,
    }));
  }, [activeWeek?.weekStartDate, financialWeekStartDate]);

  if (!activeWeek) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-stone-900">Preparando semana actual...</p>
      </section>
    );
  }

  const normalizedActiveWeek = normalizeActiveWeek(activeWeek, weeklySummary);
  const hasPendingPreviousWeek = normalizedActiveWeek.weekStartDate !== financialWeekStartDate;
  const pendingWeekDays = calculateDaysBetween(normalizedActiveWeek.weekStartDate, financialWeekStartDate);
  const showPendingWeekWarning = hasPendingPreviousWeek && !dismissedPendingWeekWarning;
  const extraIncome = normalizedActiveWeek.extraIncome;
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const totalIncome = Number(normalizedActiveWeek.realIncome || 0) + extraIncomeTotal;
  const variableTransactions = normalizedActiveWeek.variableTransactions;
  const transactionTotals = calculateTransactionTotals(variableTransactions);
  const plannedGroceries = normalizedActiveWeek.plannedGroceries;
  const plannedFuel = normalizedActiveWeek.plannedFuel;
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const actualVariableSpent = transactionTotals.total;
  const groceriesDifference = plannedGroceries - transactionTotals.groceries;
  const fuelDifference = plannedFuel - transactionTotals.fuel;
  const variableDifference = plannedVariableBudget - actualVariableSpent;
  const payments = normalizedActiveWeek.payments;
  const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const minimumDifference = totalPaid - weeklySummary.minimumToAvoidExpiry;
  const recommendedDifference = totalPaid - weeklySummary.recommendedPayment;
  const realWeeklyMargin =
    totalIncome -
    Number(weeklySummary.weeklyExpensesTotal || 0) -
    Number(weeklySummary.monthlyReserveWeekly || 0) -
    actualVariableSpent -
    totalPaid;
  const marginAfterChosenPayment = weeklySummary.availableForDebt - totalPaid;
  const chosenPaymentMessage = buildChosenPaymentMessage({
    totalPaid,
    minimumDifference,
    recommendedDifference,
    marginAfterChosenPayment,
  });
  const savedRecords = [...(financeData.weeklyRecords || [])].reverse();
  const cardSummaries = financeData.cards.map((card) => {
    const plans = weeklySummary.plans.filter((plan) => plan.cardId === card.id);
    return {
      ...card,
      minimumPayment: plans.reduce((total, plan) => total + Number(plan.recommendedPayment || 0), 0),
      recommendedPayment: plans.reduce((total, plan) => total + Number(plan.totalRecommendedPayment || 0), 0),
      paidAmount: payments.find((payment) => payment.cardId === card.id)?.amount || '',
    };
  });

  function updateActiveWeek(patch) {
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      ...patch,
    }));
  }

  function updateRealIncome(amount) {
    const nextIncome = Number(amount);
    updateActiveWeek({
      income: nextIncome,
      realIncome: nextIncome,
    });
  }

  function updateTransactionDraft(field, value) {
    setTransactionDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function updateExtraIncomeDraft(field, value) {
    setExtraIncomeDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function addExtraIncome() {
    const amount = Number(extraIncomeDraft.amount || 0);
    const description = extraIncomeDraft.description.trim();
    if (amount <= 0 || description.length === 0) return;

    const nextIncome = {
      id: `extra-income-${Date.now()}`,
      date: extraIncomeDraft.date || normalizedActiveWeek.weekStartDate,
      description,
      amount,
    };

    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      extraIncome: [...normalizeExtraIncome(currentWeek), nextIncome],
    }));
    setExtraIncomeDraft({
      date: extraIncomeDraft.date || normalizedActiveWeek.weekStartDate,
      description: '',
      amount: '',
    });
  }

  function deleteExtraIncome(incomeId) {
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      extraIncome: normalizeExtraIncome(currentWeek).filter((income) => income.id !== incomeId),
    }));
  }

  function addVariableTransaction() {
    const amount = Number(transactionDraft.amount || 0);
    const description = transactionDraft.description.trim();
    if (amount <= 0 || description.length === 0) return;

    const nextTransaction = {
      id: `transaction-${Date.now()}`,
      date: transactionDraft.date || normalizedActiveWeek.weekStartDate,
      description,
      category: transactionDraft.category,
      amount,
    };

    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      variableTransactions: [...normalizeRecordTransactions(currentWeek), nextTransaction],
    }));
    setTransactionDraft({
      date: transactionDraft.date || normalizedActiveWeek.weekStartDate,
      description: '',
      category: transactionDraft.category,
      amount: '',
    });
  }

  function deleteVariableTransaction(transactionId) {
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      variableTransactions: normalizeRecordTransactions(currentWeek).filter(
        (transaction) => transaction.id !== transactionId,
      ),
    }));
  }

  function updateCardPayment(cardId, amount) {
    const nextAmount = Number(amount || 0);

    onUpdateActiveWeek((currentWeek) => {
      const currentPayments = currentWeek.payments || [];
      const currentCard = financeData.cards.find((card) => card.id === cardId);
      const otherPayments = currentPayments.filter((payment) => payment.cardId !== cardId);
      const nextPayments =
        nextAmount > 0
          ? [
              ...otherPayments,
              {
                cardId,
                cardName: currentCard?.name || 'Tarjeta',
                amount: nextAmount,
              },
            ]
          : otherPayments;

      return {
        ...currentWeek,
        payments: nextPayments,
      };
    });
  }

  function fillCardPayments(amountKey) {
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      payments: cardSummaries
        .map((card) => ({
          cardId: card.id,
          cardName: card.name,
          amount: Number(card[amountKey] || 0),
        }))
        .filter((payment) => payment.amount > 0),
    }));
  }

  function toggleRecordDetails(recordId) {
    setExpandedRecordIds((currentExpandedIds) => ({
      ...currentExpandedIds,
      [recordId]: !currentExpandedIds[recordId],
    }));
  }

  function reopenRecord(record) {
    if (activeWeekHasRealData(normalizedActiveWeek)) {
      const confirmed = window.confirm(
        'La semana activa actual tiene datos cargados. Si reabrís esta semana cerrada, la semana activa actual será reemplazada. ¿Querés continuar?',
      );
      if (!confirmed) return;
    }

    onReopenWeek(record.id);
  }

  function startEditingRecord(record) {
    setEditingRecordId(record.id);
    setEditingRecordDraft(createEditableRecordDraft(record));
    setExpandedRecordIds((currentExpandedIds) => ({
      ...currentExpandedIds,
      [record.id]: true,
    }));
  }

  function cancelEditingRecord() {
    setEditingRecordId(null);
    setEditingRecordDraft(null);
  }

  function updateEditingRecordDraft(patch) {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      ...patch,
    }));
  }

  function updateEditingTransaction(transactionId, patch) {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      variableTransactions: currentDraft.variableTransactions.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, ...patch } : transaction,
      ),
    }));
  }

  function addEditingTransaction() {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      variableTransactions: [
        ...currentDraft.variableTransactions,
        {
          id: `transaction-${Date.now()}`,
          date: currentDraft.weekDate || getTodayIsoDate(),
          description: '',
          category: 'groceries',
          amount: 0,
        },
      ],
    }));
  }

  function deleteEditingTransaction(transactionId) {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      variableTransactions: currentDraft.variableTransactions.filter((transaction) => transaction.id !== transactionId),
    }));
  }

  function updateEditingExtraIncome(incomeId, patch) {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      extraIncome: currentDraft.extraIncome.map((income) =>
        income.id === incomeId ? { ...income, ...patch } : income,
      ),
    }));
  }

  function addEditingExtraIncome() {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      extraIncome: [
        ...currentDraft.extraIncome,
        {
          id: `extra-income-${Date.now()}`,
          date: currentDraft.weekDate || getTodayIsoDate(),
          description: '',
          amount: 0,
        },
      ],
    }));
  }

  function deleteEditingExtraIncome(incomeId) {
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      extraIncome: currentDraft.extraIncome.filter((income) => income.id !== incomeId),
    }));
  }

  function updateEditingPayment(cardId, amount) {
    const nextAmount = Number(amount || 0);

    setEditingRecordDraft((currentDraft) => {
      const card = financeData.cards.find((item) => item.id === cardId);
      const otherPayments = currentDraft.payments.filter((payment) => payment.cardId !== cardId);
      const payments =
        nextAmount > 0
          ? [
              ...otherPayments,
              {
                cardId,
                cardName: card?.name || 'Tarjeta',
                amount: nextAmount,
              },
            ]
          : otherPayments;

      return {
        ...currentDraft,
        payments,
      };
    });
  }

  function saveEditingRecord(originalRecord) {
    if (!editingRecordDraft || !onUpdateWeek) return;

    const variableTransactions = sanitizeTransactions(editingRecordDraft.variableTransactions);
    const extraIncome = sanitizeExtraIncome(editingRecordDraft.extraIncome);
    const payments = sanitizePayments(editingRecordDraft.payments);

    onUpdateWeek(originalRecord.id, (currentRecord) => ({
      ...currentRecord,
      income: Number(editingRecordDraft.realIncome || 0),
      realIncome: Number(editingRecordDraft.realIncome || 0),
      extraIncome,
      variableTransactions,
      payments,
      note: editingRecordDraft.note || '',
      totalPaid: calculatePaymentTotal(payments),
      updatedAt: new Date().toISOString(),
    }));
    cancelEditingRecord();
  }

  function closeWeek() {
    const budgetSnapshot = createBudgetSnapshot({
      financeData,
      weeklySummary,
      plannedGroceries,
      plannedFuel,
      plannedVariableBudget,
    });
    const closedRecord = {
      ...normalizedActiveWeek,
      id: `week-${Date.now()}`,
      weekDate: normalizedActiveWeek.weekStartDate,
      income: Number(normalizedActiveWeek.realIncome || 0),
      extraIncome: sanitizeExtraIncome(normalizedActiveWeek.extraIncome),
      totalPaid,
      plannedGroceries,
      plannedFuel,
      plannedVariableBudget,
      budgetSnapshot,
      minimumToAvoidExpiry: weeklySummary.minimumToAvoidExpiry,
      recommendedPayment: weeklySummary.recommendedPayment,
      closedAt: new Date().toISOString(),
      createdAt: normalizedActiveWeek.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCloseWeek(closedRecord);
    setTransactionDraft(createEmptyTransaction(getCurrentFinancialWeekStartDate()));
    setExtraIncomeDraft(createEmptyExtraIncome(getCurrentFinancialWeekStartDate()));
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      {showPendingWeekWarning ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">⚠️ Semana pendiente de cierre</p>
              <p className="mt-2 text-sm leading-6">
                Tu semana activa comenzó el {formatDisplayDate(normalizedActiveWeek.weekStartDate)}.
                <br />
                La semana financiera actual comenzó el {formatDisplayDate(financialWeekStartDate)}.
              </p>
              <p className="mt-2 text-sm font-semibold">Todavía no cerraste la semana anterior.</p>
              {pendingWeekDays > 0 ? (
                <p className="mt-1 text-sm text-amber-900">
                  Nueva semana disponible desde hace {pendingWeekDays} {pendingWeekDays === 1 ? 'día' : 'días'}.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
                type="button"
                onClick={closeWeek}
              >
                Cerrar semana e iniciar nueva
              </button>
              <button
                className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                type="button"
                onClick={() => setDismissedPendingWeekWarning(true)}
              >
                Recordármelo después
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        <CollapsiblePanel
          title="Control de la semana financiera"
          summary={`${formatDisplayDate(normalizedActiveWeek.weekStartDate)} · total ingresos ${formatMoney(totalIncome)}`}
          defaultOpen
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Semana actual</p>
              <h2 className="mt-1 text-lg font-semibold text-stone-950">Control de la semana financiera</h2>
              <p className="text-sm text-stone-500">
                Empieza el martes {formatDisplayDate(normalizedActiveWeek.weekStartDate)}. Todo lo que cargues queda guardado automáticamente.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium text-stone-600">
                Inicio de semana
                <span className="mt-1 block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-700">
                  {formatDisplayDate(normalizedActiveWeek.weekStartDate)}
                </span>
              </label>
              <MoneyInput label="Ingreso real cobrado" value={normalizedActiveWeek.realIncome} onChange={updateRealIncome} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SummaryTile label="Ingreso principal" value={normalizedActiveWeek.realIncome} />
            <SummaryTile label="Otros ingresos" value={extraIncomeTotal} />
            <SummaryTile label="Total ingresos" value={totalIncome} tone="positive" />
            <SummaryTile label="Mínimo para no vencer" value={weeklySummary.minimumToAvoidExpiry} />
            <SummaryTile label="Pago inteligente" value={weeklySummary.recommendedPayment} />
            <SummaryTile
              label={minimumDifference >= 0 ? 'Diferencia a favor' : 'Te falta cubrir'}
              value={Math.abs(minimumDifference)}
              tone={minimumDifference >= 0 ? 'positive' : 'warning'}
            />
          </div>

          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Otros ingresos</h3>
                <p className="mt-1 text-sm text-emerald-950">Registrá plata extra sin mezclarla con tu sueldo semanal.</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                Total {formatMoney(extraIncomeTotal)}
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr_0.8fr_auto]">
              <DateInput
                label="Fecha"
                value={extraIncomeDraft.date}
                onChange={(value) => updateExtraIncomeDraft('date', value)}
              />
              <label className="text-sm font-medium text-stone-600">
                Descripción
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                  type="text"
                  value={extraIncomeDraft.description}
                  onChange={(event) => updateExtraIncomeDraft('description', event.target.value)}
                  placeholder="Devolución, reembolso, venta..."
                />
              </label>
              <MoneyInput label="Monto" value={extraIncomeDraft.amount} onChange={(value) => updateExtraIncomeDraft('amount', value)} />
              <div className="flex items-end">
                <button
                  className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 md:w-auto"
                  type="button"
                  onClick={addExtraIncome}
                >
                  Agregar
                </button>
              </div>
            </div>

            {extraIncome.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {extraIncome.map((income) => (
                  <ExtraIncomeRow key={income.id} income={income} onDelete={() => deleteExtraIncome(income.id)} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-emerald-300 bg-white p-3 text-sm text-emerald-900">
                Todavía no cargaste ingresos extra para esta semana.
              </p>
            )}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Gastos de la semana"
          summary={`${variableTransactions.length} gastos · ${formatMoney(actualVariableSpent)}`}
          defaultOpen
        >
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Gastos de la semana</h3>
              <p className="mt-1 text-sm text-stone-500">Cargá cada compra y la app suma por categoría.</p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
              {variableTransactions.length} gastos
            </span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_0.8fr_auto]">
            <DateInput
              label="Fecha"
              value={transactionDraft.date}
              onChange={(value) => updateTransactionDraft('date', value)}
            />
            <label className="text-sm font-medium text-stone-600">
              Comercio / descripción
              <input
                className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                type="text"
                value={transactionDraft.description}
                onChange={(event) => updateTransactionDraft('description', event.target.value)}
                placeholder="Pack'nSave"
              />
            </label>
            <label className="text-sm font-medium text-stone-600">
              Categoría
              <select
                className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                value={transactionDraft.category}
                onChange={(event) => updateTransactionDraft('category', event.target.value)}
              >
                {transactionCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <MoneyInput label="Monto" value={transactionDraft.amount} onChange={(value) => updateTransactionDraft('amount', value)} />
            <div className="flex items-end">
              <button
                className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 md:w-auto"
                type="button"
                onClick={addVariableTransaction}
              >
                Agregar
              </button>
            </div>
          </div>

          {variableTransactions.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {variableTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onDelete={() => deleteVariableTransaction(transaction.id)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-stone-300 bg-white p-3 text-sm text-stone-500">
              Todavía no cargaste gastos variables para esta semana.
            </p>
          )}

          <label className="mt-4 block text-sm font-medium text-stone-600">
            Nota opcional
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={normalizedActiveWeek.note}
              onChange={(event) => updateActiveWeek({ note: event.target.value })}
              placeholder="Ej: semana con compra grande, gasto inesperado, horas extra..."
            />
          </label>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Resultado real de la semana"
          summary={`${realWeeklyMargin >= 0 ? 'Sobró' : 'Faltó'} ${formatMoney(Math.abs(realWeeklyMargin))}`}
          defaultOpen={false}
        >
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Resultado real de la semana</p>
            <MoneyFlowPanel
              summary={buildMoneyFlowSummary({
                financeData,
                record: normalizedActiveWeek,
                useCurrentBudget: true,
                weeklySummary,
              })}
            />
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Pago elegido esta semana"
          summary={`Pagado a deudas ${formatMoney(totalPaid)}`}
          defaultOpen={false}
        >
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
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
                      value={card.paidAmount}
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
        Estos pagos quedan guardados en la semana activa. Los saldos de los planes se editan manualmente cuando GEM, Purple u otra tarjeta actualicen cómo aplicaron el pago.
      </p>

      <div className="mt-4 flex flex-col gap-3 border-t border-stone-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-stone-600">
          Total cargado: <strong className="text-stone-950">{formatMoney(totalPaid)}</strong>
        </p>
        <button
          className="w-fit rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          type="button"
          onClick={closeWeek}
        >
          Cerrar semana
        </button>
      </div>
        </CollapsiblePanel>
      </div>

      {savedRecords.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-stone-900">Semanas cerradas</h3>
          <div className="mt-2 grid gap-3">
            {savedRecords.map((record, index) => (
              <WeeklyRecordItem
                key={record.id}
                expanded={Boolean(expandedRecordIds[record.id])}
                record={record}
                cards={financeData.cards}
                financeData={financeData}
                editingDraft={editingRecordId === record.id ? editingRecordDraft : null}
                isMostRecent={index === 0}
                weeklySummary={weeklySummary}
                onDeleteWeek={onDeleteWeek}
                onAddEditingExtraIncome={addEditingExtraIncome}
                onAddEditingTransaction={addEditingTransaction}
                onCancelEditing={cancelEditingRecord}
                onDeleteEditingExtraIncome={deleteEditingExtraIncome}
                onDeleteEditingTransaction={deleteEditingTransaction}
                onSaveEditing={() => saveEditingRecord(record)}
                onStartEditing={() => startEditingRecord(record)}
                onReopenWeek={() => reopenRecord(record)}
                onToggleDetails={() => toggleRecordDetails(record.id)}
                onUpdateEditingExtraIncome={updateEditingExtraIncome}
                onUpdateEditingPayment={updateEditingPayment}
                onUpdateEditingRecord={updateEditingRecordDraft}
                onUpdateEditingTransaction={updateEditingTransaction}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TransactionRow({ transaction, onDelete }) {
  return (
    <div className="grid gap-2 rounded-md border border-stone-200 bg-white p-3 text-sm sm:grid-cols-[0.9fr_1.5fr_1fr_0.8fr_auto] sm:items-center">
      <span className="text-stone-500">{formatDisplayDate(transaction.date)}</span>
      <span className="font-semibold text-stone-900">{transaction.description}</span>
      <span className="text-stone-600">{getCategoryLabel(transaction.category)}</span>
      <span className="font-bold text-stone-950">{formatMoney(transaction.amount)}</span>
      <button
        className="w-fit rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
        type="button"
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
}

function ExtraIncomeRow({ income, onDelete }) {
  return (
    <div className="grid gap-2 rounded-md border border-emerald-200 bg-white p-3 text-sm sm:grid-cols-[0.9fr_1.7fr_0.8fr_auto] sm:items-center">
      <span className="text-stone-500">{formatDisplayDate(income.date)}</span>
      <span className="font-semibold text-stone-900">{income.description}</span>
      <span className="font-bold text-emerald-700">{formatMoney(income.amount)}</span>
      <button
        className="w-fit rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
        type="button"
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
}

function WeeklyRecordItem({
  expanded,
  record,
  cards,
  financeData,
  editingDraft,
  isMostRecent,
  weeklySummary,
  onDeleteWeek,
  onAddEditingExtraIncome,
  onAddEditingTransaction,
  onCancelEditing,
  onDeleteEditingExtraIncome,
  onDeleteEditingTransaction,
  onSaveEditing,
  onStartEditing,
  onReopenWeek,
  onToggleDetails,
  onUpdateEditingExtraIncome,
  onUpdateEditingPayment,
  onUpdateEditingRecord,
  onUpdateEditingTransaction,
}) {
  const normalizedRecord = normalizeWeeklyRecord(record, weeklySummary);
  const previewRecord = editingDraft
    ? normalizeWeeklyRecord(
        {
          ...record,
          income: Number(editingDraft.realIncome || 0),
          realIncome: Number(editingDraft.realIncome || 0),
          extraIncome: editingDraft.extraIncome,
          variableTransactions: editingDraft.variableTransactions,
          payments: editingDraft.payments,
          note: editingDraft.note,
          totalPaid: calculatePaymentTotal(editingDraft.payments),
        },
        weeklySummary,
      )
    : normalizedRecord;
  const variableTone = previewRecord.variableDifference >= 0 ? 'positive' : 'warning';
  const marginTone = previewRecord.realWeeklyMargin >= 0 ? 'positive' : 'warning';

  return (
    <article className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p>
            <strong className="text-stone-950">{formatDisplayDate(previewRecord.weekDate)}</strong> · Ingreso principal {formatMoney(previewRecord.realIncome)} · Total ingresos {formatMoney(previewRecord.totalIncome)} · Pagado a deudas {formatMoney(previewRecord.totalPaid)}
          </p>
          <p className="mt-1 text-stone-500">
            Otros ingresos {formatMoney(previewRecord.extraIncomeTotal)} · Supermercado {formatMoney(previewRecord.totals.groceries)} · Combustible {formatMoney(previewRecord.totals.fuel)} · Otros {formatMoney(previewRecord.totals.other)} · {previewRecord.variableTransactions.length} transacciones
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMostRecent ? (
            <button
              className="w-fit rounded-md border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
              type="button"
              onClick={onReopenWeek}
            >
              Reabrir como semana actual
            </button>
          ) : null}
          <button
            className="w-fit rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            type="button"
            onClick={onStartEditing}
          >
            {editingDraft ? 'Editando' : 'Editar'}
          </button>
          <button
            className="w-fit rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            type="button"
            onClick={onToggleDetails}
          >
            {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
          <button
            className="w-fit rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            type="button"
            onClick={() => {
              const confirmed = window.confirm(`¿Eliminar la semana del ${formatDisplayDate(previewRecord.weekDate)}?`);
              if (confirmed) onDeleteWeek(record.id);
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SmallResult
          label={previewRecord.variableDifference >= 0 ? 'Gasté de menos' : 'Gasté de más'}
          value={formatMoney(Math.abs(previewRecord.variableDifference))}
          tone={variableTone}
        />
        <SmallResult
          label={previewRecord.realWeeklyMargin >= 0 ? 'Margen real' : 'Faltante real'}
          value={formatMoney(Math.abs(previewRecord.realWeeklyMargin))}
          tone={marginTone}
        />
        <SmallResult label="Gasto variable real" value={formatMoney(previewRecord.totals.total)} />
      </div>

      {editingDraft ? (
        <ClosedWeekEditor
          cards={cards}
          draft={editingDraft}
          onAddExtraIncome={onAddEditingExtraIncome}
          onAddTransaction={onAddEditingTransaction}
          onCancel={onCancelEditing}
          onDeleteExtraIncome={onDeleteEditingExtraIncome}
          onDeleteTransaction={onDeleteEditingTransaction}
          onSave={onSaveEditing}
          onUpdateExtraIncome={onUpdateEditingExtraIncome}
          onUpdateDraft={onUpdateEditingRecord}
          onUpdatePayment={onUpdateEditingPayment}
          onUpdateTransaction={onUpdateEditingTransaction}
        />
      ) : null}

      {expanded ? (
        <div className="mt-3 grid gap-2">
          <MoneyFlowPanel
            summary={buildMoneyFlowSummary({
              financeData,
              record: {
                ...record,
                income: previewRecord.realIncome,
                realIncome: previewRecord.realIncome,
                extraIncome: previewRecord.extraIncome,
                variableTransactions: previewRecord.variableTransactions,
                payments: editingDraft?.payments || record.payments || [],
                totalPaid: previewRecord.totalPaid,
                note: previewRecord.note,
              },
              useCurrentBudget: false,
              weeklySummary,
            })}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <SmallResult label="Ingreso principal" value={formatMoney(previewRecord.realIncome)} />
            <SmallResult label="Otros ingresos" value={formatMoney(previewRecord.extraIncomeTotal)} tone={previewRecord.extraIncomeTotal > 0 ? 'positive' : 'default'} />
            <SmallResult label="Total ingresos" value={formatMoney(previewRecord.totalIncome)} tone="positive" />
          </div>
          {previewRecord.extraIncome.length > 0 ? (
            <div className="grid gap-2">
              {previewRecord.extraIncome.map((income) => (
                <div key={income.id} className="grid gap-1 rounded-md border border-emerald-200 bg-white p-2 sm:grid-cols-[0.8fr_1.4fr_0.7fr] sm:items-center">
                  <span className="text-stone-500">{formatDisplayDate(income.date)}</span>
                  <span className="font-semibold text-stone-900">{income.description}</span>
                  <span className="font-bold text-emerald-700">{formatMoney(income.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {previewRecord.variableTransactions.length > 0 ? (
            previewRecord.variableTransactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-1 rounded-md border border-stone-200 bg-white p-2 sm:grid-cols-[0.8fr_1.4fr_1fr_0.7fr] sm:items-center">
                <span className="text-stone-500">{formatDisplayDate(transaction.date)}</span>
                <span className="font-semibold text-stone-900">{transaction.description}</span>
                <span className="text-stone-600">{getCategoryLabel(transaction.category)}</span>
                <span className="font-bold text-stone-950">{formatMoney(transaction.amount)}</span>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-stone-200 bg-white p-2 text-stone-500">
              Este registro no tiene detalle de transacciones.
            </p>
          )}
        </div>
      ) : null}

      {previewRecord.note ? (
        <p className="mt-3 rounded-md border border-stone-200 bg-white p-2 text-stone-600">{previewRecord.note}</p>
      ) : null}
    </article>
  );
}

function ClosedWeekEditor({
  cards,
  draft,
  onAddExtraIncome,
  onAddTransaction,
  onCancel,
  onDeleteExtraIncome,
  onDeleteTransaction,
  onSave,
  onUpdateExtraIncome,
  onUpdateDraft,
  onUpdatePayment,
  onUpdateTransaction,
}) {
  return (
    <div className="mt-3 rounded-md border border-sky-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
        <MoneyInput
          label="Ingreso real cobrado"
          value={draft.realIncome}
          onChange={(value) => onUpdateDraft({ realIncome: Number(value || 0) })}
        />
        <label className="text-sm font-medium text-stone-600">
          Nota
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
            value={draft.note}
            onChange={(event) => onUpdateDraft({ note: event.target.value })}
            placeholder="Algo importante de esta semana"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Otros ingresos reales</p>
          <button
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            type="button"
            onClick={onAddExtraIncome}
          >
            Agregar ingreso
          </button>
        </div>

        <div className="mt-2 grid gap-2">
          {draft.extraIncome.length > 0 ? (
            draft.extraIncome.map((income) => (
              <div
                key={income.id}
                className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 md:grid-cols-[0.9fr_1.5fr_0.8fr_auto] md:items-end"
              >
                <DateInput
                  label="Fecha"
                  value={income.date}
                  onChange={(value) => onUpdateExtraIncome(income.id, { date: value })}
                />
                <label className="text-sm font-medium text-stone-600">
                  Descripción
                  <input
                    className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                    type="text"
                    value={income.description}
                    onChange={(event) => onUpdateExtraIncome(income.id, { description: event.target.value })}
                  />
                </label>
                <MoneyInput
                  label="Monto"
                  value={income.amount}
                  onChange={(value) => onUpdateExtraIncome(income.id, { amount: Number(value || 0) })}
                />
                <button
                  className="w-fit rounded-md border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  onClick={() => onDeleteExtraIncome(income.id)}
                >
                  Eliminar
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-stone-200 bg-stone-50 p-2 text-sm text-stone-500">
              No hay ingresos extra cargados en esta semana.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Gastos variables reales</p>
          <button
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            type="button"
            onClick={onAddTransaction}
          >
            Agregar gasto
          </button>
        </div>

        <div className="mt-2 grid gap-2">
          {draft.variableTransactions.length > 0 ? (
            draft.variableTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid gap-2 rounded-md border border-stone-200 bg-stone-50 p-2 md:grid-cols-[0.9fr_1.3fr_1fr_0.8fr_auto] md:items-end"
              >
                <DateInput
                  label="Fecha"
                  value={transaction.date}
                  onChange={(value) => onUpdateTransaction(transaction.id, { date: value })}
                />
                <label className="text-sm font-medium text-stone-600">
                  Comercio / descripcion
                  <input
                    className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                    type="text"
                    value={transaction.description}
                    onChange={(event) => onUpdateTransaction(transaction.id, { description: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium text-stone-600">
                  Categoria
                  <select
                    className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                    value={normalizeCategory(transaction.category)}
                    onChange={(event) => onUpdateTransaction(transaction.id, { category: event.target.value })}
                  >
                    {transactionCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <MoneyInput
                  label="Monto"
                  value={transaction.amount}
                  onChange={(value) => onUpdateTransaction(transaction.id, { amount: Number(value || 0) })}
                />
                <button
                  className="w-fit rounded-md border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  onClick={() => onDeleteTransaction(transaction.id)}
                >
                  Eliminar
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-stone-200 bg-stone-50 p-2 text-sm text-stone-500">
              No hay gastos cargados en esta semana.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Pagos reales a deudas</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MoneyInput
              key={card.id}
              label={card.name}
              value={draft.payments.find((payment) => payment.cardId === card.id)?.amount || ''}
              onChange={(value) => onUpdatePayment(card.id, value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-200 pt-3">
        <button
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          className="rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          type="button"
          onClick={onSave}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function CollapsiblePanel({ title, summary, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-stone-950">{title}</span>
          <span className="mt-1 block truncate text-sm text-stone-500">{summary}</span>
        </span>
        <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-700">
          {isOpen ? 'Ocultar' : 'Ver'}
        </span>
      </button>
      {isOpen ? <div className="border-t border-stone-100 p-4">{children}</div> : null}
    </div>
  );
}

function MoneyFlowPanel({ summary }) {
  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Ingresó" value={summary.totalIncome} tone="positive" />
        <SummaryTile label="Salió / reservado" value={summary.totalOutflow} tone="warning" />
        <SummaryTile
          label={summary.margin >= 0 ? 'Sobró' : 'Faltó'}
          value={Math.abs(summary.margin)}
          tone={summary.margin >= 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="grid gap-3">
        <CollapsibleMoneySection title="Ingresos" total={summary.totalIncome} defaultOpen={false}>
          <MoneyFlowRow label="Ingreso principal" value={summary.primaryIncome} tone="positive" />
          <MoneyFlowRow label="Otros ingresos" value={summary.extraIncomeTotal} tone={summary.extraIncomeTotal > 0 ? 'positive' : 'default'} />
          <MoneyFlowRow label="Total ingresos" value={summary.totalIncome} strong tone="positive" />
        </CollapsibleMoneySection>

        <CollapsibleMoneySection title="Dinero comprometido" total={summary.fixedAndReservedTotal} defaultOpen>
          {summary.weeklyExpenseRows.length > 0 ? (
            summary.weeklyExpenseRows.map((expense) => (
              <MoneyFlowRow key={expense.id} label={expense.name} value={expense.amount} />
            ))
          ) : (
            <MoneyFlowRow label="Gastos semanales fijos" value={summary.fixedWeeklyExpensesTotal} />
          )}
          <MoneyFlowRow label="Servicios mensuales prorrateados" value={summary.monthlyReserveWeekly} />
          <MoneyFlowRow label="Total fijo / reservado" value={summary.fixedAndReservedTotal} strong />
        </CollapsibleMoneySection>

        <CollapsibleMoneySection title="Gasto real" total={summary.variableTotals.total + summary.totalPaid} defaultOpen>
          <MoneyFlowRow label="Supermercado" value={summary.variableTotals.groceries} />
          <MoneyFlowRow label="Combustible" value={summary.variableTotals.fuel} />
          <MoneyFlowRow label="Otros variables" value={summary.variableTotals.other} />
          <MoneyFlowRow label="Pagos a deudas" value={summary.totalPaid} />
          <MoneyFlowRow label="Total gasto real" value={summary.variableTotals.total + summary.totalPaid} strong tone="warning" />
        </CollapsibleMoneySection>
      </div>
    </div>
  );
}

function CollapsibleMoneySection({ title, total, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-sky-200 bg-white">
      <button
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-sky-700">{title}</span>
          <span className="mt-1 block text-lg font-bold text-stone-950">{formatMoney(total)}</span>
        </span>
        <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
          {isOpen ? 'Ocultar' : 'Ver'}
        </span>
      </button>
      {isOpen ? <div className="grid gap-2 border-t border-sky-100 p-3">{children}</div> : null}
    </div>
  );
}

function MoneyFlowRow({ label, value, strong = false, tone = 'default' }) {
  const toneClass = {
    default: 'text-stone-900',
    positive: 'text-emerald-700',
    warning: 'text-amber-800',
  }[tone];

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2 ${strong ? 'border border-stone-200' : ''}`}>
      <span className={`${strong ? 'font-semibold text-stone-950' : 'text-stone-600'}`}>{label}</span>
      <span className={`font-bold ${toneClass}`}>{formatMoney(value)}</span>
    </div>
  );
}

function normalizeActiveWeek(activeWeek, weeklySummary) {
  const plannedGroceries = Number(weeklySummary.groceries || 0);
  const plannedFuel = Number(weeklySummary.fuel || 0);

  return {
    ...activeWeek,
    weekStartDate: activeWeek.weekStartDate || activeWeek.weekDate || getCurrentFinancialWeekStartDate(),
    realIncome: Number(activeWeek.realIncome ?? activeWeek.income ?? 0),
    extraIncome: normalizeExtraIncome(activeWeek),
    variableTransactions: normalizeRecordTransactions(activeWeek),
    payments: activeWeek.payments || [],
    note: activeWeek.note || '',
    plannedGroceries,
    plannedFuel,
    plannedVariableBudget: plannedGroceries + plannedFuel,
  };
}

function normalizeWeeklyRecord(record, weeklySummary) {
  const variableTransactions = normalizeRecordTransactions(record);
  const totals = calculateTransactionTotals(variableTransactions);
  const budgetSnapshot = record.budgetSnapshot || null;
  const realIncome = Number(record.realIncome ?? record.income ?? 0);
  const extraIncome = normalizeExtraIncome(record);
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const totalIncome = realIncome + extraIncomeTotal;
  const hasPaymentDetails = Array.isArray(record.payments) && record.payments.length > 0;
  const totalPaid = hasPaymentDetails ? calculatePaymentTotal(record.payments) : Number(record.totalPaid ?? 0);
  const plannedGroceries = Number(record.plannedGroceries ?? budgetSnapshot?.plannedGroceries ?? weeklySummary.groceries ?? 0);
  const plannedFuel = Number(record.plannedFuel ?? budgetSnapshot?.plannedFuel ?? weeklySummary.fuel ?? 0);
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const variableDifference = plannedVariableBudget - totals.total;
  const realWeeklyMargin =
    totalIncome -
    Number(budgetSnapshot?.fixedWeeklyExpensesTotal ?? weeklySummary.weeklyExpensesTotal ?? 0) -
    Number(budgetSnapshot?.monthlyReserveWeekly ?? weeklySummary.monthlyReserveWeekly ?? 0) -
    totals.total -
    totalPaid;

  return {
    weekDate: record.weekDate || record.weekStartDate,
    realIncome,
    extraIncome,
    extraIncomeTotal,
    totalIncome,
    totalPaid,
    plannedVariableBudget,
    variableTransactions,
    totals,
    variableDifference,
    realWeeklyMargin,
    note: record.note || '',
  };
}

function buildMoneyFlowSummary({ financeData, record, useCurrentBudget, weeklySummary }) {
  const budgetSnapshot = useCurrentBudget ? null : record.budgetSnapshot || null;
  const weeklyExpenseRows = (budgetSnapshot?.weeklyExpenses || financeData.weeklyExpenses || []).map((expense) => ({
    id: expense.id || expense.name,
    name: expense.name || 'Gasto semanal',
    amount: Number(expense.amount || 0),
  }));
  const fallbackWeeklyExpensesTotal = weeklyExpenseRows.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const fixedWeeklyExpensesTotal = Number(
    budgetSnapshot?.fixedWeeklyExpensesTotal ??
      (fallbackWeeklyExpensesTotal > 0 ? fallbackWeeklyExpensesTotal : weeklySummary.weeklyExpensesTotal) ??
      0,
  );
  const monthlyReserveWeekly = Number(budgetSnapshot?.monthlyReserveWeekly ?? weeklySummary.monthlyReserveWeekly ?? 0);
  const extraIncome = normalizeExtraIncome(record);
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const primaryIncome = Number(record.realIncome ?? record.income ?? 0);
  const totalIncome = primaryIncome + extraIncomeTotal;
  const variableTransactions = normalizeRecordTransactions(record);
  const variableTotals = calculateTransactionTotals(variableTransactions);
  const hasPaymentDetails = Array.isArray(record.payments) && record.payments.length > 0;
  const totalPaid = hasPaymentDetails ? calculatePaymentTotal(record.payments) : Number(record.totalPaid ?? 0);
  const fixedAndReservedTotal = fixedWeeklyExpensesTotal + monthlyReserveWeekly;
  const totalOutflow = fixedAndReservedTotal + variableTotals.total + totalPaid;
  const margin = totalIncome - totalOutflow;

  return {
    primaryIncome,
    extraIncomeTotal,
    totalIncome,
    weeklyExpenseRows,
    fixedWeeklyExpensesTotal,
    monthlyReserveWeekly,
    fixedAndReservedTotal,
    variableTotals,
    totalPaid,
    totalOutflow,
    margin,
  };
}

function activeWeekHasRealData(activeWeek) {
  return (
    normalizeExtraIncome(activeWeek).length > 0 ||
    normalizeRecordTransactions(activeWeek).length > 0 ||
    (activeWeek.payments || []).length > 0 ||
    Boolean((activeWeek.note || '').trim())
  );
}

function createEditableRecordDraft(record) {
  return {
    weekDate: record.weekDate || record.weekStartDate || getTodayIsoDate(),
    realIncome: Number(record.realIncome ?? record.income ?? 0),
    extraIncome: normalizeExtraIncome(record),
    variableTransactions: normalizeRecordTransactions(record),
    payments: sanitizePayments(record.payments || []),
    note: record.note || '',
  };
}

function sanitizeExtraIncome(extraIncome) {
  return (extraIncome || [])
    .map((income, index) => ({
      id: income.id || `extra-income-${Date.now()}-${index}`,
      date: income.date || getTodayIsoDate(),
      description: (income.description || '').trim(),
      amount: Number(income.amount || 0),
    }))
    .filter((income) => income.amount > 0 || income.description.length > 0);
}

function sanitizeTransactions(transactions) {
  return (transactions || [])
    .map((transaction, index) => ({
      id: transaction.id || `transaction-${Date.now()}-${index}`,
      date: transaction.date || getTodayIsoDate(),
      description: (transaction.description || '').trim(),
      category: normalizeCategory(transaction.category),
      amount: Number(transaction.amount || 0),
    }))
    .filter((transaction) => transaction.amount > 0 || transaction.description.length > 0);
}

function sanitizePayments(payments) {
  return (payments || [])
    .map((payment) => ({
      cardId: payment.cardId,
      cardName: payment.cardName || 'Tarjeta',
      amount: Number(payment.amount || 0),
    }))
    .filter((payment) => payment.cardId && payment.amount > 0);
}

function createBudgetSnapshot({ financeData, weeklySummary, plannedGroceries, plannedFuel, plannedVariableBudget }) {
  const weeklyExpenses = (financeData.weeklyExpenses || []).map((expense) => ({ ...expense }));
  const monthlyExpenses = (financeData.monthlyExpenses || []).map((expense) => ({ ...expense }));
  const fixedWeeklyExpensesTotal = weeklyExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const monthlyExpensesTotal = monthlyExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const argentinaCardReserveWeekly = weeklyExpenses
    .filter((expense) => expense.id === 'argentina-card' || /argentina/i.test(expense.name || ''))
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  return {
    weeklyIncome: Number(financeData.weeklyIncome || 0),
    weeklyExpenses,
    fixedWeeklyExpensesTotal,
    argentinaCardReserveWeekly,
    monthlyExpenses,
    monthlyExpensesTotal,
    monthlyReserveWeekly: Number(weeklySummary.monthlyReserveWeekly || 0),
    variableBudgets: [
      { id: 'groceries', name: 'Supermercado', amount: Number(plannedGroceries || 0) },
      { id: 'fuel', name: 'Combustible', amount: Number(plannedFuel || 0) },
    ],
    variableBudgetsTotal: Number(plannedVariableBudget || 0),
    plannedGroceries: Number(plannedGroceries || 0),
    plannedFuel: Number(plannedFuel || 0),
    plannedVariableBudget: Number(plannedVariableBudget || 0),
    minimumToAvoidExpiry: Number(weeklySummary.minimumToAvoidExpiry || 0),
    recommendedPayment: Number(weeklySummary.recommendedPayment || 0),
  };
}

function normalizeExtraIncome(record) {
  if (!Array.isArray(record.extraIncome)) return [];

  return record.extraIncome.map((income, index) => ({
    id: income.id || `legacy-extra-income-${record.id || record.weekDate}-${index}`,
    date: income.date || record.weekDate || record.weekStartDate || '',
    description: income.description || 'Ingreso extra',
    amount: Number(income.amount || 0),
  }));
}

function normalizeRecordTransactions(record) {
  if (Array.isArray(record.variableTransactions)) {
    return record.variableTransactions.map((transaction, index) => ({
      id: transaction.id || `legacy-transaction-${record.id || record.weekDate}-${index}`,
      date: transaction.date || record.weekDate || record.weekStartDate || '',
      description: transaction.description || transaction.merchant || 'Gasto variable',
      category: normalizeCategory(transaction.category),
      amount: Number(transaction.amount || 0),
    }));
  }

  const legacyTransactions = [
    {
      id: `legacy-groceries-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Supermercado',
      category: 'groceries',
      amount: Number(record.realGroceries ?? record.grocerySpent ?? record.groceriesSpent ?? 0),
    },
    {
      id: `legacy-fuel-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Combustible',
      category: 'fuel',
      amount: Number(record.realFuel ?? record.fuelSpent ?? 0),
    },
    {
      id: `legacy-other-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Otros gastos',
      category: 'other',
      amount: Number(record.otherVariableExpenses ?? record.otherVariableSpent ?? record.otherSpent ?? 0),
    },
  ];

  return legacyTransactions.filter((transaction) => transaction.amount > 0);
}

function calculateTransactionTotals(transactions) {
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

function calculatePaymentTotal(payments) {
  return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
}

function calculateExtraIncomeTotal(extraIncome) {
  return extraIncome.reduce((total, income) => total + Number(income.amount || 0), 0);
}

function normalizeCategory(category) {
  if (category === 'supermercado' || category === 'grocery') return 'groceries';
  if (category === 'combustible') return 'fuel';
  if (category === 'otros') return 'other';
  return ['groceries', 'fuel', 'other'].includes(category) ? category : 'other';
}

function getCategoryLabel(category) {
  return transactionCategories.find((item) => item.id === normalizeCategory(category))?.label || 'Otros';
}

function buildChosenPaymentMessage({ totalPaid, minimumDifference, recommendedDifference, marginAfterChosenPayment }) {
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

function MoneyInput({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-stone-600">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
        <span className="text-stone-400">$</span>
        <input
          className="numeric-input min-w-0 flex-1 bg-transparent font-semibold outline-none"
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function DateInput({ label, value, onChange }) {
  const [displayValue, setDisplayValue] = useState(formatDisplayDate(value));

  useEffect(() => {
    setDisplayValue(formatDisplayDate(value));
  }, [value]);

  function handleDisplayChange(nextValue) {
    setDisplayValue(nextValue);
    const nextDate = parseDisplayDate(nextValue);
    if (nextDate) onChange(nextDate);
  }

  return (
    <label className="text-sm font-medium text-stone-600">
      {label}
      <span className="mt-1 grid grid-cols-[1fr_auto] gap-2">
        <input
          className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          type="text"
          value={displayValue}
          onChange={(event) => handleDisplayChange(event.target.value)}
        />
        <input
          aria-label="Elegir fecha"
          className="w-12 rounded-md border border-stone-200 bg-white px-2 py-2 text-stone-700 outline-none focus:border-sky-500"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
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

function SmallResult({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-white',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 font-bold text-stone-950">{value}</p>
    </div>
  );
}
