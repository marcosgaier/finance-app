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

function createEmptyTransaction(date = getTodayIsoDate()) {
  return {
    date,
    description: '',
    category: 'groceries',
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
  onIncomeChange,
  onStartActiveWeek,
  onUpdateActiveWeek,
  onUpdateWeek,
}) {
  const financialWeekStartDate = useMemo(() => getCurrentFinancialWeekStartDate(), []);
  const activeWeek = financeData.activeWeek;
  const [transactionDraft, setTransactionDraft] = useState(createEmptyTransaction(financialWeekStartDate));
  const [expandedRecordIds, setExpandedRecordIds] = useState({});
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingRecordDraft, setEditingRecordDraft] = useState(null);

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
  }, [activeWeek?.weekStartDate, financialWeekStartDate]);

  if (!activeWeek) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-stone-900">Preparando semana actual...</p>
      </section>
    );
  }

  const normalizedActiveWeek = normalizeActiveWeek(activeWeek, weeklySummary);
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
    Number(normalizedActiveWeek.realIncome || 0) -
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
    onIncomeChange(nextIncome);
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
    const payments = sanitizePayments(editingRecordDraft.payments);

    onUpdateWeek(originalRecord.id, (currentRecord) => ({
      ...currentRecord,
      income: Number(editingRecordDraft.realIncome || 0),
      realIncome: Number(editingRecordDraft.realIncome || 0),
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
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
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
        <SummaryTile label="Mínimo para no vencer" value={weeklySummary.minimumToAvoidExpiry} />
        <SummaryTile label="Pago inteligente" value={weeklySummary.recommendedPayment} />
        <SummaryTile
          label={minimumDifference >= 0 ? 'Diferencia a favor' : 'Te falta cubrir'}
          value={Math.abs(minimumDifference)}
          tone={minimumDifference >= 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
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

        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Resultado real de la semana</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Supermercado real" value={transactionTotals.groceries} />
            <SummaryTile
              label={groceriesDifference >= 0 ? 'Super: de menos' : 'Super: de más'}
              value={Math.abs(groceriesDifference)}
              tone={groceriesDifference >= 0 ? 'positive' : 'warning'}
            />
            <SummaryTile label="Combustible real" value={transactionTotals.fuel} />
            <SummaryTile
              label={fuelDifference >= 0 ? 'Nafta: de menos' : 'Nafta: de más'}
              value={Math.abs(fuelDifference)}
              tone={fuelDifference >= 0 ? 'positive' : 'warning'}
            />
            <SummaryTile label="Otros reales" value={transactionTotals.other} />
            <SummaryTile
              label={variableDifference >= 0 ? 'Total: gasté de menos' : 'Total: gasté de más'}
              value={Math.abs(variableDifference)}
              tone={variableDifference >= 0 ? 'positive' : 'warning'}
            />
            <SummaryTile
              label={realWeeklyMargin >= 0 ? 'Margen real' : 'Faltante real'}
              value={Math.abs(realWeeklyMargin)}
              tone={realWeeklyMargin >= 0 ? 'positive' : 'warning'}
            />
            <SummaryTile label="Gasto variable total" value={actualVariableSpent} />
          </div>
        </div>
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

      {savedRecords.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-stone-900">Semanas cerradas</h3>
          <div className="mt-2 grid gap-3">
            {savedRecords.map((record) => (
              <WeeklyRecordItem
                key={record.id}
                expanded={Boolean(expandedRecordIds[record.id])}
                record={record}
                cards={financeData.cards}
                editingDraft={editingRecordId === record.id ? editingRecordDraft : null}
                weeklySummary={weeklySummary}
                onDeleteWeek={onDeleteWeek}
                onAddEditingTransaction={addEditingTransaction}
                onCancelEditing={cancelEditingRecord}
                onDeleteEditingTransaction={deleteEditingTransaction}
                onSaveEditing={() => saveEditingRecord(record)}
                onStartEditing={() => startEditingRecord(record)}
                onToggleDetails={() => toggleRecordDetails(record.id)}
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

function WeeklyRecordItem({
  expanded,
  record,
  cards,
  editingDraft,
  weeklySummary,
  onDeleteWeek,
  onAddEditingTransaction,
  onCancelEditing,
  onDeleteEditingTransaction,
  onSaveEditing,
  onStartEditing,
  onToggleDetails,
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
            <strong className="text-stone-950">{formatDisplayDate(previewRecord.weekDate)}</strong> · Cobrado {formatMoney(previewRecord.realIncome)} · Pagado a deudas {formatMoney(previewRecord.totalPaid)}
          </p>
          <p className="mt-1 text-stone-500">
            Supermercado {formatMoney(previewRecord.totals.groceries)} · Combustible {formatMoney(previewRecord.totals.fuel)} · Otros {formatMoney(previewRecord.totals.other)} · {previewRecord.variableTransactions.length} transacciones
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          onAddTransaction={onAddEditingTransaction}
          onCancel={onCancelEditing}
          onDeleteTransaction={onDeleteEditingTransaction}
          onSave={onSaveEditing}
          onUpdateDraft={onUpdateEditingRecord}
          onUpdatePayment={onUpdateEditingPayment}
          onUpdateTransaction={onUpdateEditingTransaction}
        />
      ) : null}

      {expanded ? (
        <div className="mt-3 grid gap-2">
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
  onAddTransaction,
  onCancel,
  onDeleteTransaction,
  onSave,
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

function normalizeActiveWeek(activeWeek, weeklySummary) {
  const plannedGroceries = Number(weeklySummary.groceries || 0);
  const plannedFuel = Number(weeklySummary.fuel || 0);

  return {
    ...activeWeek,
    weekStartDate: activeWeek.weekStartDate || activeWeek.weekDate || getCurrentFinancialWeekStartDate(),
    realIncome: Number(activeWeek.realIncome ?? activeWeek.income ?? 0),
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
  const hasPaymentDetails = Array.isArray(record.payments) && record.payments.length > 0;
  const totalPaid = hasPaymentDetails ? calculatePaymentTotal(record.payments) : Number(record.totalPaid ?? 0);
  const plannedGroceries = Number(record.plannedGroceries ?? budgetSnapshot?.plannedGroceries ?? weeklySummary.groceries ?? 0);
  const plannedFuel = Number(record.plannedFuel ?? budgetSnapshot?.plannedFuel ?? weeklySummary.fuel ?? 0);
  const plannedVariableBudget = plannedGroceries + plannedFuel;
  const variableDifference = plannedVariableBudget - totals.total;
  const realWeeklyMargin =
    realIncome -
    Number(budgetSnapshot?.fixedWeeklyExpensesTotal ?? weeklySummary.weeklyExpensesTotal ?? 0) -
    Number(budgetSnapshot?.monthlyReserveWeekly ?? weeklySummary.monthlyReserveWeekly ?? 0) -
    totals.total -
    totalPaid;

  return {
    weekDate: record.weekDate || record.weekStartDate,
    realIncome,
    totalPaid,
    plannedVariableBudget,
    variableTransactions,
    totals,
    variableDifference,
    realWeeklyMargin,
    note: record.note || '',
  };
}

function createEditableRecordDraft(record) {
  return {
    weekDate: record.weekDate || record.weekStartDate || getTodayIsoDate(),
    realIncome: Number(record.realIncome ?? record.income ?? 0),
    variableTransactions: normalizeRecordTransactions(record),
    payments: sanitizePayments(record.payments || []),
    note: record.note || '',
  };
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
