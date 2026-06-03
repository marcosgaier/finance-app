import { isReserveFunded, isWeeklyIncomeFunded, WEEKLY_INCOME_SOURCE } from './fundingSourceUtils.js';

const BBVA_WEEKLY_EXPENSE_ID = 'argentina-card';
const BBVA_RESERVE_BUCKET_ID = 'bbva';

export function calculateExtraIncomeTotal(extraIncome = []) {
  return extraIncome.reduce((total, income) => total + Number(income.amount || 0), 0);
}

export function normalizeTransactionCategory(category) {
  if (category === 'supermercado' || category === 'grocery') return 'groceries';
  if (category === 'combustible') return 'fuel';
  if (category === 'otros') return 'other';
  return ['groceries', 'fuel', 'other'].includes(category) ? category : 'other';
}

export function calculateTransactionTotals(transactions = []) {
  return transactions.reduce(
    (totals, transaction) => {
      const category = normalizeTransactionCategory(transaction.category);
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

export function calculatePaymentTotal(payments = []) {
  return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
}

export function calculateWeeklyFundedTotal(items = []) {
  return items
    .filter((item) => isWeeklyIncomeFunded(item))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

export function calculateReserveFundedTotal(items = []) {
  return items
    .filter((item) => isReserveFunded(item))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

export function calculateReserveMovementTotal(reserveMovements = []) {
  return reserveMovements.reduce((total, movement) => {
    const amount = Number(movement.amount || 0);
    return total + (movement.type === 'withdrawal' ? -amount : amount);
  }, 0);
}

export function calculateAdjustedWeeklyExpenseRows(weeklyExpenses = [], reserveMovements = []) {
  const normalizedRows = (weeklyExpenses || []).map((expense) => ({
    id: expense.id || expense.name,
    name: expense.name || 'Gasto semanal',
    amount: Number(expense.amount || 0),
  }));
  let bbvaCoverageRemaining = (reserveMovements || [])
    .filter(
      (movement) =>
        movement.bucketId === BBVA_RESERVE_BUCKET_ID &&
        movement.type !== 'withdrawal' &&
        isWeeklyIncomeFunded(movement),
    )
    .reduce((total, movement) => total + Number(movement.amount || 0), 0);

  const weeklyExpenseRows = normalizedRows.map((expense) => {
    if (expense.id !== BBVA_WEEKLY_EXPENSE_ID || bbvaCoverageRemaining <= 0) {
      return expense;
    }

    const coveredAmount = Math.min(expense.amount, bbvaCoverageRemaining);
    bbvaCoverageRemaining -= coveredAmount;

    return {
      ...expense,
      amount: Math.max(0, expense.amount - coveredAmount),
    };
  });
  const fixedWeeklyExpensesTotal = weeklyExpenseRows.reduce((total, expense) => total + Number(expense.amount || 0), 0);

  return {
    weeklyExpenseRows,
    fixedWeeklyExpensesTotal,
  };
}

export function normalizeWeeklyRecordTransactions(record = {}) {
  if (Array.isArray(record.variableTransactions)) {
    return record.variableTransactions.map((transaction, index) => ({
      id: transaction.id || `legacy-transaction-${record.id || record.weekDate}-${index}`,
      date: transaction.date || record.weekDate || record.weekStartDate || '',
      description: transaction.description || transaction.merchant || 'Gasto variable',
      category: normalizeTransactionCategory(transaction.category),
      amount: Number(transaction.amount || 0),
      fundingSource: transaction.fundingSource || WEEKLY_INCOME_SOURCE,
    }));
  }

  const legacyTransactions = [
    {
      id: `legacy-groceries-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Supermercado',
      category: 'groceries',
      amount: Number(record.realGroceries ?? record.grocerySpent ?? record.groceriesSpent ?? 0),
      fundingSource: WEEKLY_INCOME_SOURCE,
    },
    {
      id: `legacy-fuel-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Combustible',
      category: 'fuel',
      amount: Number(record.realFuel ?? record.fuelSpent ?? 0),
      fundingSource: WEEKLY_INCOME_SOURCE,
    },
    {
      id: `legacy-other-${record.id || record.weekDate}`,
      date: record.weekDate || record.weekStartDate || '',
      description: 'Otros gastos',
      category: 'other',
      amount: Number(record.otherVariableExpenses ?? record.otherVariableSpent ?? record.otherSpent ?? 0),
      fundingSource: WEEKLY_INCOME_SOURCE,
    },
  ];

  return legacyTransactions.filter((transaction) => transaction.amount > 0);
}

export function normalizeWeeklyReserveMovements(record = {}) {
  if (!Array.isArray(record.reserveMovements)) return [];

  return record.reserveMovements.map((movement, index) => ({
    id: movement.id || `legacy-reserve-transfer-${record.id || record.weekDate}-${index}`,
    date: movement.date || record.weekDate || record.weekStartDate || '',
    bucketId: movement.bucketId,
    bucketName: movement.bucketName || 'Reserva',
    type: movement.type || 'deposit',
    fundingSource: movement.fundingSource || WEEKLY_INCOME_SOURCE,
    amount: Number(movement.amount || 0),
    note: movement.note || '',
  }));
}

export function buildWeeklyMoneyFlowSummary({ financeData, record, useCurrentBudget, weeklySummary }) {
  const budgetSnapshot = useCurrentBudget ? null : record.budgetSnapshot || null;
  const extraIncome = Array.isArray(record.extraIncome) ? record.extraIncome : [];
  const extraIncomeTotal = calculateExtraIncomeTotal(extraIncome);
  const openingBalance = Number(record.openingBalance || 0);
  const primaryIncome = Number(record.realIncome ?? record.income ?? 0);
  const totalIncome = openingBalance + primaryIncome + extraIncomeTotal;
  const variableTransactions = normalizeWeeklyRecordTransactions(record);
  const reserveMovements = normalizeWeeklyReserveMovements(record);
  const adjustedWeeklyExpenses = calculateAdjustedWeeklyExpenseRows(
    budgetSnapshot?.weeklyExpenses || financeData.weeklyExpenses || [],
    reserveMovements,
  );
  const weeklyExpenseRows = adjustedWeeklyExpenses.weeklyExpenseRows;
  const fallbackWeeklyExpensesTotal = weeklyExpenseRows.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const fixedWeeklyExpensesTotal = Number(
    weeklyExpenseRows.length > 0
      ? adjustedWeeklyExpenses.fixedWeeklyExpensesTotal
      : budgetSnapshot?.fixedWeeklyExpensesTotal ?? weeklySummary.weeklyExpensesTotal ?? 0,
  );
  const monthlyReserveWeekly = Number(budgetSnapshot?.monthlyReserveWeekly ?? weeklySummary.monthlyReserveWeekly ?? 0);
  const variableTotals = calculateTransactionTotals(variableTransactions);
  const hasPaymentDetails = Array.isArray(record.payments) && record.payments.length > 0;
  const totalPaid = hasPaymentDetails ? calculatePaymentTotal(record.payments) : Number(record.totalPaid ?? 0);
  const weeklyFundedVariableTotals = calculateTransactionTotals(variableTransactions.filter((transaction) => isWeeklyIncomeFunded(transaction)));
  const reserveFundedVariableTotals = calculateTransactionTotals(variableTransactions.filter((transaction) => isReserveFunded(transaction)));
  const weeklyFundedPaid = hasPaymentDetails ? calculateWeeklyFundedTotal(record.payments) : totalPaid;
  const reserveFundedPaid = hasPaymentDetails ? calculateReserveFundedTotal(record.payments) : 0;
  const reserveFundedTotal = reserveFundedVariableTotals.total + reserveFundedPaid;
  const reserveTransferTotal = calculateReserveMovementTotal(reserveMovements);
  const weeklyFundedReserveTransferTotal = calculateReserveMovementTotal(
    reserveMovements.filter((movement) => isWeeklyIncomeFunded(movement)),
  );
  const fixedAndReservedTotal = fixedWeeklyExpensesTotal + monthlyReserveWeekly;
  const totalOutflow = fixedAndReservedTotal + variableTotals.total + totalPaid + reserveTransferTotal;
  const weeklyIncomeOutflow =
    fixedAndReservedTotal + weeklyFundedVariableTotals.total + weeklyFundedPaid + weeklyFundedReserveTransferTotal;
  const totalOutflowMargin = totalIncome - totalOutflow;
  const margin = totalIncome - weeklyIncomeOutflow;

  return {
    primaryIncome,
    openingBalance,
    extraIncomeTotal,
    totalIncome,
    weeklyExpenseRows,
    fixedWeeklyExpensesTotal,
    monthlyReserveWeekly,
    fixedAndReservedTotal,
    variableTotals,
    reserveFundedVariableTotals,
    reserveFundedPaid,
    reserveFundedTotal,
    reserveMovements,
    reserveTransferTotal,
    totalPaid,
    totalOutflow,
    totalOutflowMargin,
    weeklyIncomeOutflow,
    margin,
  };
}
