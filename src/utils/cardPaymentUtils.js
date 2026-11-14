import { sanitizePayments } from './activePaymentUtils.js';
import { isReserveFunded } from './fundingSourceUtils.js';

// Warnings only: never infer which plan Latitude will credit or change old records.
export function getCardPaymentWarnings(data, payment, today) {
  const warnings = [];
  const bucket = data.reserveBuckets.find((item) => item.id === payment.fundingSource);
  if (isReserveFunded(payment) && bucket && Number(payment.amount) > Number(bucket.balance)) {
    warnings.push(`El pago supera el saldo de ${bucket.name}. Si continuás, el sobre quedará negativo.`);
  }
  if (payment.date > today) warnings.push('La fecha del pago es futura. Registrá pagos ya realizados: el ciclo puede contarlo antes de esa fecha.');
  const records = [...(data.weeklyRecords || []), ...(data.activeWeek ? [data.activeWeek] : [])];
  if (records.some((record) => (record.payments || []).some((existing) =>
    existing.cardId === payment.cardId &&
    (existing.date || record.weekDate || record.weekStartDate) === payment.date &&
    Math.round(Number(existing.amount) * 100) === Math.round(Number(payment.amount) * 100)))) {
    warnings.push('Hay un posible duplicado: misma tarjeta, fecha e importe. Continuá solo si es otro pago real.');
  }
  return warnings;
}

// A single state update keeps the new payment and its reserve debit together.
export function recordCardPayment(data, payment) {
  if (!data.activeWeek || data.activeWeek.reopenedFromHistory ||
      !Number.isFinite(payment.amount) || payment.amount <= 0 || !payment.date ||
      !data.cards.some((card) => card.id === payment.cardId) ||
      (data.activeWeek.payments || []).some((existing) => existing.id === payment.id)) return data;
  const payments = sanitizePayments(data.activeWeek.payments, data.activeWeek.weekStartDate || data.activeWeek.weekDate);
  if (!payment.id || payments.some((existing) => existing.id === payment.id)) return data;
  const fromReserve = isReserveFunded(payment);
  if (fromReserve && !data.reserveBuckets.some((bucket) => bucket.id === payment.fundingSource)) return data;
  return {
    ...data,
    reserveBuckets: fromReserve ? data.reserveBuckets.map((bucket) => bucket.id === payment.fundingSource
      ? { ...bucket, balance: Number(bucket.balance || 0) - payment.amount } : bucket) : data.reserveBuckets,
    activeWeek: {
      ...data.activeWeek,
      pristineFinancialWeek: false,
      payments: [...payments, payment],
      updatedAt: new Date().toISOString(),
    },
  };
}

export function removeActiveCardPayment(data, paymentId) {
  if (!data.activeWeek || data.activeWeek.reopenedFromHistory) return data;
  const payments = sanitizePayments(data.activeWeek.payments, data.activeWeek.weekStartDate || data.activeWeek.weekDate);
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) return data;
  return {
    ...data,
    reserveBuckets: isReserveFunded(payment) ? data.reserveBuckets.map((bucket) => bucket.id === payment.fundingSource
      ? { ...bucket, balance: Number(bucket.balance || 0) + Number(payment.amount || 0) } : bucket) : data.reserveBuckets,
    activeWeek: {
      ...data.activeWeek,
      pristineFinancialWeek: false,
      payments: payments.filter((item) => item.id !== paymentId),
      updatedAt: new Date().toISOString(),
    },
  };
}
