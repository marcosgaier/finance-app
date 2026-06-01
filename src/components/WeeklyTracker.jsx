import React, { useEffect, useMemo, useState } from 'react';
import { formatDisplayDate, formatIsoDate, parseDisplayDate } from '../utils/dateUtils.js';
import { getFundingSourceLabel, isWeeklyIncomeFunded, WEEKLY_INCOME_SOURCE } from '../utils/fundingSourceUtils.js';
import { formatMoney } from '../utils/financeEngine.js';
import {
  buildWeeklyMoneyFlowSummary,
  calculateExtraIncomeTotal,
  calculatePaymentTotal,
  calculateReserveMovementTotal,
  calculateTransactionTotals,
  calculateWeeklyFundedTotal,
  normalizeTransactionCategory,
  normalizeWeeklyRecordTransactions,
  normalizeWeeklyReserveMovements,
} from '../utils/weeklyRecordUtils.js';

const transactionCategories = [
  { id: 'groceries', label: 'Supermercado' },
  { id: 'fuel', label: 'Combustible' },
  { id: 'other', label: 'Otros' },
];

const extraIncomeTypes = [
  { id: 'extra_income', label: 'Ingreso extra' },
  { id: 'refund', label: 'Devolución / refund' },
  { id: 'previous_week_rollover', label: 'Arrastre semana anterior' },
  { id: 'other', label: 'Otro' },
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
    fundingSource: WEEKLY_INCOME_SOURCE,
  };
}

