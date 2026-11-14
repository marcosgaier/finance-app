import { formatIsoDate } from './dateUtils.js';
import { WEEKLY_INCOME_SOURCE } from './fundingSourceUtils.js';

// Shared display/write identities for active weeks only. Persist survivors on an
// explicit edit so removing an index cannot retarget a repeated delete request.
export function sanitizePayments(payments = [], fallbackDate = formatIsoDate(new Date())) {
  const counts = new Map();
  for (const payment of payments || []) {
    if (payment.id) counts.set(payment.id, (counts.get(payment.id) || 0) + 1);
  }
  const used = new Set(counts.keys());
  return (payments || []).map((payment, index) => {
    let id = payment.id;
    if (!id || counts.get(id) > 1) {
      const base = `legacy-payment-${payment.cardId || 'card'}-${fallbackDate || formatIsoDate(new Date())}-${index}`;
      id = base;
      let suffix = 0;
      while (used.has(id)) id = `${base}-${++suffix}`;
      used.add(id);
    }
    return {
      id,
      date: payment.date || fallbackDate || formatIsoDate(new Date()),
      cardId: payment.cardId,
      cardName: payment.cardName || 'Tarjeta',
      amount: Number(payment.amount || 0),
      fundingSource: payment.fundingSource || WEEKLY_INCOME_SOURCE,
      note: payment.note || '',
    };
  }).filter((payment) => payment.cardId && Number.isFinite(payment.amount) && payment.amount > 0);
}
