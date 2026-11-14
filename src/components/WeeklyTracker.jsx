import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizePayments } from '../utils/activePaymentUtils.js';
import { getCardPaymentWarnings } from '../utils/cardPaymentUtils.js';
import { formatDisplayDate, formatIsoDate, parseDisplayDate } from '../utils/dateUtils.js';
import { getFundingSourceLabel, isWeeklyIncomeFunded, WEEKLY_INCOME_SOURCE } from '../utils/fundingSourceUtils.js';
import { formatMoney } from '../utils/moneyDisplay.js';
import { prepareHistoricalPayments, updateHistoricalPaymentAmount } from '../utils/historicalPaymentUtils.js';
import { buildReopenedWeekCorrection, closeReopenedFinancialWeek, getWeekReopenError } from '../utils/weekReopeningUtils.js';
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

function hasClosedRecordForWeek(weeklyRecords = [], weekStartDate) {
  return (weeklyRecords || []).some((record) => (record.weekStartDate || record.weekDate) === weekStartDate);
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

function createEmptyPayment(date = getTodayIsoDate(), cards = []) {
  return {
    date,
    cardId: cards[0]?.id || '',
    amount: '',
    fundingSource: WEEKLY_INCOME_SOURCE,
    note: '',
  };
}

function createActiveWeek({ weekStartDate, income, weeklySummary }) {
  const plannedGroceries = Number(weeklySummary.groceries || 0);
  const plannedFuel = Number(weeklySummary.fuel || 0);

  return {
    id: `active-week-${weekStartDate}`,
    pristineFinancialWeek: true,
    weekStartDate,
    weekDate: weekStartDate,
    openingBalance: 0,
    income: 0,
    realIncome: 0,
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
  onAddCardPayment,
  onDeleteCardPayment,
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
  const [transactionDraft, setTransactionDraft] = useState(createEmptyTransaction(getTodayIsoDate()));
  const [extraIncomeDraft, setExtraIncomeDraft] = useState(createEmptyExtraIncome(getTodayIsoDate()));
  const [paymentDraft, setPaymentDraft] = useState(createEmptyPayment(getTodayIsoDate(), financeData.cards));
  const paymentSubmission = useRef(false);
  const selectedPaymentReserve = (financeData.reserveBuckets || []).find((bucket) => bucket.id === paymentDraft.fundingSource);
  const [expandedRecordIds, setExpandedRecordIds] = useState({});
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingRecordDraft, setEditingRecordDraft] = useState(null);
  const [editingPaymentError, setEditingPaymentError] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [dismissedPendingWeekWarning, setDismissedPendingWeekWarning] = useState(false);
  const [showOpeningBalanceInput, setShowOpeningBalanceInput] = useState(false);

  useEffect(() => {
    if (activeWeek) return;
    if (hasClosedRecordForWeek(financeData.weeklyRecords, financialWeekStartDate)) return;

    onStartActiveWeek(
      createActiveWeek({
        weekStartDate: financialWeekStartDate,
        weeklySummary,
      }),
    );
  }, [activeWeek, financeData.weeklyRecords, financialWeekStartDate, onStartActiveWeek, weeklySummary]);

  useEffect(() => {
    setTransactionDraft((currentDraft) => ({
      ...currentDraft,
      date: currentDraft.date || getTodayIsoDate(),
    }));
    setExtraIncomeDraft((currentDraft) => ({
      ...currentDraft,
      date: currentDraft.date || getTodayIsoDate(),
    }));
    setPaymentDraft((currentDraft) => ({
      ...currentDraft,
      cardId: currentDraft.cardId || financeData.cards[0]?.id || '',
      date: currentDraft.date || getTodayIsoDate(),
    }));
  }, [financeData.cards]);

  const currentFinancialWeekClosed = hasClosedRecordForWeek(financeData.weeklyRecords, financialWeekStartDate);
  const normalizedActiveWeek = activeWeek ? normalizeActiveWeek(activeWeek, weeklySummary) : null;
  const hasPendingPreviousWeek = Boolean(normalizedActiveWeek && normalizedActiveWeek.weekStartDate !== financialWeekStartDate);
  const pendingWeekDays = normalizedActiveWeek ? calculateDaysBetween(normalizedActiveWeek.weekStartDate, financialWeekStartDate) : 0;
  const showPendingWeekWarning = hasPendingPreviousWeek && !dismissedPendingWeekWarning && !activeWeek?.reopenedFromHistory;
  const openingBalance = Number(normalizedActiveWeek?.openingBalance || 0);
  const showOpeningBalanceControl = showOpeningBalanceInput || openingBalance > 0;
  const extraIncome = normalizedActiveWeek?.extraIncome || [];
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const totalIncome = openingBalance + Number(normalizedActiveWeek?.realIncome || 0) + extraIncomeTotal;
  const variableTransactions = normalizedActiveWeek?.variableTransactions || [];
  const reserveMovements = normalizedActiveWeek?.reserveMovements || [];
  const transactionTotals = calculateTransactionTotals(variableTransactions);
  const weeklyFundedTransactionTotals = calculateTransactionTotals(
    variableTransactions.filter((transaction) => isWeeklyIncomeFunded(transaction)),
  );
  const plannedGroceries = normalizedActiveWeek?.plannedGroceries || 0;
  const plannedFuel = normalizedActiveWeek?.plannedFuel || 0;
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const actualVariableSpent = transactionTotals.total;
  const groceriesDifference = plannedGroceries - transactionTotals.groceries;
  const fuelDifference = plannedFuel - transactionTotals.fuel;
  const variableDifference = plannedVariableBudget - actualVariableSpent;
  const payments = normalizedActiveWeek?.payments || [];
  const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const weeklyFundedPaid = calculateWeeklyFundedTotal(payments);
  const weeklyFundedReserveTransfers = calculateReserveMovementTotal(
    reserveMovements.filter((movement) => isWeeklyIncomeFunded(movement)),
  );
  const reserveTransferTotal = calculateReserveMovementTotal(reserveMovements);
  const weeklyGemBuffer = Number(weeklySummary.gemMinimumSummary?.weeklyBuffer || 0);
  const minimumSafeWeeklyPayment = Number(weeklySummary.minimumToAvoidExpiry || 0) + weeklyGemBuffer;
  const marginAfterMinimumSafe =
    totalIncome -
    Number(weeklySummary.weeklyExpensesTotal || 0) -
    Number(weeklySummary.monthlyReserveWeekly || 0) -
    Number(weeklySummary.groceries || 0) -
    Number(weeklySummary.fuel || 0) -
    minimumSafeWeeklyPayment;
  const minimumDifference = totalPaid - minimumSafeWeeklyPayment;
  const realWeeklyMargin =
    totalIncome -
    Number(weeklySummary.weeklyExpensesTotal || 0) -
    Number(weeklySummary.monthlyReserveWeekly || 0) -
    weeklyFundedTransactionTotals.total -
    weeklyFundedPaid -
    weeklyFundedReserveTransfers;
  const activeWeekMoneyFlowSummary = normalizedActiveWeek
    ? buildWeeklyMoneyFlowSummary({
        financeData,
        record: normalizedActiveWeek,
        useCurrentBudget: true,
        weeklySummary,
      })
    : null;
  const activeWeekWeeklyMargin = Number(activeWeekMoneyFlowSummary?.margin ?? 0);
  const activeWeekResultLabel =
    activeWeekWeeklyMargin > 0 ? 'Margen calculado' : activeWeekWeeklyMargin < 0 ? 'Faltante calculado' : 'Resultado calculado en cero';
  const marginAfterChosenPayment = weeklySummary.availableForDebt - weeklyFundedPaid;
  const chosenPaymentMessage = buildChosenPaymentMessage({
    totalPaid,
    minimumDifference,
    marginAfterChosenPayment,
  });
  const savedRecords = [...(financeData.weeklyRecords || [])].reverse();
  const gemCardIds = new Set(weeklySummary.gemMinimumSummary?.cardIds || []);
  const cardSummaries = financeData.cards.map((card) => {
    const plans = weeklySummary.plans.filter((plan) => plan.cardId === card.id);
    const minimumPayment = plans.reduce((total, plan) => total + Number(plan.recommendedPayment || 0), 0);
    const cardGemBuffer = gemCardIds.has(card.id) ? weeklyGemBuffer : 0;

    return {
      ...card,
      minimumPayment,
      safeMinimumPayment: minimumPayment + cardGemBuffer,
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

  function updateOpeningBalance(amount) {
    updateActiveWeek({
      openingBalance: Number(amount || 0),
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
      date: extraIncomeDraft.date || getTodayIsoDate(),
      type,
      description,
      amount,
    };

    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      extraIncome: [...normalizeExtraIncome(currentWeek), nextIncome],
    }));
    setExtraIncomeDraft({
      date: getTodayIsoDate(),
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
      date: transactionDraft.date || getTodayIsoDate(),
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
      date: getTodayIsoDate(),
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

  function updatePaymentDraft(field, value) {
    paymentSubmission.current = false;
    setPaymentDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function addCardPayment() {
    const amount = Number(paymentDraft.amount || 0);
    if (paymentSubmission.current || !activeWeek || activeWeek.reopenedFromHistory ||
        !paymentDraft.cardId || !Number.isFinite(amount) || amount <= 0) return;
    paymentSubmission.current = true;

    const selectedCard = financeData.cards.find((card) => card.id === paymentDraft.cardId);
    const nextPayment = {
      id: `payment-${crypto.randomUUID()}`,
      date: paymentDraft.date || getTodayIsoDate(),
      cardId: paymentDraft.cardId,
      cardName: selectedCard?.name || 'Tarjeta',
      amount,
      fundingSource: paymentDraft.fundingSource || WEEKLY_INCOME_SOURCE,
      note: paymentDraft.note || '',
    };

    const warnings = getCardPaymentWarnings(financeData, nextPayment, getTodayIsoDate());
    if (warnings.length && !window.confirm(`${warnings.join('\n\n')}\n\n¿Querés registrar este pago de todos modos?`)) {
      paymentSubmission.current = false;
      return;
    }
    onAddCardPayment(nextPayment);
    setPaymentDraft((currentDraft) => ({
      ...currentDraft,
      date: getTodayIsoDate(),
      amount: '',
      note: '',
    }));
  }

  function deleteCardPayment(paymentId) {
    onDeleteCardPayment(paymentId);
  }

  function fillCardPayments(amountKey) {
    if (
      payments.length > 0 &&
      !window.confirm('Esto reemplaza todos los pagos cargados esta semana por el mínimo seguro automático. ¿Querés continuar?')
    ) {
      return;
    }

    payments.forEach((payment) => applyReserveDelta(payment, null));
    onUpdateActiveWeek((currentWeek) => ({
      ...currentWeek,
      payments: cardSummaries
        .map((card) => ({
          id: `payment-auto-${card.id}-${Date.now()}`,
          date: getTodayIsoDate(),
          cardId: card.id,
          cardName: card.name,
          amount: Number(card[amountKey] || 0),
          fundingSource: WEEKLY_INCOME_SOURCE,
          note: 'Mínimo seguro automático',
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
    if (editingRecordDraft || transactionDraft.description.trim() || transactionDraft.amount !== '' ||
        extraIncomeDraft.description.trim() || extraIncomeDraft.amount !== '' || paymentDraft.amount !== '' || paymentDraft.note.trim()) {
      setReopenError('Guardá o cancelá la edición y registrá los movimientos pendientes antes de reabrir otra semana. No se modificó ningún dato.');
      return;
    }
    const error = getWeekReopenError(financeData, record.id);
    setReopenError(error);
    if (error) return;
    onReopenWeek(record.id);
  }

  function startEditingRecord(record) {
    setEditingPaymentError('');
    setEditingRecordId(record.id);
    setEditingRecordDraft(createEditableRecordDraft(record));
    setExpandedRecordIds((currentExpandedIds) => ({
      ...currentExpandedIds,
      [record.id]: true,
    }));
  }

  function cancelEditingRecord() {
    setEditingPaymentError('');
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

  function updateEditingPayment(paymentIndex, amount) {
    setEditingPaymentError('');
    setEditingRecordDraft((currentDraft) => ({
      ...currentDraft,
      payments: updateHistoricalPaymentAmount(currentDraft.payments, paymentIndex, amount),
    }));
  }

  function saveEditingRecord(originalRecord) {
    if (!editingRecordDraft || !onUpdateWeek) return;

    const variableTransactions = sanitizeTransactions(editingRecordDraft.variableTransactions);
    const extraIncome = sanitizeExtraIncome(editingRecordDraft.extraIncome);
    let payments;
    try {
      payments = prepareHistoricalPayments(originalRecord.payments || [], editingRecordDraft.payments, financeData.cards);
    } catch (error) {
      setEditingPaymentError(error.message);
      return;
    }

    onUpdateWeek(originalRecord.id, (currentRecord) => ({
      ...currentRecord,
      income: Number(editingRecordDraft.realIncome || 0),
      realIncome: Number(editingRecordDraft.realIncome || 0),
      extraIncome,
      variableTransactions,
      ...(Array.isArray(currentRecord.payments) ? { payments } : {}),
      note: editingRecordDraft.note || '',
      totalPaid: payments.length > 0 ? calculatePaymentTotal(payments) : currentRecord.totalPaid ?? 0,
      updatedAt: new Date().toISOString(),
    }));
    cancelEditingRecord();
  }

  function closeWeek() {
    if (activeWeek?.reopenedFromHistory) {
      onCloseWeek(closeReopenedFinancialWeek(activeWeek));
      return;
    }
    if (!normalizedActiveWeek) return;
    if (transactionDraft.description.trim() || transactionDraft.amount !== '' || extraIncomeDraft.description.trim() ||
        extraIncomeDraft.amount !== '' || paymentDraft.amount !== '' || paymentDraft.note.trim()) {
      setReopenError('Hay movimientos sin registrar en los formularios. Registralos o vaciá esos campos antes de cerrar la semana.');
      return;
    }

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
      openingBalance: Number(normalizedActiveWeek.openingBalance || 0),
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

    const { pristineFinancialWeek, ...recordToSave } = closedRecord;
    onCloseWeek(recordToSave);
    setTransactionDraft(createEmptyTransaction(getTodayIsoDate()));
    setExtraIncomeDraft(createEmptyExtraIncome(getTodayIsoDate()));
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      {reopenError && <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{reopenError}</p>}
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

      {activeWeek?.reopenedFromHistory ? (
        <ReopenedWeekPanel key={activeWeek.id} record={activeWeek} financeData={financeData} weeklySummary={weeklySummary} onUpdate={onUpdateActiveWeek} onClose={closeWeek} />
      ) : normalizedActiveWeek ? (
      <div className="grid gap-3">
        <CollapsiblePanel
          title="Control de la semana financiera"
          summary={`${formatDisplayDate(normalizedActiveWeek.weekStartDate)} · ingresos ingresados ${formatMoney(totalIncome)}`}
          defaultOpen={false}
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
              <MoneyInput label="Ingreso principal ingresado" value={normalizedActiveWeek.realIncome} onChange={updateRealIncome} />
            </div>
          </div>

          <div className="mt-4">
            {showOpeningBalanceControl ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                <MoneyInput
                  label="Saldo inicial / arrastre anterior"
                  value={normalizedActiveWeek.openingBalance}
                  onChange={updateOpeningBalance}
                />
                <p className="mt-2 text-xs text-sky-800">
                  Plata que ya venía de semanas anteriores. No cuenta como ingreso nuevo.
                </p>
              </div>
            ) : (
              <button
                className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                type="button"
                onClick={() => setShowOpeningBalanceInput(true)}
              >
                Agregar saldo inicial / arrastre anterior
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {openingBalance > 0 ? (
              <SummaryTile label="Saldo inicial" value={openingBalance} tone="positive" />
            ) : null}
            <SummaryTile label="Ingreso principal" value={normalizedActiveWeek.realIncome} />
            <SummaryTile label="Otros ingresos" value={extraIncomeTotal} />
            <SummaryTile label="Total de ingresos ingresados" value={totalIncome} tone="positive" />
            <SummaryTile label="Mínimo semanal seguro" value={minimumSafeWeeklyPayment} tone="warning" />
            <SummaryTile
              helper="Si pagás el mínimo seguro y usás el presupuesto completo."
              label="Proyección con presupuesto"
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

        <p className="my-2 text-sm text-stone-600">Movimientos registrados: pueden ser parciales. No es el saldo del banco. Las compras que no cargaste no están incluidas. Incluye gastos fijos y mensuales según presupuesto.</p>
        <CollapsiblePanel
          title="Compras registradas (opcional)"
          summary={variableTransactions.length ? `${variableTransactions.length} compras registradas · ${formatMoney(actualVariableSpent)}` : 'No cargaste compras'}
          defaultOpen={false}
        >
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Compras registradas (opcional)</h3>
              <p className="mt-1 text-sm text-stone-500">Podés cargar compras por categoría si querés llevar el detalle. No hace falta cargarlas todas para cerrar la semana.</p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
              {variableTransactions.length ? `${variableTransactions.length} compras registradas` : 'No cargaste compras'}
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
              No cargaste compras. Esto no significa que no hayas gastado.
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
          title="Resultado calculado con movimientos registrados"
          summary={`${activeWeekResultLabel} ${formatMoney(Math.abs(activeWeekWeeklyMargin))}`}
          defaultOpen={false}
        >
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Resultado calculado con movimientos registrados</p>
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
      </div>

      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-600">Agregar pago</p>
        {selectedPaymentReserve && (
          <p className="mt-2 text-sm text-amber-900" role="note">
            Origen: <strong>{selectedPaymentReserve.name}</strong> · Saldo actual: {formatMoney(selectedPaymentReserve.balance)}.
            {' '}Registrar este pago ya descuenta del sobre. No registres además un retiro manual.
            {' '}Actualizá los saldos de los planes después de consultar Latitude.
          </p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-[0.9fr_1fr_0.8fr_1fr_1.3fr_auto] md:items-end">
          <DateInput
            label="Fecha"
            value={paymentDraft.date}
            onChange={(value) => updatePaymentDraft('date', value)}
          />
          <label className="text-sm font-medium text-stone-600">
            Tarjeta
            <select
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              value={paymentDraft.cardId}
              onChange={(event) => updatePaymentDraft('cardId', event.target.value)}
            >
              {financeData.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>
          <MoneyInput label="Monto" value={paymentDraft.amount} onChange={(value) => updatePaymentDraft('amount', value)} />
          <FundingSourceSelect
            buckets={financeData.reserveBuckets || []}
            label="Origen"
            value={paymentDraft.fundingSource}
            onChange={(value) => updatePaymentDraft('fundingSource', value)}
          />
          <label className="text-sm font-medium text-stone-600">
            Nota
            <input
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              type="text"
              value={paymentDraft.note}
              onChange={(event) => updatePaymentDraft('note', event.target.value)}
              placeholder="Pago principal, Cami GEM..."
            />
          </label>
          <button
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
            type="button"
            onClick={addCardPayment}
            disabled={!Number.isFinite(Number(paymentDraft.amount)) || Number(paymentDraft.amount) <= 0}
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-600">Pagos registrados</p>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
            {payments.length} pagos
          </span>
        </div>
        {payments.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="grid gap-1 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm md:grid-cols-[0.8fr_1fr_0.8fr_1fr_1.4fr_auto] md:items-center"
              >
                <span className="text-stone-500">{formatDisplayDate(payment.date)}</span>
                <span className="font-semibold text-stone-900">
                  {payment.cardName || financeData.cards.find((card) => card.id === payment.cardId)?.name || 'Tarjeta'}
                </span>
                <span className="font-bold text-stone-950">{formatMoney(payment.amount)}</span>
                <span className="text-stone-600">Salió de {getFundingSourceLabel(payment.fundingSource, financeData.reserveBuckets || [])}</span>
                <span className="text-stone-500">{payment.note || '-'}</span>
                <button
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                  type="button"
                  onClick={() => deleteCardPayment(payment.id)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-stone-300 bg-stone-50 p-3 text-sm text-stone-500">
            Todavía no cargaste pagos para esta semana.
          </p>
        )}
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
      ) : (
        <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          {currentFinancialWeekClosed ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Semana actual cerrada</p>
              <h2 className="mt-1 text-lg font-semibold text-stone-950">Semana actual cerrada</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                La semana financiera del {formatDisplayDate(financialWeekStartDate)} ya fue cerrada. La próxima semana se abrirá automáticamente cuando empiece el nuevo ciclo.
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-stone-900">Preparando semana actual...</p>
          )}
        </section>
      )}

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
                editingPaymentError={editingRecordId === record.id ? editingPaymentError : ''}
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

function ReopenedWeekPanel({ record, financeData, weeklySummary, onUpdate, onClose }) {
  const makeDraft = () => ({ income: record.realIncome ?? record.income ?? 0, note: record.note || '', payments: (record.payments || []).map((payment) => ({ ...payment })) });
  const [draft, setDraft] = useState(makeDraft);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(makeDraft()); setError(''); }, [record]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(makeDraft());
  function saveCorrections() {
    try {
      const patch = buildReopenedWeekCorrection(record, draft, financeData.cards);
      if (Object.keys(patch).length) onUpdate(patch);
      else setDraft(makeDraft());
      setError('');
    } catch (issue) { setError(issue.message); }
  }
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Semana histórica reabierta · {formatDisplayDate(record.weekStartDate || record.weekDate)}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Ingreso principal ingresado
          <input className="mt-1 w-full rounded-md border p-2" type="number" min="0" step="0.01" value={draft.income} onChange={(event) => setDraft({ ...draft, income: event.target.value })} />
        </label>
        <label className="text-sm">Nota
          <textarea aria-label="Nota" className="mt-1 w-full rounded-md border p-2" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {draft.payments.map((payment, index) => (
          <div key={`${payment.id || 'legacy'}-${index}`} className="min-w-0 rounded-md border p-3">
            <p className="break-words text-sm font-semibold">Pago {index + 1} · {payment.cardName || financeData.cards.find((card) => card.id === payment.cardId)?.name || 'Tarjeta anterior'}</p>
            <p className="text-sm">{formatDisplayDate(payment.date || record.weekStartDate || record.weekDate)} · {getFundingSourceLabel(payment, financeData.reserveBuckets || [])}</p>
            {payment.note && <p className="break-words text-sm">{payment.note}</p>}
            <label className="mt-2 block text-sm">Importe del pago {index + 1}
              <input className="mt-1 w-full min-w-0 rounded-md border p-2 disabled:bg-stone-100" type="number" min="0.01" step="0.01" value={payment.amount ?? ''}
                disabled={!isWeeklyIncomeFunded(payment) || !financeData.cards.some((card) => card.id === payment.cardId)}
                onChange={(event) => setDraft({ ...draft, payments: updateHistoricalPaymentAmount(draft.payments, index, event.target.value) })} />
            </label>
          </div>
        ))}
      </div>
      <p className="text-sm text-stone-600">Los ingresos adicionales, gastos y movimientos de reservas existentes se conservan. Los pagos desde reservas y las transferencias quedan protegidos hasta poder conciliar sus saldos.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={!dirty} onClick={saveCorrections}>Guardar correcciones</button>
        <button className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={!dirty} onClick={() => { setDraft(makeDraft()); setError(''); }}>Cancelar correcciones</button>
        <button className="rounded-md bg-stone-950 px-3 py-2 text-white disabled:opacity-50" disabled={dirty} onClick={onClose}>Volver a cerrar semana</button>
      </div>
      {dirty && <p className="text-sm text-amber-800">Guardá o cancelá las correcciones antes de volver a cerrar. Todavía no están guardadas.</p>}
      <MoneyFlowPanel summary={buildWeeklyMoneyFlowSummary({ financeData, record, weeklySummary, useCurrentBudget: false })} />
    </div>
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
  editingPaymentError,
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
            <strong className="text-stone-950">{formatDisplayDate(previewRecord.weekDate)}</strong> · Ingreso principal {formatMoney(previewRecord.realIncome)} · Total de ingresos ingresados {formatMoney(previewRecord.totalIncome)} · Pagado a deudas {formatMoney(previewRecord.totalPaid)}
          </p>
          <p className="mt-1 text-stone-500">
            {previewRecord.openingBalance > 0 ? `Saldo inicial ${formatMoney(previewRecord.openingBalance)} · ` : ''}Otros ingresos {formatMoney(previewRecord.extraIncomeTotal)} · Supermercado {formatMoney(previewRecord.totals.groceries)} · Combustible {formatMoney(previewRecord.totals.fuel)} · Otros {formatMoney(previewRecord.totals.other)} · Reservas {formatMoney(previewRecord.reserveTransferTotal)} · {previewRecord.variableTransactions.length} transacciones
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

      <p className="my-2 text-sm text-stone-600">Movimientos registrados: pueden ser parciales. No es el saldo del banco. Las compras que no cargaste no están incluidas. Incluye gastos fijos y mensuales según presupuesto.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <SmallResult
          label={previewRecord.variableDifference >= 0 ? 'Registrado por debajo del presupuesto' : 'Registrado por encima del presupuesto'}
          value={formatMoney(Math.abs(previewRecord.variableDifference))}
          tone={variableTone}
        />
        <SmallResult
          label={previewRecord.realWeeklyMargin >= 0 ? 'Margen calculado con registros' : 'Faltante calculado con registros'}
          value={formatMoney(Math.abs(previewRecord.realWeeklyMargin))}
          tone={marginTone}
        />
        <SmallResult label="Movido a reservas" value={formatMoney(previewRecord.reserveTransferTotal)} />
        <SmallResult label="Compras registradas" value={formatMoney(previewRecord.totals.total)} />
      </div>

      {editingDraft ? (
        <ClosedWeekEditor
          cards={cards}
          draft={editingDraft}
          paymentError={editingPaymentError}
          buckets={financeData.reserveBuckets || []}
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
                openingBalance: previewRecord.openingBalance,
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
            {previewRecord.openingBalance > 0 ? (
              <SmallResult label="Saldo inicial" value={formatMoney(previewRecord.openingBalance)} tone="positive" />
            ) : null}
            <SmallResult label="Otros ingresos" value={formatMoney(previewRecord.extraIncomeTotal)} tone={previewRecord.extraIncomeTotal > 0 ? 'positive' : 'default'} />
            <SmallResult label="Total de ingresos ingresados" value={formatMoney(previewRecord.totalIncome)} tone="positive" />
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
  buckets,
  paymentError,
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
          label="Ingreso principal ingresado"
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
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Otros ingresos ingresados</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Compras registradas</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Pagos registrados a deudas</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {draft.payments.map((payment, index) => {
            const reserveFunded = !isWeeklyIncomeFunded(payment);
            const card = cards.find((item) => item.id === payment.cardId);
            return (
              <div key={`${payment.id || 'legacy'}-${index}`} className="min-w-0 rounded-md border border-stone-200 p-3">
                <p className="break-words text-sm font-semibold">Pago {index + 1} · {payment.cardName || card?.name || 'Tarjeta anterior'}</p>
                <p className="mt-1 text-sm text-stone-600">{formatDisplayDate(payment.date || draft.weekDate)} · {getFundingSourceLabel(payment, buckets)}</p>
                {payment.note && <p className="mt-1 break-words text-sm text-stone-600">{payment.note}</p>}
                <label className="mt-2 block text-sm text-stone-600">
                  Importe del pago {index + 1}
                  <input className="mt-1 w-full min-w-0 rounded-md border border-stone-300 px-3 py-2 disabled:bg-stone-100"
                    type="number" min="0.01" step="0.01" value={payment.amount ?? ''}
                    disabled={reserveFunded || !card}
                    onChange={(event) => onUpdatePayment(index, event.target.value)} />
                </label>
                {reserveFunded && <p className="mt-2 text-xs text-amber-800">El importe está protegido porque salió de una reserva. Su corrección requiere conciliar saldos.</p>}
                {!card && <p className="mt-2 text-xs text-amber-800">La tarjeta ya no existe. Conservamos este pago sin modificarlo.</p>}
              </div>
            );
          })}
          {draft.payments.length === 0 && <p className="text-sm text-stone-500">Esta semana no tiene pagos individuales registrados.</p>}
        </div>
        {paymentError && <p role="alert" className="mt-2 text-sm text-red-700">{paymentError}</p>}
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
    <div className="min-w-0 rounded-lg border border-stone-200 bg-white shadow-sm">
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
  const weeklyMargin = Number(summary.margin ?? 0);
  const resultLabel = weeklyMargin > 0 ? 'Margen calculado' : weeklyMargin < 0 ? 'Faltante calculado' : 'Resultado calculado en cero';
  const resultTone = weeklyMargin > 0 ? 'positive' : weeklyMargin < 0 ? 'warning' : 'default';
  const totalOutflowMargin = Number(summary.totalOutflowMargin ?? 0);

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Ingresó" value={summary.totalIncome} tone="positive" />
        <SummaryTile label="Salió de semana actual" value={summary.weeklyIncomeOutflow} tone="warning" />
        <SummaryTile
          label={resultLabel}
          value={Math.abs(weeklyMargin)}
          tone={resultTone}
        />
      </div>

      <div className="grid gap-3">
        <CollapsibleMoneySection title="Ingresos" total={summary.totalIncome} defaultOpen={false}>
          {summary.openingBalance > 0 ? (
            <MoneyFlowRow label="Saldo inicial / arrastre anterior" value={summary.openingBalance} tone="positive" />
          ) : null}
          <MoneyFlowRow label="Ingreso principal" value={summary.primaryIncome} tone="positive" />
          <MoneyFlowRow label="Otros ingresos" value={summary.extraIncomeTotal} tone={summary.extraIncomeTotal > 0 ? 'positive' : 'default'} />
          <MoneyFlowRow label="Total de ingresos ingresados" value={summary.totalIncome} strong tone="positive" />
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

        <CollapsibleMoneySection title="Compras y pagos registrados" total={summary.variableTotals.total + summary.totalPaid} defaultOpen>
          <MoneyFlowRow label="Supermercado" value={summary.variableTotals.groceries} />
          <MoneyFlowRow label="Combustible" value={summary.variableTotals.fuel} />
          <MoneyFlowRow label="Otros variables" value={summary.variableTotals.other} />
          <MoneyFlowRow label="Pagos a deudas" value={summary.totalPaid} />
          <MoneyFlowRow label="Total de compras y pagos registrados" value={summary.variableTotals.total + summary.totalPaid} strong tone="warning" />
        </CollapsibleMoneySection>

        <CollapsibleMoneySection title="Usado desde reservas" total={summary.reserveFundedTotal} defaultOpen={summary.reserveFundedTotal > 0}>
          <MoneyFlowRow label="Supermercado desde reservas" value={summary.reserveFundedVariableTotals.groceries} />
          <MoneyFlowRow label="Combustible desde reservas" value={summary.reserveFundedVariableTotals.fuel} />
          <MoneyFlowRow label="Otros desde reservas" value={summary.reserveFundedVariableTotals.other} />
          <MoneyFlowRow label="Pagos a deudas desde reservas" value={summary.reserveFundedPaid} />
          <MoneyFlowRow label="Total usado desde reservas" value={summary.reserveFundedTotal} strong tone="warning" />
        </CollapsibleMoneySection>

        <CollapsibleMoneySection title="Movimiento total registrado" total={summary.totalOutflow} defaultOpen={false}>
          <MoneyFlowRow label="Salida total incluyendo reservas" value={summary.totalOutflow} strong tone="warning" />
          <MoneyFlowRow
            label={totalOutflowMargin >= 0 ? 'Diferencia total registrada' : 'Exceso total registrado'}
            value={Math.abs(totalOutflowMargin)}
            tone={totalOutflowMargin >= 0 ? 'positive' : 'warning'}
          />
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
    openingBalance: Number(activeWeek.openingBalance || 0),
    realIncome: Number(activeWeek.realIncome ?? activeWeek.income ?? 0),
    extraIncome: normalizeExtraIncome(activeWeek),
    variableTransactions: normalizeWeeklyRecordTransactions(activeWeek),
    payments: sanitizePayments(activeWeek.payments || [], activeWeek.weekStartDate || activeWeek.weekDate),
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
  const openingBalance = Number(record.openingBalance || 0);
  const realIncome = Number(record.realIncome ?? record.income ?? 0);
  const extraIncome = normalizeExtraIncome(record);
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const totalIncome = openingBalance + realIncome + extraIncomeTotal;
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
    openingBalance,
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

function createEditableRecordDraft(record) {
  return {
    weekDate: record.weekDate || record.weekStartDate || getTodayIsoDate(),
    openingBalance: Number(record.openingBalance || 0),
    realIncome: Number(record.realIncome ?? record.income ?? 0),
    extraIncome: normalizeExtraIncome(record),
    variableTransactions: normalizeWeeklyRecordTransactions(record),
    payments: (record.payments || []).map((payment) => ({ ...payment })),
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

function buildChosenPaymentMessage({ totalPaid, minimumDifference, marginAfterChosenPayment }) {
  if (totalPaid <= 0) {
    return 'Cargá cuánto pensás pagar por tarjeta y la app te dice si cubriste el mínimo semanal seguro.';
  }

  if (minimumDifference < 0) {
    return `Te faltan ${formatMoney(Math.abs(minimumDifference))} para cubrir el mínimo semanal seguro.`;
  }

  if (marginAfterChosenPayment < 0) {
    return `Cubriste el mínimo semanal seguro, pero ese pago supera tu disponible para deudas por ${formatMoney(Math.abs(marginAfterChosenPayment))}.`;
  }

  return `Cubriste el mínimo semanal seguro. Si querés acelerar deuda, podés pagar más manualmente.`;
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

function SummaryTile({ label, value, helper, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-stone-50',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-950">{formatMoney(value)}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-stone-500">{helper}</p> : null}
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