function createEmptyExtraIncome(date = getTodayIsoDate()) {
  return {
    date,
    type: 'extra_income',
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
    reserveMovements: [],
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
  onReserveBucketBalanceChange,
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
  const reserveMovements = normalizedActiveWeek.reserveMovements;
  const transactionTotals = calculateTransactionTotals(variableTransactions);
  const weeklyFundedTransactionTotals = calculateTransactionTotals(
    variableTransactions.filter((transaction) => isWeeklyIncomeFunded(transaction)),
  );
  const plannedGroceries = normalizedActiveWeek.plannedGroceries;
  const plannedFuel = normalizedActiveWeek.plannedFuel;
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const actualVariableSpent = transactionTotals.total;
  const groceriesDifference = plannedGroceries - transactionTotals.groceries;
  const fuelDifference = plannedFuel - transactionTotals.fuel;
  const variableDifference = plannedVariableBudget - actualVariableSpent;
  const payments = normalizedActiveWeek.payments;
  const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const weeklyFundedPaid = calculateWeeklyFundedTotal(payments);
  const weeklyFundedReserveTransfers = calculateReserveMovementTotal(
    reserveMovements.filter((movement) => isWeeklyIncomeFunded(movement)),
  );
  const reserveTransferTotal = calculateReserveMovementTotal(reserveMovements);
  const weeklyGemBuffer = Number(weeklySummary.gemMinimumSummary?.weeklyBuffer || 0);
  const minimumSafeWeeklyPayment = Number(weeklySummary.minimumToAvoidExpiry || 0) + weeklyGemBuffer;
  const optionalExtraPayment = Math.max(
    0,
    Number(weeklySummary.recommendedPayment || 0) - Number(weeklySummary.minimumToAvoidExpiry || 0),
  );
  const totalRecommendedPayment = minimumSafeWeeklyPayment + optionalExtraPayment;
  const marginAfterMinimumSafe =
    totalIncome -
    Number(weeklySummary.weeklyExpensesTotal || 0) -
    Number(weeklySummary.monthlyReserveWeekly || 0) -
    Number(weeklySummary.groceries || 0) -
    Number(weeklySummary.fuel || 0) -
    minimumSafeWeeklyPayment;
  const minimumDifference = totalPaid - minimumSafeWeeklyPayment;
  const recommendedDifference = totalPaid - totalRecommendedPayment;
  const realWeeklyMargin =
    totalIncome -
    Number(weeklySummary.weeklyExpensesTotal || 0) -
    Number(weeklySummary.monthlyReserveWeekly || 0) -
    weeklyFundedTransactionTotals.total -
    weeklyFundedPaid -
    weeklyFundedReserveTransfers;
  const activeWeekMoneyFlowSummary = buildWeeklyMoneyFlowSummary({
    financeData,
    record: normalizedActiveWeek,
    useCurrentBudget: true,
    weeklySummary,
  });
  const activeWeekTotalOutflowMargin = Number(
    activeWeekMoneyFlowSummary.totalOutflowMargin ?? activeWeekMoneyFlowSummary.margin ?? 0,
  );
  const activeWeekResultLabel =
    activeWeekTotalOutflowMargin > 0 ? 'Sobró' : activeWeekTotalOutflowMargin < 0 ? 'Faltó' : 'Quedó justo';
  const marginAfterChosenPayment = weeklySummary.availableForDebt - weeklyFundedPaid;
  const chosenPaymentMessage = buildChosenPaymentMessage({
    totalPaid,
    minimumDifference,
    recommendedDifference,
    marginAfterChosenPayment,
  });
  const savedRecords = [...(financeData.weeklyRecords || [])].reverse();
  const gemCardIds = new Set(weeklySummary.gemMinimumSummary?.cardIds || []);
  const cardSummaries = financeData.cards.map((card) => {
    const plans = weeklySummary.plans.filter((plan) => plan.cardId === card.id);
    const minimumPayment = plans.reduce((total, plan) => total + Number(plan.recommendedPayment || 0), 0);
    const recommendedPayment = plans.reduce((total, plan) => total + Number(plan.totalRecommendedPayment || 0), 0);
    const cardGemBuffer = gemCardIds.has(card.id) ? weeklyGemBuffer : 0;

    return {
      ...card,
      minimumPayment,
      recommendedPayment,
      safeMinimumPayment: minimumPayment + cardGemBuffer,
      safeRecommendedPayment: recommendedPayment + cardGemBuffer,
      paidAmount: payments.find((payment) => payment.cardId === card.id)?.amount || '',
      fundingSource: payments.find((payment) => payment.cardId === card.id)?.fundingSource || WEEKLY_INCOME_SOURCE,
    };
  });
  const reserveFundedPaid = totalPaid - weeklyFundedPaid;

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
    const type = normalizeExtraIncomeType(extraIncomeDraft.type);
    const description = extraIncomeDraft.description.trim() || getExtraIncomeTypeLabel(type);
    if (amount <= 0 || description.length === 0) return;

    const nextIncome = {
      id: `extra-income-${Date.now()}`,
      date: extraIncomeDraft.date || normalizedActiveWeek.weekStartDate,
      type,
      description,
      amount,
    };

    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      extraIncome: [...normalizeExtraIncome(currentWeek), nextIncome],
    }));
    setExtraIncomeDraft({
      date: extraIncomeDraft.date || normalizedActiveWeek.weekStartDate,
      type,
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
      fundingSource: transactionDraft.fundingSource || WEEKLY_INCOME_SOURCE,
    };

    applyReserveDelta(null, nextTransaction);
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      variableTransactions: [...normalizeWeeklyRecordTransactions(currentWeek), nextTransaction],
    }));
    setTransactionDraft({
      date: transactionDraft.date || normalizedActiveWeek.weekStartDate,
      description: '',
      category: transactionDraft.category,
      amount: '',
      fundingSource: transactionDraft.fundingSource || WEEKLY_INCOME_SOURCE,
    });
  }

  function deleteVariableTransaction(transactionId) {
    const transactionToDelete = variableTransactions.find((transaction) => transaction.id === transactionId);
    applyReserveDelta(transactionToDelete, null);
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      variableTransactions: normalizeWeeklyRecordTransactions(currentWeek).filter(
        (transaction) => transaction.id !== transactionId,
      ),
    }));
  }

  function updateCardPayment(cardId, amount, fundingSource) {
    const nextAmount = Number(amount || 0);
    const currentPayment = payments.find((payment) => payment.cardId === cardId) || null;
    const nextFundingSource = fundingSource || currentPayment?.fundingSource || WEEKLY_INCOME_SOURCE;

    applyReserveDelta(
      currentPayment,
      nextAmount > 0 ? { ...currentPayment, amount: nextAmount, fundingSource: nextFundingSource } : null,
    );
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
                fundingSource: nextFundingSource,
              },
            ]
          : otherPayments;

      return {
        ...currentWeek,
        payments: nextPayments,
      };
    });
  }

  function updateCardPaymentFundingSource(cardId, fundingSource) {
    const currentPayment = payments.find((payment) => payment.cardId === cardId);
    if (!currentPayment) return;
    updateCardPayment(cardId, currentPayment.amount, fundingSource);
  }

  function fillCardPayments(amountKey) {
    payments.forEach((payment) => applyReserveDelta(payment, null));
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      payments: cardSummaries
        .map((card) => ({
          cardId: card.id,
          cardName: card.name,
          amount: Number(card[amountKey] || 0),
          fundingSource: WEEKLY_INCOME_SOURCE,
        }))
        .filter((payment) => payment.amount > 0),
    }));
  }

  function applyReserveDelta(previousItem, nextItem) {
    if (!onReserveBucketBalanceChange) return;

    const previousFundingSource = previousItem?.fundingSource || WEEKLY_INCOME_SOURCE;
    const nextFundingSource = nextItem?.fundingSource || WEEKLY_INCOME_SOURCE;
    const previousAmount = Number(previousItem?.amount || 0);
    const nextAmount = Number(nextItem?.amount || 0);

    if (previousFundingSource !== WEEKLY_INCOME_SOURCE) {
      onReserveBucketBalanceChange(previousFundingSource, previousAmount);
    }
    if (nextFundingSource !== WEEKLY_INCOME_SOURCE) {
      onReserveBucketBalanceChange(nextFundingSource, -nextAmount);
    }
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
          type: 'extra_income',
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
      reserveMovements: sanitizeReserveMovements(normalizedActiveWeek.reserveMovements),
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
            <SummaryTile label="Mínimo semanal seguro" value={minimumSafeWeeklyPayment} tone="warning" />
            <SummaryTile label="Extra opcional" value={optionalExtraPayment} />
            <SummaryTile label="Pago recomendado total" value={totalRecommendedPayment} />
            <SummaryTile
              label="Margen estimado si pago mínimo seguro"
              value={Math.abs(marginAfterMinimumSafe)}
              tone={marginAfterMinimumSafe >= 0 ? 'positive' : 'warning'}
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

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_0.8fr_auto]">
              <DateInput
                label="Fecha"
                value={extraIncomeDraft.date}
                onChange={(value) => updateExtraIncomeDraft('date', value)}
              />
              <ExtraIncomeTypeSelect
                label="Tipo"
                value={extraIncomeDraft.type}
                onChange={(value) => updateExtraIncomeDraft('type', value)}
              />
              <label className="text-sm font-medium text-stone-600">
                Descripción
                <input
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
                  type="text"
                  value={extraIncomeDraft.description}
                  onChange={(event) => updateExtraIncomeDraft('description', event.target.value)}
                  placeholder="Devolución, arrastre, venta..."
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

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_0.8fr_1fr_auto]">
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
            <FundingSourceSelect
              buckets={financeData.reserveBuckets || []}
              label="Origen"
              value={transactionDraft.fundingSource || WEEKLY_INCOME_SOURCE}
              onChange={(value) => updateTransactionDraft('fundingSource', value)}
            />
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
                  buckets={financeData.reserveBuckets || []}
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
          summary={`${activeWeekResultLabel} ${formatMoney(Math.abs(activeWeekTotalOutflowMargin))}`}
          defaultOpen={false}
        >
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Resultado real de la semana</p>
            <MoneyFlowPanel summary={activeWeekMoneyFlowSummary} />
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
              <SummaryTile label="Sale de semana" value={weeklyFundedPaid} />
              <SummaryTile label="Sale de reservas" value={reserveFundedPaid} />
              <SummaryTile
                label={minimumDifference >= 0 ? 'Por encima del mínimo seguro' : 'Te falta para mínimo seguro'}
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
          onClick={() => fillCardPayments('safeMinimumPayment')}
        >
          Cargar mínimo seguro
        </button>
        <button
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
          type="button"
          onClick={() => fillCardPayments('safeRecommendedPayment')}
        >
          Cargar recomendado total
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="py-2 pr-3 font-semibold">Tarjeta</th>
              <th className="py-2 pr-3 font-semibold">Mínimo seguro</th>
              <th className="py-2 pr-3 font-semibold">Recomendado total</th>
              <th className="py-2 pr-3 font-semibold">Pagado esta semana</th>
              <th className="py-2 pr-3 font-semibold">Origen</th>
            </tr>
          </thead>
          <tbody>
            {cardSummaries.map((card) => (
              <tr key={card.id} className="border-b border-stone-100">
                <td className="py-3 pr-3 font-semibold text-stone-900">{card.name}</td>
                <td className="py-3 pr-3 text-stone-600">{formatMoney(card.safeMinimumPayment)}</td>
                <td className="py-3 pr-3 text-stone-600">{formatMoney(card.safeRecommendedPayment)}</td>
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
                <td className="py-3 pr-3">
                  <FundingSourceSelect
                    buckets={financeData.reserveBuckets || []}
                    value={card.fundingSource}
                    onChange={(value) => updateCardPaymentFundingSource(card.id, value)}
                  />
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

function TransactionRow({ buckets, transaction, onDelete }) {
  return (
    <div className="grid gap-2 rounded-md border border-stone-200 bg-white p-3 text-sm sm:grid-cols-[0.9fr_1.5fr_1fr_0.8fr_1fr_auto] sm:items-center">
      <span className="text-stone-500">{formatDisplayDate(transaction.date)}</span>
      <span className="font-semibold text-stone-900">{transaction.description}</span>
      <span className="text-stone-600">{getCategoryLabel(transaction.category)}</span>
      <span className="font-bold text-stone-950">{formatMoney(transaction.amount)}</span>
      <span className="text-stone-600">Salió de {getFundingSourceLabel(transaction.fundingSource, buckets)}</span>
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
      <span>
        <span className="block font-semibold text-stone-900">{income.description}</span>
        <span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          {getExtraIncomeTypeLabel(income.type)}
        </span>
      </span>
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

function ExtraIncomeTypeSelect({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-stone-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
        value={normalizeExtraIncomeType(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {extraIncomeTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FundingSourceSelect({ buckets, label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-stone-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
        value={value || WEEKLY_INCOME_SOURCE}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={WEEKLY_INCOME_SOURCE}>Semana actual</option>
        {buckets.map((bucket) => (
          <option key={bucket.id} value={bucket.id}>
            {bucket.name}
          </option>
        ))}
      </select>
    </label>
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
            Otros ingresos {formatMoney(previewRecord.extraIncomeTotal)} · Supermercado {formatMoney(previewRecord.totals.groceries)} · Combustible {formatMoney(previewRecord.totals.fuel)} · Otros {formatMoney(previewRecord.totals.other)} · Reservas {formatMoney(previewRecord.reserveTransferTotal)} · {previewRecord.variableTransactions.length} transacciones
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

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
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
        <SmallResult label="Movido a reservas" value={formatMoney(previewRecord.reserveTransferTotal)} />
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
            summary={buildWeeklyMoneyFlowSummary({
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
                  <span>
                    <span className="block font-semibold text-stone-900">{income.description}</span>
                    <span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {getExtraIncomeTypeLabel(income.type)}
                    </span>
                  </span>
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
                className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 md:grid-cols-[0.9fr_1fr_1.5fr_0.8fr_auto] md:items-end"
              >
                <DateInput
                  label="Fecha"
                  value={income.date}
                  onChange={(value) => onUpdateExtraIncome(income.id, { date: value })}
                />
                <ExtraIncomeTypeSelect
                  label="Tipo"
                  value={income.type}
                  onChange={(value) => onUpdateExtraIncome(income.id, { type: value })}
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
                    value={normalizeTransactionCategory(transaction.category)}
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
  const totalOutflowMargin = Number(summary.totalOutflowMargin ?? summary.margin ?? 0);
  const resultLabel = totalOutflowMargin > 0 ? 'Sobró' : totalOutflowMargin < 0 ? 'Faltó' : 'Quedó justo';
  const resultTone = totalOutflowMargin > 0 ? 'positive' : totalOutflowMargin < 0 ? 'warning' : 'default';

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Ingresó" value={summary.totalIncome} tone="positive" />
        <SummaryTile label="Salió / reservado" value={summary.totalOutflow} tone="warning" />
        <SummaryTile
          label={resultLabel}
          value={Math.abs(totalOutflowMargin)}
          tone={resultTone}
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

        <CollapsibleMoneySection title="Transferido a reservas" total={summary.reserveTransferTotal} defaultOpen>
          {summary.reserveMovements.length > 0 ? (
            summary.reserveMovements.map((movement) => (
              <MoneyFlowRow
                key={movement.id}
                label={movement.bucketName}
                value={movement.amount}
                tone="positive"
              />
            ))
          ) : (
            <MoneyFlowRow label="Movido a reservas" value={0} />
          )}
          <MoneyFlowRow label="Total movido a reservas" value={summary.reserveTransferTotal} strong tone="positive" />
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
    variableTransactions: normalizeWeeklyRecordTransactions(activeWeek),
    payments: activeWeek.payments || [],
    reserveMovements: normalizeWeeklyReserveMovements(activeWeek),
    note: activeWeek.note || '',
    plannedGroceries,
    plannedFuel,
    plannedVariableBudget: plannedGroceries + plannedFuel,
  };
}

function normalizeWeeklyRecord(record, weeklySummary) {
  const variableTransactions = normalizeWeeklyRecordTransactions(record);
  const reserveMovements = normalizeWeeklyReserveMovements(record);
  const totals = calculateTransactionTotals(variableTransactions);
  const budgetSnapshot = record.budgetSnapshot || null;
  const realIncome = Number(record.realIncome ?? record.income ?? 0);
  const extraIncome = normalizeExtraIncome(record);
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const totalIncome = realIncome + extraIncomeTotal;
  const hasPaymentDetails = Array.isArray(record.payments) && record.payments.length > 0;
  const totalPaid = hasPaymentDetails ? calculatePaymentTotal(record.payments) : Number(record.totalPaid ?? 0);
  const weeklyFundedTotals = calculateTransactionTotals(
    variableTransactions.filter((transaction) => isWeeklyIncomeFunded(transaction)),
  );
  const weeklyFundedPaid = hasPaymentDetails ? calculateWeeklyFundedTotal(record.payments) : totalPaid;
  const reserveTransferTotal = calculateReserveMovementTotal(reserveMovements);
  const weeklyFundedReserveTransferTotal = calculateReserveMovementTotal(
    reserveMovements.filter((movement) => isWeeklyIncomeFunded(movement)),
  );
  const plannedGroceries = Number(record.plannedGroceries ?? budgetSnapshot?.plannedGroceries ?? weeklySummary.groceries ?? 0);
  const plannedFuel = Number(record.plannedFuel ?? budgetSnapshot?.plannedFuel ?? weeklySummary.fuel ?? 0);
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const variableDifference = plannedVariableBudget - totals.total;
  const realWeeklyMargin =
    totalIncome -
    Number(budgetSnapshot?.fixedWeeklyExpensesTotal ?? weeklySummary.weeklyExpensesTotal ?? 0) -
    Number(budgetSnapshot?.monthlyReserveWeekly ?? weeklySummary.monthlyReserveWeekly ?? 0) -
    weeklyFundedTotals.total -
    weeklyFundedPaid -
    weeklyFundedReserveTransferTotal;

  return {
    weekDate: record.weekDate || record.weekStartDate,
    realIncome,
    extraIncome,
    extraIncomeTotal,
    totalIncome,
    totalPaid,
    plannedVariableBudget,
    variableTransactions,
    reserveMovements,
    reserveTransferTotal,
    totals,
    variableDifference,
    realWeeklyMargin,
    note: record.note || '',
  };
}

function activeWeekHasRealData(activeWeek) {
  return (
    normalizeExtraIncome(activeWeek).length > 0 ||
    normalizeWeeklyRecordTransactions(activeWeek).length > 0 ||
    (activeWeek.payments || []).length > 0 ||
    Boolean((activeWeek.note || '').trim())
  );
}

function createEditableRecordDraft(record) {
  return {
    weekDate: record.weekDate || record.weekStartDate || getTodayIsoDate(),
    realIncome: Number(record.realIncome ?? record.income ?? 0),
    extraIncome: normalizeExtraIncome(record),
    variableTransactions: normalizeWeeklyRecordTransactions(record),
    payments: sanitizePayments(record.payments || []),
    note: record.note || '',
  };
}

function sanitizeExtraIncome(extraIncome) {
  return (extraIncome || [])
    .map((income, index) => ({
      id: income.id || `extra-income-${Date.now()}-${index}`,
      date: income.date || getTodayIsoDate(),
      type: normalizeExtraIncomeType(income.type),
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
      category: normalizeTransactionCategory(transaction.category),
      amount: Number(transaction.amount || 0),
      fundingSource: transaction.fundingSource || WEEKLY_INCOME_SOURCE,
    }))
    .filter((transaction) => transaction.amount > 0 || transaction.description.length > 0);
}

function sanitizePayments(payments) {
  return (payments || [])
    .map((payment) => ({
      cardId: payment.cardId,
      cardName: payment.cardName || 'Tarjeta',
      amount: Number(payment.amount || 0),
      fundingSource: payment.fundingSource || WEEKLY_INCOME_SOURCE,
    }))
    .filter((payment) => payment.cardId && payment.amount > 0);
}

function sanitizeReserveMovements(reserveMovements) {
  return (reserveMovements || [])
    .map((movement, index) => ({
      id: movement.id || `reserve-transfer-${Date.now()}-${index}`,
      date: movement.date || getTodayIsoDate(),
      bucketId: movement.bucketId,
      bucketName: movement.bucketName || 'Reserva',
      type: movement.type || 'deposit',
      fundingSource: movement.fundingSource || WEEKLY_INCOME_SOURCE,
      amount: Number(movement.amount || 0),
      note: movement.note || '',
    }))
    .filter((movement) => movement.bucketId && movement.amount > 0);
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
    type: normalizeExtraIncomeType(income.type),
    description: income.description || 'Ingreso extra',
    amount: Number(income.amount || 0),
  }));
}

function normalizeExtraIncomeType(type) {
  return extraIncomeTypes.some((item) => item.id === type) ? type : 'extra_income';
}

function getExtraIncomeTypeLabel(type) {
  const normalizedType = normalizeExtraIncomeType(type);
  return extraIncomeTypes.find((item) => item.id === normalizedType)?.label || 'Ingreso extra';
}

function getCategoryLabel(category) {
  return transactionCategories.find((item) => item.id === normalizeTransactionCategory(category))?.label || 'Otros';
}

function buildChosenPaymentMessage({ totalPaid, minimumDifference, recommendedDifference, marginAfterChosenPayment }) {
  if (totalPaid <= 0) {
    return 'Cargá cuánto pensás pagar por tarjeta y la app te dice si cubriste el mínimo semanal seguro o el pago recomendado total.';
  }

  if (minimumDifference < 0) {
    return `Te faltan ${formatMoney(Math.abs(minimumDifference))} para cubrir el mínimo semanal seguro.`;
  }

  if (marginAfterChosenPayment < 0) {
    return `Cubriste el mínimo semanal seguro, pero ese pago supera tu disponible para deudas por ${formatMoney(Math.abs(marginAfterChosenPayment))}.`;
  }

  if (recommendedDifference >= 0) {
    return `Cubriste el pago recomendado total. Tenés ${formatMoney(recommendedDifference)} por encima.`;
  }

  return `Cubriste el mínimo semanal seguro. Te faltarían ${formatMoney(Math.abs(recommendedDifference))} para llegar al recomendado total.`;
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
