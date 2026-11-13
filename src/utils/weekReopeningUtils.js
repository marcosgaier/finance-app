import { prepareHistoricalPayments } from './historicalPaymentUtils.js';

export function hasFinancialWeekData(week) {
  if (!week) return false;
  if (week.reopenedFromHistory) return true;
  for (const key of ['extraIncome', 'variableTransactions', 'payments', 'reserveMovements']) {
    if (week[key]?.length) return true;
  }
  if (String(week.note || '').trim()) return true;
  for (const key of ['openingBalance', 'totalPaid', 'grocerySpent', 'groceriesSpent', 'realGroceries', 'fuelSpent', 'realFuel', 'otherVariableSpent', 'otherVariableExpenses', 'otherSpent']) {
    if (Number(week[key] || 0) !== 0) return true;
  }
  // Only weeks created with this explicit marker can be replaced as pristine.
  // Legacy zero income cannot safely be distinguished from an intentional zero.
  if ('realIncome' in week || 'income' in week) {
    if (!week.pristineFinancialWeek || Number(week.realIncome || week.income || 0) !== 0) return true;
  }
  const presentationFields = new Set(['id', 'weekStartDate', 'weekDate', 'openingBalance', 'income', 'realIncome', 'extraIncome', 'variableTransactions', 'payments', 'reserveMovements', 'note', 'plannedGroceries', 'plannedFuel', 'plannedVariableBudget', 'minimumToAvoidExpiry', 'recommendedPayment', 'createdAt', 'updatedAt', 'pristineFinancialWeek']);
  return Object.keys(week).some((key) => !presentationFields.has(key));
}

export function getWeekReopenError(data, recordId) {
  if (hasFinancialWeekData(data.activeWeek)) return 'No podemos reabrir esta semana porque la semana activa contiene información. Cerrala primero o usá Editar en la semana histórica. No se reemplazó ningún dato.';
  const matches = (data.weeklyRecords || []).filter((record) => record.id === recordId);
  if (matches.length !== 1) return 'No podemos identificar una única semana para reabrir. No se modificó ningún dato.';
  if (matches[0].reopenedFromHistory !== undefined) return 'Esta semana contiene datos de reapertura que requieren revisión. No se modificó ningún dato.';
  return '';
}

export function reopenFinancialWeek(data, recordId) {
  if (getWeekReopenError(data, recordId)) return data;
  const record = data.weeklyRecords.find((item) => item.id === recordId);
  return {
    ...data,
    activeWeek: { ...record, reopenedFromHistory: true },
    weeklyRecords: data.weeklyRecords.filter((item) => item.id !== recordId),
  };
}

export function closeReopenedFinancialWeek(record) {
  const { reopenedFromHistory, ...originalFields } = record;
  return originalFields;
}

export function closeFinancialWeek(data, record) {
  if (!data.activeWeek || (data.weeklyRecords || []).some((item) => item.id === record.id)) return data;
  if (data.activeWeek.reopenedFromHistory && data.activeWeek.id !== record.id) return data;
  return { ...data, activeWeek: null, weeklyRecords: [...(data.weeklyRecords || []), record] };
}

export function buildReopenedWeekCorrection(record, draft, cards) {
  const payments = prepareHistoricalPayments(record.payments || [], draft.payments, cards);
  const patch = {};
  const income = Number(draft.income);
  if (!Number.isFinite(income) || income < 0 || String(draft.income).trim() === '') throw new Error('Ingresá un ingreso válido, igual o mayor a cero.');
  if (income !== Number(record.realIncome ?? record.income ?? 0)) {
    patch.realIncome = income;
    patch.income = income;
  }
  if (draft.note !== (record.note || '')) patch.note = draft.note;
  if (payments.some((payment, index) => payment !== record.payments?.[index])) {
    patch.payments = payments;
    patch.totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }
  return patch;
}
